// The offline outbox (lib/outbox.js) in plain Node, with localStorage,
// window and fetch stubbed. Covers the two ways a queued send used to go
// wrong: being dropped on a temporary server error, and being sent under
// whoever signed in next on a shared phone.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
globalThis.Event = class { constructor(type) { this.type = type; } };

const outbox = await import('../lib/outbox.js');
const { signOut } = await import('../lib/account.js');

const signInAs = (username) =>
  username ? store.set('kay-session', JSON.stringify({ username })) : store.delete('kay-session');

let calls = [];
function serverReplies(...statuses) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init?.body || 'null') });
    const status = statuses.length > 1 ? statuses.shift() : statuses[0];
    if (status === 'offline') throw new TypeError('Failed to fetch');
    return { status, ok: status >= 200 && status < 300, json: async () => ({}) };
  };
}

const chat = (text) => ({ kind: 'chat', url: '/api/chat', body: { listingId: 'L1', tenant: null, text, clientId: text } });

beforeEach(() => {
  store.clear();
  signInAs('alice');
});

test('classifyStatus: done / retry / fail', () => {
  for (const s of [200, 201, 409]) assert.equal(outbox.classifyStatus(s), 'done', String(s));
  for (const s of [500, 502, 503, 504, 408, 429, 401]) assert.equal(outbox.classifyStatus(s), 'retry', String(s));
  for (const s of [400, 403, 404, 413]) assert.equal(outbox.classifyStatus(s), 'fail', String(s));
});

test('a 502 keeps the message queued and stops the pass, so order is kept', async () => {
  outbox.enqueue(chat('one'));
  outbox.enqueue(chat('two'));
  serverReplies(502);
  await outbox.flush();
  assert.equal(calls.length, 1, 'stops after the first temporary failure');
  assert.deepEqual(outbox.all().map((i) => i.body.text), ['one', 'two']);
  assert.ok(outbox.all().every((i) => !i.failed));

  serverReplies(200);
  await outbox.flush();
  assert.deepEqual(calls.map((c) => c.body.text), ['one', 'two']);
  assert.equal(outbox.all().length, 0);
});

test('network failure keeps everything', async () => {
  outbox.enqueue(chat('one'));
  serverReplies('offline');
  await outbox.flush();
  assert.equal(outbox.all().length, 1);
});

test('a refused chat send is kept as failed (shown "not sent"), not retried', async () => {
  outbox.enqueue(chat('blocked'));
  outbox.enqueue(chat('next'));
  serverReplies(403, 200);
  await outbox.flush();
  const [first] = outbox.pendingChat('L1', null);
  assert.equal(first.body.text, 'blocked');
  assert.equal(first.failed, true);
  assert.equal(outbox.pendingChat('L1', null).length, 1, 'the next one still went out');

  serverReplies(200);
  await outbox.flush();
  assert.equal(calls.length, 0, 'a failed item is never resent');
  outbox.remove(first.id);
  assert.equal(outbox.all().length, 0);
});

test('a refused visit request is simply dropped; 409 counts as delivered', async () => {
  outbox.enqueue({ kind: 'visit', url: '/api/visits', body: { listingId: 'L1' } });
  outbox.enqueue({ kind: 'visit', url: '/api/visits', body: { listingId: 'L2' } });
  serverReplies(400, 409);
  await outbox.flush();
  assert.equal(outbox.all().length, 0);
});

test("another account's queued items are never sent or shown", async () => {
  outbox.enqueue(chat('from alice'));
  signInAs('bob');
  assert.equal(outbox.pendingChat('L1', null).length, 0, 'bob does not see alice’s bubble');
  serverReplies(200);
  await outbox.flush();
  assert.equal(calls.length, 0, 'nothing goes out under bob');

  signInAs('alice');
  await outbox.flush();
  assert.deepEqual(calls.map((c) => c.body.text), ['from alice']);
});

test('nothing is sent while signed out', async () => {
  outbox.enqueue(chat('x'));
  signInAs(null);
  serverReplies(200);
  await outbox.flush();
  assert.equal(calls.length, 0);
});

test('signing out clears the queue', async () => {
  outbox.enqueue(chat('x'));
  globalThis.fetch = async () => ({ ok: true, status: 200 });
  await signOut();
  signInAs('alice');
  assert.equal(outbox.all().length, 0);
});

test('legacy items with no owner are discarded, never sent', async () => {
  store.set('kay_outbox', JSON.stringify([{ id: 'old', createdAt: Date.now(), ...chat('legacy') }]));
  serverReplies(200);
  await outbox.flush();
  assert.equal(calls.length, 0);
  assert.equal(store.has('kay_outbox'), false);
});

test('items older than MAX_AGE stop retrying', async () => {
  outbox.enqueue(chat('stale'));
  const items = JSON.parse(store.get('kay_outbox'));
  items[0].createdAt = Date.now() - outbox.MAX_AGE_MS - 1000;
  store.set('kay_outbox', JSON.stringify(items));
  serverReplies(200);
  await outbox.flush();
  assert.equal(calls.length, 0);
  assert.equal(outbox.all()[0].failed, true);
});
