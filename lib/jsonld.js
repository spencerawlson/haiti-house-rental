// JSON-LD for <script type="application/ld+json">. JSON.stringify alone
// is not enough: a "<" inside a value could close the script element (a
// "</script>" in a description would end the block early and inject
// markup). Escaping < as \u003c keeps the JSON valid and the tag intact.
export function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
