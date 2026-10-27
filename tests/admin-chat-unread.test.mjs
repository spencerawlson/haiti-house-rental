// Admin-chat unread badges, both sides (notification gap fix).
//
// The user side had no unread signal at all (the account page rendered
// Contact admin with a hardcoded badge of 0); the admin side had
// per-thread badges but no total and no refresh. This file covers the
// server side of the fix: the read-only unread endpoint and the
// unchanged read-marking rules around it.
//
// Read-marking rules under test (do not weaken them): the user thread
// GET marks the USER read; the admin thread GET (?username=) marks
// the ADMIN read; the admin thread LIST never marks read; and the new
// unread endpoint never marks read either — two consecutive reads of
// it return the same count.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ADMIN_PASSWORD, client, signup, adminClient, uniq } from './helpers.mjs';

const skip = !ADMIN_PASSWORD && 'needs ADMIN_PASSWORD';
const run = uniq();
const U = { name: 'Una Unread', username: `una_${run}`, password: 'pw-u', role: 'tenant' };
const as = { U: client(), anon: client() };
let admin;

before(async () => {
  if (skip) return;
  assert.equal((await signup(as.U, U)).status, 200);
  admin = await adminClient();
});

test('unread endpoint requires a session', { skip }, async () => {
  assert.equal((await as.anon('/api/admin-chat/unread')).status, 401);
});

test('user unread counts admin messages after last read', { skip }, async () => {
  assert.equal((await as.U('/api/admin-chat/unread')).data.unread, 0);
  assert.equal((await as.U('/api/admin-chat', { method: 'POST', body: { text: 'Bonjou, mwen gen yon kesyon.' } })).status, 200);
  assert.equal((await as.U('/api/admin-chat/unread')).data.unread, 0, 'own messages are not unread');
  assert.equal((await admin('/api/admin/admin-chat', { method: 'POST', body: { username: U.username, text: 'Bonjou Una, mwen la pou ede w.' } })).status, 200);
  assert.equal((await as.U('/api/admin-chat/unread')).data.unread, 1);
  assert.equal((await admin('/api/admin/admin-chat', { method: 'POST', body: { username: U.username, text: 'Di m plis.' } })).status, 200);
  assert.equal((await as.U('/api/admin-chat/unread')).data.unread, 2);
});

test('unread endpoint does not mark read', { skip }, async () => {
  const first = await as.U('/api/admin-chat/unread');
  const second = await as.U('/api/admin-chat/unread');
  assert.equal(first.data.unread, 2);
  assert.equal(second.data.unread, 2, 'two consecutive reads return the same count');
});

test('opening the thread marks the user read and unread drops to 0', { skip }, async () => {
  assert.equal((await as.U('/api/admin-chat')).status, 200);
  assert.equal((await as.U('/api/admin-chat/unread')).data.unread, 0);
});

test('admin list unread behavior unchanged: list never marks read, open marks read', { skip }, async () => {
  const list = async () => {
    const res = await admin('/api/admin/admin-chat');
    assert.equal(res.status, 200);
    return (res.data.threads || []).find((t) => t.username === U.username);
  };
  const first = await list();
  assert.equal(first.unread, 1, 'the user message is unread for the admin');
  const second = await list();
  assert.equal(second.unread, 1, 'listing twice does not mark read');
  assert.equal((await admin(`/api/admin/admin-chat?username=${encodeURIComponent(U.username)}`)).status, 200);
  assert.equal((await list()).unread, 0, 'opening the thread marks the admin read');
});
