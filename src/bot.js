// Conversation flow (follows TravMed's script):
// welcome → booking type → area → cost info → time slot → name/cell/email → closing
const C = require('./content');

const RESTART_WORDS = ['hi', 'hello', 'hey', 'hallo', 'howzit', 'good morning', 'good afternoon', 'good day',
  'start', 'menu', 'restart', 'book', 'booking'];
const CANCEL_WORDS = ['cancel', 'stop', 'quit', 'exit'];

const EMAIL_RE = /[^\s@,;:<>()]+@[^\s@,;:<>()]+\.[a-z]{2,}/i;
// South African numbers: 082 123 4567, 0821234567, +27 82 123 4567, 27821234567
const PHONE_RE = /(?:\+?27|0)[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{4}\b/;
const LABEL_WORDS = /\b(my|name|names|full|is|it's|its|cell|cellphone|cell phone|phone|mobile|number|no|nr|email|e-mail|address|and|for calls|surname|thanks|thank you|thank|ok|okay|hi|hello|here|please|sure)\b[:.\-]?/gi;

// Pull name, cell number and email out of one free-text message.
function parseDetails(text) {
  let rest = text;
  const email = (rest.match(EMAIL_RE) || [])[0] || '';
  if (email) rest = rest.replace(email, ' ');
  const phoneRaw = (rest.match(PHONE_RE) || [])[0] || '';
  if (phoneRaw) rest = rest.replace(phoneRaw, ' ');
  const phone = phoneRaw.replace(/[^\d+]/g, '');
  const name = rest
    .replace(LABEL_WORDS, ' ')
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { name: /\p{L}{2,}/u.test(name) ? name : '', phone, email };
}

function createBot({ wa, mailer, timeoutMin = 30, log = console }) {
  const sessions = new Map(); // whatsapp number -> { state, data, updatedAt }

  function getSession(from) {
    let s = sessions.get(from);
    if (!s || Date.now() - s.updatedAt > timeoutMin * 60_000) {
      s = { state: 'new', data: {} };
      sessions.set(from, s);
    }
    s.updatedAt = Date.now();
    return s;
  }

  // Match a tap (reply id) or typed text ("3", "durban", "port elizabeth").
  function pick(msg, options) {
    if (msg.replyId) return options.find((o) => o.id === msg.replyId) || null;
    const t = (msg.text || '').toLowerCase().replace(/[.)]/g, '').trim();
    if (!t) return null;
    const n = Number(t);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1];
    return (
      options.find((o) => o.title.toLowerCase() === t || o.label?.toLowerCase() === t || o.aliases?.includes(t)) ||
      options.find((o) => t.length >= 3 && o.title.toLowerCase().includes(t)) ||
      null
    );
  }

  // ── Steps ──────────────────────────────────────────────────
  function askType(to, s) {
    s.state = 'type';
    s.data = {};
    return wa.sendList(to, C.TEXT.welcome, 'Choose option', C.BOOKING_TYPES, 'Bookings');
  }
  function askArea(to, s) {
    s.state = 'area';
    return wa.sendList(to, C.TEXT.area, 'Choose area', C.AREAS, 'Areas');
  }
  async function askTime(to, s, withCost) {
    s.state = 'time';
    if (withCost) await wa.sendText(to, C.TEXT.cost);
    return wa.sendButtons(to, C.TEXT.time, C.TIME_SLOTS);
  }
  function askDetails(to, s) {
    s.state = 'details';
    return wa.sendText(to, C.TEXT.details);
  }

  function missingDetails(d) {
    const m = [];
    if (!d.name) m.push('Your Name');
    if (!d.cell) m.push('Your Cell Number (For Calls)');
    if (!d.email) m.push('Your email address');
    return m;
  }

  async function submit(to, s) {
    const lead = { ...s.data, whatsapp: to };
    s.state = 'done';
    s.data = {};
    try {
      await mailer.sendLead(lead);
    } catch (err) {
      log.error('[lead] failed to email lead', err, lead);
      return wa.sendText(to, C.TEXT.submitError);
    }
    return wa.sendText(to, C.TEXT.closing);
  }

  // ── Main handler ── msg: { from, text, replyId } ────────────
  async function handle(msg) {
    const to = msg.from;
    const s = getSession(to);
    const text = (msg.text || '').trim();
    const lower = text.toLowerCase();

    if (CANCEL_WORDS.includes(lower)) {
      s.state = 'done';
      s.data = {};
      return wa.sendText(to, 'Your booking has been cancelled. Send *Hi* any time to start again 😊');
    }
    if (s.state === 'new' || s.state === 'done' || RESTART_WORDS.includes(lower)) {
      // A typed option number on the very first message is unlikely; always start with the welcome.
      return askType(to, s);
    }

    switch (s.state) {
      case 'type': {
        const opt = pick(msg, C.BOOKING_TYPES);
        if (!opt) return wa.sendList(to, C.TEXT.pickFromList + '\n\n' + C.TEXT.welcome, 'Choose option', C.BOOKING_TYPES, 'Bookings');
        s.data.bookingType = opt.title;
        return askArea(to, s);
      }

      case 'area': {
        const opt = pick(msg, C.AREAS);
        if (!opt) return wa.sendList(to, C.TEXT.pickFromList + '\n\n' + C.TEXT.area, 'Choose area', C.AREAS, 'Areas');
        s.data.area = opt.description ? `${opt.title} (${opt.description})` : opt.title;
        return askTime(to, s, true);
      }

      case 'time': {
        const opt = pick(msg, C.TIME_SLOTS);
        if (!opt) return askTime(to, s, false);
        s.data.time = opt.label;
        return askDetails(to, s);
      }

      case 'details': {
        const d = parseDetails(text);
        // Fill in whatever was found; keep anything sent in an earlier message.
        if (d.email && !s.data.email) s.data.email = d.email;
        if (d.phone && !s.data.cell) s.data.cell = d.phone;
        if (d.name && !s.data.name) s.data.name = d.name;

        const missing = missingDetails(s.data);
        if (missing.length === 0) return submit(to, s);

        const gotSomething = d.email || d.phone || d.name;
        const intro = gotSomething ? 'Thank you 😊 Please also send:' : 'Please send the following:';
        return wa.sendText(to, `${intro}\n\n${missing.join('\n')}`);
      }

      default:
        return askType(to, s);
    }
  }

  return { handle, sessions };
}

module.exports = { createBot, parseDetails };
