import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

export async function resolve(specifier, context, next) {
  let spec = specifier;
  if (spec.startsWith('@/')) spec = pathToFileURL(path.join(ROOT, spec.slice(2))).href;
  const relative = spec.startsWith('.') || spec.startsWith('file:');
  if (relative && !/\.(m?js|json|jsx)$/.test(spec)) {
    try {
      return await next(`${spec}.js`, context);
    } catch {
      // fall through to the original specifier
    }
  }
  return next(spec, context);
}
