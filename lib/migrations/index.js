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
import * as m0012 from './0012_traffic_metrics';
import * as m0013 from './0013_payment_deletions';
import * as m0014 from './0014_receiver_txn';
import * as m0015 from './0015_listing_limit';
import * as m0016 from './0016_revenue_source';
import * as m0017 from './0017_currency';
import * as m0018 from './0018_address';
import * as m0019 from './0019_ad_budgets';
import * as m0020 from './0020_admin_users';
import * as m0021 from './0021_fraud_suspension';

export const MIGRATIONS = [m0001, m0002, m0003, m0004, m0005, m0006, m0007, m0008, m0009, m0010, m0011, m0012, m0013, m0014, m0015, m0016, m0017, m0018, m0019, m0020, m0021];
