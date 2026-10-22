// Lets plain Node load the app's lib/ modules in unit tests: Next.js
// resolves extensionless imports ('./departments') and the '@/' alias,
// Node's ESM loader does not. Test-only; the app build is unaffected.
import { register } from 'node:module';

register('./resolve-hook.mjs', import.meta.url);
