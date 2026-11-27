// Thin client for the WhatsApp Cloud API (Meta Graph API).
const { config } = require('./config');

async function callApi(payload) {
  const url = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${body}`);
  }
  return res.json();
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function sendText(to, body) {
  return callApi({ to, type: 'text', text: { body, preview_url: false } });
}

// Up to 3 quick-reply buttons. buttons: [{ id, title }]
function sendButtons(to, body, buttons) {
  return callApi({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: clip(b.title, 20) },
        })),
      },
    },
  });
}

// A list picker with up to 10 rows. rows: [{ id, title, description? }]
function sendList(to, body, buttonLabel, rows, sectionTitle = 'Options') {
  return callApi({
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: clip(buttonLabel, 20),
        sections: [
          {
            title: clip(sectionTitle, 24),
            rows: rows.slice(0, 10).map((r) => ({
              id: r.id,
              title: clip(r.title, 24),
              ...(r.description ? { description: clip(r.description, 72) } : {}),
            })),
          },
        ],
      },
    },
  });
}

function markRead(messageId) {
  return callApi({ status: 'read', message_id: messageId }).catch(() => {});
}

module.exports = { sendText, sendButtons, sendList, markRead };
