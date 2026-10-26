// AI reply assist for admin chats only. Pure provider call, no app
// imports, so the unit test can inject a fake fetch — no live API call
// ever happens in a test.
//
// The admin taps "Improve" on a draft; this returns a more professional
// rewrite in the same language, same meaning, chat-appropriate length.
// The caller sends it manually: nothing here writes a message, and
// nothing here logs message content — a draft is the admin's words,
// and a rewrite must never land in a log file.
//
// Returns the improved text, or null when there is no key, the draft
// is empty, or the provider refuses. The route maps null to a generic
// failure; it never forwards provider error bodies.
export async function improveDraft(draft, locale, {
  fetchFn = fetch,
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL || 'gpt-4o-mini',
  baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com',
} = {}) {
  const text = String(draft || '').trim().slice(0, 2000);
  if (!text || !apiKey) return null;
  const lang = locale === 'fr' ? 'French' : locale === 'en' ? 'English' : 'Haitian Creole';
  const res = await fetchFn(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `Rewrite the message below more professionally, in ${lang}, keeping the same meaning and a chat-appropriate length. Return only the rewrite, no explanation, no quotation marks.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const out = String(data?.choices?.[0]?.message?.content || '').trim();
  return out ? out.slice(0, 2000) : null;
}
