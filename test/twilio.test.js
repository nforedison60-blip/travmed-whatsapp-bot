// Run with: node test/twilio.test.js   (no network needed)
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');

process.env.PROVIDER = 'twilio';
process.env.TWILIO_ACCOUNT_SID = 'ACtest';
process.env.TWILIO_AUTH_TOKEN = 'secret123';
process.env.TWILIO_WHATSAPP_FROM = '+14155238886';
process.env.PUBLIC_BASE_URL = 'https://travmed-whatsapp-bot1.onrender.com/';

const sent = [];
global.fetch = async (url, opts) => {
  sent.push({ url, auth: opts.headers.Authorization, body: Object.fromEntries(new URLSearchParams(opts.body)) });
  return { ok: true, json: async () => ({}) };
};

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n', e); process.exitCode = 1; }
};

const twilio = require('../src/twilio');
const { server } = require('../src/index');

const sign = (url, params) =>
  crypto.createHmac('sha1', 'secret123')
    .update(url + Object.keys(params).sort().map((k) => k + params[k]).join(''))
    .digest('base64');

function post(port, params, signature) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const req = http.request({ port, path: '/twilio', method: 'POST', headers: {
      'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': signature,
    } }, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({ status: res.statusCode, text: d })); });
    req.on('error', reject); req.write(body); req.end();
  });
}

(async () => {
  console.log('Twilio');
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const URL = 'https://travmed-whatsapp-bot1.onrender.com/twilio';
  let n = 0;
  const say = async (text) => {
    const p = { MessageSid: 'SM' + ++n, From: 'whatsapp:+27793616334', To: 'whatsapp:+14155238886', Body: text };
    const r = await post(port, p, sign(URL, p));
    await new Promise((res) => setTimeout(res, 30));
    return r;
  };

  await test('rejects unsigned / wrongly signed requests', async () => {
    const r = await post(port, { MessageSid: 'SMx', From: 'whatsapp:+27793616334', Body: 'hi' }, 'nope');
    assert.equal(r.status, 403);
    assert.equal(sent.length, 0);
  });

  await test('"hi" → welcome sent via Twilio API as plain text', async () => {
    const r = await say('hi');
    assert.equal(r.status, 200);
    assert.match(r.text, /<Response><\/Response>/);
    assert.equal(sent.length, 1);
    assert.match(sent[0].url, /api\.twilio\.com\/2010-04-01\/Accounts\/ACtest\/Messages\.json/);
    assert.equal(sent[0].auth, 'Basic ' + Buffer.from('ACtest:secret123').toString('base64'));
    assert.equal(sent[0].body.From, 'whatsapp:+14155238886');
    assert.equal(sent[0].body.To, 'whatsapp:+27793616334');
    assert.match(sent[0].body.Body, /Welcome to TravMed[\s\S]*1\. Medical Check Up[\s\S]*4\. Medical Reports/);
  });

  await test('full booking by typing numbers, like the script', async () => {
    await say('3');
    assert.match(sent.at(-1).body.Body, /Which area[\s\S]*9\. Rustenburg/);
    await say('1');
    assert.match(sent.at(-2).body.Body, /R3 050/);
    assert.match(sent.at(-1).body.Body, /What time[\s\S]*3\. Between 2pm to 5pm/);
    await say('2');
    assert.match(sent.at(-1).body.Body, /Your Cell Number/);
    await say('Thabo Mokoena 0821234567 thabo@gmail.com');
    assert.match(sent.at(-1).body.Body, /consultants will call you from our 087 703 3699/);
  });

  await test('duplicate MessageSid is ignored', async () => {
    const before = sent.length;
    const p = { MessageSid: 'SMdup', From: 'whatsapp:+27793616334', Body: 'hi' };
    await post(port, p, sign(URL, p));
    await post(port, p, sign(URL, p));
    await new Promise((res) => setTimeout(res, 30));
    assert.equal(sent.length, before + 1);
  });

  server.close();
  console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
})();
