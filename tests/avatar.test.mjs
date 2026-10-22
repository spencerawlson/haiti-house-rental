// Profile photo regression tests. The placeholder used to be initials
// only; now any signed-in account can upload a real picture. What must
// stay true:
//   - a tenant can do it (they are never "activated", and /api/upload
//     refuses them — that was the whole reason for a second door)
//   - signed out cannot
//   - the file is checked by CONTENT, not by its name
//   - the stored value is a path this server wrote, never client input
//   - removing it brings the initials back
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, client, signup, uniq } from './helpers.mjs';

const run = uniq();
const T = { name: 'Ana Tenant', username: `avten_${run}`, password: 'pw-t', role: 'tenant' };
const as = { T: client() };

// Smallest valid files: a real 1x1 JPEG, and an HTML file wearing a .jpg
// name (what the magic-byte check exists to stop).
const JPEG_1PX = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDc0NP/bAEMBCQkJDAsMGA0NGDIhHCEyMjIyMjIy' +
  'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEB' +
  'AxEB/8QAFAABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAA' +
  'AAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJQA/9k=',
  'base64',
);

function upload(call, { bytes, filename, type }) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), filename);
  return call('/api/accounts/avatar', { method: 'POST', form });
}

before(async () => {
  assert.equal((await signup(as.T, T)).status, 200);
});

test('a tenant starts with no photo and can upload one', async () => {
  assert.equal((await as.T('/api/accounts/me')).data.account.avatarUrl, null);
  const r = await upload(as.T, { bytes: JPEG_1PX, filename: 'me.jpg', type: 'image/jpeg' });
  assert.equal(r.status, 200);
  const url = r.data.account.avatarUrl;
  assert.ok(url && url.startsWith('/uploads/'), `server-written path, got ${url}`);
  assert.ok(url.endsWith('.jpg'));
  // It survives a reload, and the file is really served.
  assert.equal((await as.T('/api/accounts/me')).data.account.avatarUrl, url);
  const served = await fetch(BASE + url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/jpeg');
});

test('removing the photo brings the initials back', async () => {
  const r = await as.T('/api/accounts/avatar', { method: 'DELETE' });
  assert.equal(r.status, 200);
  assert.equal(r.data.account.avatarUrl, null);
  assert.equal((await as.T('/api/accounts/me')).data.account.avatarUrl, null);
});

test('signed out cannot set or remove a photo', async () => {
  const anon = client();
  assert.equal((await upload(anon, { bytes: JPEG_1PX, filename: 'x.jpg', type: 'image/jpeg' })).status, 401);
  assert.equal((await anon('/api/accounts/avatar', { method: 'DELETE' })).status, 401);
});

test('content is checked, not the file name', async () => {
  // HTML renamed .jpg: refused, so it can never be stored and served back.
  const html = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');
  assert.equal((await upload(as.T, { bytes: html, filename: 'evil.jpg', type: 'image/jpeg' })).status, 400);
  // SVG is an XSS vector and is not a served format.
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'utf8');
  assert.equal((await upload(as.T, { bytes: svg, filename: 'evil.svg', type: 'image/svg+xml' })).status, 400);
  // Video is fine for a listing, not for a face.
  assert.equal((await upload(as.T, { bytes: JPEG_1PX, filename: 'clip.mp4', type: 'video/mp4' })).status, 400);
  // Nothing above left a photo behind.
  assert.equal((await as.T('/api/accounts/me')).data.account.avatarUrl, null);
});

test('the avatar path ignores any URL the client tries to send', async () => {
  // The column only ever holds a path this server wrote. There is no field
  // to pass one in, and a JSON body is not a multipart form.
  const r = await as.T('/api/accounts/avatar', { method: 'POST', body: { avatarUrl: 'https://evil.example/pixel.gif' } });
  assert.equal(r.status, 400);
  assert.equal((await as.T('/api/accounts/me')).data.account.avatarUrl, null);
});
