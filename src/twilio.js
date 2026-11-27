// WhatsApp via Twilio. Same interface as whatsapp.js, but everything is sent
// as plain text (the message bodies already contain the numbered options,
// and customers reply by typing the number).
const crypto = require('node:crypto');
const { config } = require('./config');

const toAddr = (n) => `whatsapp:+${String(n).replace(/\D/g, '')}`;

async function sendText(to, body) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`;
  const auth = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: toAddr(config.twilio.from), To: toAddr(to), Body: body }).toString(),
  });
  if (!res.ok) throw new Error(`Twilio API ${res.status}: ${await res.text()}`);
  return res.json();
}

const sendButtons = (to, body) => sendText(to, body);
const sendList = (to, body) => sendText(to, body);
const markRead = async () => {};

// Twilio request signature: base64(HMAC-SHA1(authToken, fullUrl + sorted key+value pairs))
function validSignature(fullUrl, params, header) {
  if (!config.twilio.authToken || process.env.TWILIO_SKIP_SIGNATURE === 'true') return true;
  if (!header) return false;
  const data = fullUrl + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = crypto.createHmac('sha1', config.twilio.authToken).update(data).digest('base64');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { sendText, sendButtons, sendList, markRead, validSignature };
