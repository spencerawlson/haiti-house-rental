// Every schema migration, in order. To change the schema: add a new file
// NNNN_name.js exporting { version, name, up(db), down(db) } and append
// it here. Never edit a migration that has shipped — add a new one.
// Imports are static so the Next.js standalone build bundles them.
import * as m0001 from './0001_baseline';
import * as m0002 from './0002_audit_log';
import * as m0003 from './0003_notifications';
import * as m0004 from './0004_profile_photo';
import * as m0005 from './0005_listing_views';
import * as m0006 from './0006_sold_leased';
import * as m0007 from './0007_conversation_survives';
import * as m0008 from './0008_login_events';
import * as m0009 from './0009_visit_reminders';
import * as m0010 from './0010_quarterly_billing';
import * as m0011 from './0011_billing_reminders';

export const MIGRATIONS = [m0001, m0002, m0003, m0004, m0005, m0006, m0007, m0008, m0009, m0010, m0011];
