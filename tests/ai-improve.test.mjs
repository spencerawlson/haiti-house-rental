// AI reply assist (admin chats only): unit tests for the provider call
// with an injected fetch — no live API call, no key, no server. The
// route-level behaviour (no key -> available:false, stats refused) is
// covered over HTTP in promo-admin-chat.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { improveDraft } from '../lib/ai-improve.js';

test('improveDraft posts the draft and returns only the rewrite', async () => {
  let seen;
  const fake = async (url, opts) => {
    seen = { url, opts: JSON.parse(opts.body) };
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Bonjou, mèsi pou mesaj ou. Mwen ap ede ou.' } }] }),
    };
  };
  const out = await improveDraft('bonjou mèsi', 'ht', { fetchFn: fake, apiKey: 'test-key' });
  assert.equal(out, 'Bonjou, mèsi pou mesaj ou. Mwen ap ede ou.');
  assert.equal(seen.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(seen.opts.model, 'gpt-4o-mini');
  assert.equal(seen.opts.messages[1].content, 'bonjou mèsi');
  assert.match(seen.opts.messages[0].content, /Haitian Creole/);
});

test('improveDraft returns null without a key, on empty drafts, and on provider refusal', async () => {
  const never = async () => { throw new Error('must not be called'); };
  assert.equal(await improveDraft('bonjou', 'ht', { fetchFn: never, apiKey: '' }), null);
  assert.equal(await improveDraft('   ', 'ht', { fetchFn: never, apiKey: 'k' }), null);
  const refused = async () => ({ ok: false, json: async () => ({ error: 'nope' }) });
  assert.equal(await improveDraft('bonjou', 'ht', { fetchFn: refused, apiKey: 'k' }), null);
  const empty = async () => ({ ok: true, json: async () => ({ choices: [] }) });
  assert.equal(await improveDraft('bonjou', 'ht', { fetchFn: empty, apiKey: 'k' }), null);
});
