// Every schema migration, in order. To change the schema: add a new file
// NNNN_name.js exporting { version, name, up(db), down(db) } and append
// it here. Never edit a migration that has shipped — add a new one.
// Imports are static so the Next.js standalone build bundles them.
import * as m0001 from './0001_baseline';
import * as m0002 from './0002_audit_log';

export const MIGRATIONS = [m0001, m0002];
