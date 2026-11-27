// Run with: npm test   (no network or WhatsApp account needed)
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const C = require('../src/content');
const { createBot, parseDetails } = require('../src/bot');

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n', e); process.exitCode = 1; }
};

function harness({ failEmail = false } = {}) {
  const sent = [];
  const leads = [];
  const wa = {
    sendText: async (to, body) => sent.push({ to, kind: 'text', body }),
    sendButtons: async (to, body, buttons) => sent.push({ to, kind: 'buttons', body, ids: buttons.map((b) => b.id) }),
    sendList: async (to, body, label, rows) => sent.push({ to, kind: 'list', body, ids: rows.map((r) => r.id) }),
  };
  const mailer = { sendLead: async (l) => { if (failEmail) throw new Error('smtp down'); leads.push(l); } };
  const bot = createBot({ wa, mailer, log: { error() {} } });
  const P = '27821234567';
  const say = (text) => bot.handle({ from: P, text });
  const tap = (replyId) => bot.handle({ from: P, replyId, text: '' });
  const last = () => sent[sent.length - 1];
  return { bot, sent, leads, say, tap, last, P };
}

(async () => {
  console.log('Content limits');
  await test('list rows ≤ 24 chars, buttons ≤ 20, lists ≤ 10 rows', () => {
    for (const r of [...C.BOOKING_TYPES, ...C.AREAS]) assert.ok(r.title.length <= 24, r.title);
    for (const b of C.TIME_SLOTS) assert.ok(b.title.length <= 20, b.title);
    assert.ok(C.AREAS.length <= 10 && C.TIME_SLOTS.length <= 3);
  });

  console.log('Details parsing');
  await test('all three details in one message (various formats)', () => {
    assert.deepEqual(parseDetails('Thabo Mokoena\n082 123 4567\nthabo@gmail.com'),
      { name: 'Thabo Mokoena', phone: '0821234567', email: 'thabo@gmail.com' });
    assert.deepEqual(parseDetails('Name: Lerato Dlamini, Cell: +27 71 555 0101, Email: lerato.d@work.co.za'),
      { name: 'Lerato Dlamini', phone: '+27715550101', email: 'lerato.d@work.co.za' });
    assert.deepEqual(parseDetails('my name is Sipho, my number is 0605551234 and email sipho@x.com'),
      { name: 'Sipho', phone: '0605551234', email: 'sipho@x.com' });
  });
  await test('filler words are not taken as a name', () => {
    assert.equal(parseDetails('thanks').name, '');
  });
  await test('partial details', () => {
    assert.deepEqual(parseDetails('0821234567'), { name: '', phone: '0821234567', email: '' });
    assert.deepEqual(parseDetails('Anele Zulu'), { name: 'Anele Zulu', phone: '', email: '' });
  });

  console.log('Conversation flow (TravMed script)');
  await test('first message → welcome with 4 booking types', async () => {
    const h = harness();
    await h.say('Hi');
    assert.equal(h.last().kind, 'list');
    assert.match(h.last().body, /Welcome to TravMed/);
    assert.deepEqual(h.last().ids, C.BOOKING_TYPES.map((t) => t.id));
  });

  await test('full booking by tapping → cost shown → lead emailed → closing', async () => {
    const h = harness();
    await h.say('Hello');
    await h.tap('type_assessment');
    assert.match(h.last().body, /Which area/);
    assert.equal(h.last().ids.length, 9);
    await h.tap('area_gqe');
    assert.match(h.sent.at(-2).body, /R3 050/);
    assert.match(h.sent.at(-2).body, /pay to the Doctor/);
    assert.deepEqual(h.last().ids, ['time_1', 'time_2', 'time_3']);
    await h.tap('time_2');
    assert.match(h.last().body, /Your Cell Number \(For Calls\)/);
    await h.say('Thabo Mokoena\n082 123 4567\nthabo@gmail.com');
    assert.deepEqual(h.leads[0], {
      bookingType: 'Medical Assessments', area: 'Gqeberha (Port Elizabeth)', time: 'Between 11am to 2pm',
      name: 'Thabo Mokoena', cell: '0821234567', email: 'thabo@gmail.com', whatsapp: h.P,
    });
    assert.match(h.last().body, /087 703 3699 number/);
    assert.match(h.last().body, /Have a good day/);
  });

  await test('typing numbers like the script (1/7/3) works', async () => {
    const h = harness();
    await h.say('hi');
    await h.say('1');
    await h.say('7');
    await h.say('3');
    await h.say('Anele Zulu, 0711234567, anele@mail.com');
    assert.equal(h.leads[0].bookingType, 'Medical Check Up');
    assert.equal(h.leads[0].area, 'Mbombela (Nelspruit)');
    assert.equal(h.leads[0].time, 'Between 2pm to 5pm');
  });

  await test('typing area names incl. old names and misspelling', async () => {
    for (const [typed, want] of [['nelspruit', 'Mbombela (Nelspruit)'], ['Port Elizabeth', 'Gqeberha (Port Elizabeth)'], ['kimberly', 'Kimberley'], ['durban', 'Durban']]) {
      const h = harness();
      await h.say('hi'); await h.say('2'); await h.say(typed); await h.say('1');
      await h.say('Jo Smith 0821112222 jo@x.co.za');
      assert.equal(h.leads[0].area, want, typed);
    }
  });

  await test('details sent across several messages → asks only for missing', async () => {
    const h = harness();
    await h.say('hi'); await h.say('3'); await h.say('1'); await h.say('1');
    await h.say('Sipho Ndlovu');
    assert.match(h.last().body, /Cell Number/);
    assert.match(h.last().body, /email/);
    assert.doesNotMatch(h.last().body, /Your Name/);
    await h.say('0829998888');
    assert.doesNotMatch(h.last().body, /Cell Number/);
    assert.equal(h.leads.length, 0);
    await h.say('sipho@mail.com');
    assert.equal(h.leads.length, 1);
    assert.equal(h.leads[0].name, 'Sipho Ndlovu');
    assert.equal(h.leads[0].cell, '0829998888');
  });

  await test('invalid choices re-ask the same question', async () => {
    const h = harness();
    await h.say('hi');
    await h.say('9');                       // only 4 booking types
    assert.equal(h.bot.sessions.get(h.P).state, 'type');
    await h.say('2');
    await h.say('Cape Town');               // not offered
    assert.equal(h.bot.sessions.get(h.P).state, 'area');
    assert.match(h.last().body, /choose an option/);
    await h.say('1');
    await h.say('tomorrow');                // not a slot
    assert.equal(h.bot.sessions.get(h.P).state, 'time');
    assert.equal(h.last().kind, 'buttons');
  });

  await test('cancel and restart', async () => {
    const h = harness();
    await h.say('hi'); await h.say('1');
    await h.say('cancel');
    assert.match(h.last().body, /cancelled/);
    await h.say('anything');
    assert.match(h.last().body, /Welcome to TravMed/);
    await h.say('1'); await h.say('menu');
    assert.equal(h.bot.sessions.get(h.P).state, 'type');
  });

  await test('after finishing, next message starts a new booking', async () => {
    const h = harness();
    for (const t of ['hi', '1', '1', '1', 'Ann Botha 0821234567 ann@b.co']) await h.say(t);
    await h.say('thanks');
    assert.match(h.last().body, /Welcome to TravMed/);
  });

  await test('email failure → tells client to call', async () => {
    const h = harness({ failEmail: true });
    for (const t of ['hi', '1', '1', '1', 'Ann Botha 0821234567 ann@b.co']) await h.say(t);
    assert.match(h.last().body, /087 703 3699/);
    assert.match(h.last().body, /went wrong/);
  });

  await test('users are kept separate', async () => {
    const h = harness();
    await h.bot.handle({ from: 'A', text: 'hi' });
    await h.bot.handle({ from: 'A', text: '1' });
    await h.bot.handle({ from: 'B', text: 'hi' });
    assert.equal(h.bot.sessions.get('A').state, 'area');
    assert.equal(h.bot.sessions.get('B').state, 'type');
  });

  console.log('Webhook server');
  process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify';
  process.env.META_APP_SECRET = 'test-secret';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890';
  const apiCalls = [];
  global.fetch = async (url, opts) => { apiCalls.push({ url, body: JSON.parse(opts.body) }); return { ok: true, json: async () => ({}) }; };
  for (const k of Object.keys(require.cache)) if (k.includes('/src/')) delete require.cache[k];
  const { server } = require('../src/index');
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const realFetch = (...a) => httpReq(...a);
  async function httpReq(url, opts = {}) {
    return new Promise((resolve, reject) => {
      const req = require('node:http').request(url, { method: opts.method || 'GET', headers: opts.headers }, (res) => {
        let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({ status: res.statusCode, text: d }));
      });
      req.on('error', reject);
      if (opts.body) req.write(opts.body);
      req.end();
    });
  }

  await test('verification handshake', async () => {
    const ok = await realFetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=test-verify&hub.challenge=12345`);
    assert.equal(ok.status, 200); assert.equal(ok.text, '12345');
    const bad = await realFetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`);
    assert.equal(bad.status, 403);
  });

  const payload = (id, msg) => JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '123' }, contacts: [{ wa_id: '27820000000' }], messages: [{ from: '27820000000', id, timestamp: '1', ...msg }] } }] }] });
  const sign = (b) => 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(b).digest('hex');

  await test('rejects bad signature', async () => {
    const body = payload('wamid.X', { type: 'text', text: { body: 'hi' } });
    const r = await realFetch(`${base}/webhook`, { method: 'POST', body, headers: { 'x-hub-signature-256': 'sha256=bad' } });
    assert.equal(r.status, 401);
  });

  await test('signed text message → menu sent via Graph API; duplicate ignored', async () => {
    const body = payload('wamid.1', { type: 'text', text: { body: 'Hi' } });
    for (let i = 0; i < 2; i++) {
      const r = await realFetch(`${base}/webhook`, { method: 'POST', body, headers: { 'x-hub-signature-256': sign(body), 'content-type': 'application/json' } });
      assert.equal(r.status, 200);
    }
    await new Promise((r) => setTimeout(r, 50));
    const msgs = apiCalls.filter((c) => c.body.type);
    assert.equal(msgs.length, 1);
    assert.match(msgs[0].url, /graph\.facebook\.com\/v\d+\.\d+\/.+\/messages/);
    assert.equal(msgs[0].body.messaging_product, 'whatsapp');
    assert.equal(msgs[0].body.interactive.type, 'list');
    assert.equal(apiCalls.filter((c) => c.body.status === 'read').length, 1);
  });

  await test('interactive list reply is understood', async () => {
    apiCalls.length = 0;
    const body = payload('wamid.2', { type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'type_assessment', title: 'Medical Assessments' } } });
    await realFetch(`${base}/webhook`, { method: 'POST', body, headers: { 'x-hub-signature-256': sign(body) } });
    await new Promise((r) => setTimeout(r, 50));
    const msg = apiCalls.find((c) => c.body.type === 'interactive');
    assert.match(msg.body.interactive.body.text, /Which area/);
  });

  server.close();
  console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
})();
