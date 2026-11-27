// HTTP server: Meta webhook verification + incoming message handling.
const http = require('node:http');
const crypto = require('node:crypto');
const { config, missingConfig } = require('./config');
const wa = require('./whatsapp');
const mailer = require('./mailer');
const { createBot } = require('./bot');

const bot = createBot({ wa, mailer, timeoutMin: config.sessionTimeoutMin });

// Meta may deliver the same message more than once; remember recent IDs.
const seen = new Set();
function alreadySeen(id) {
  if (seen.has(id)) return true;
  seen.add(id);
  if (seen.size > 5000) seen.delete(seen.values().next().value);
  return false;
}

// Process each user's messages one at a time, in order.
const queues = new Map();
function enqueue(phone, task) {
  const prev = queues.get(phone) || Promise.resolve();
  const next = prev.then(task).catch((err) => console.error('[bot] error', err));
  queues.set(phone, next);
  next.finally(() => queues.get(phone) === next && queues.delete(phone));
}

function validSignature(rawBody, header) {
  if (!config.appSecret) return true; // signature check disabled if no secret set
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', config.appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Turn one webhook message into { from, id, type, text, replyId }.
function normalise(m) {
  const out = { from: m.from, id: m.id, type: m.type, text: '', replyId: null };
  if (m.type === 'text') out.text = m.text?.body || '';
  else if (m.type === 'interactive') {
    const r = m.interactive?.button_reply || m.interactive?.list_reply;
    out.replyId = r?.id || null;
    out.text = r?.title || '';
  } else if (m.type === 'button') out.text = m.button?.text || ''; // template quick-reply
  return out;
}

function handleWebhook(body) {
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const messages = change.value?.messages || [];
      for (const m of messages) {
        if (alreadySeen(m.id)) continue;
        const msg = normalise(m);
        wa.markRead(m.id);
        enqueue(msg.from, () => bot.handle(msg));
      }
    }
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('TravMed WhatsApp bot is running.');
  }

  // Meta webhook verification handshake.
  if (req.method === 'GET' && url.pathname === '/webhook') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token && token === config.verifyToken) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(challenge);
    }
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (req.method === 'POST' && url.pathname === '/webhook') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      if (!validSignature(raw, req.headers['x-hub-signature-256'])) {
        res.writeHead(401);
        return res.end('Bad signature');
      }
      // Acknowledge immediately so Meta doesn't retry, then process.
      res.writeHead(200);
      res.end('OK');
      try {
        handleWebhook(JSON.parse(raw.toString('utf8')));
      } catch (err) {
        console.error('[webhook] bad payload', err);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

if (require.main === module) {
  const missing = missingConfig();
  if (missing.length) console.warn('[config] Missing env vars:', missing.join(', '));
  if (!config.appSecret) console.warn('[config] META_APP_SECRET not set: webhook signatures are NOT verified.');
  if (!config.smtp.host) console.warn('[config] SMTP not set: leads will only be logged, not emailed.');
  server.listen(config.port, () => console.log(`TravMed bot listening on port ${config.port}`));
}

module.exports = { server, normalise, validSignature };
