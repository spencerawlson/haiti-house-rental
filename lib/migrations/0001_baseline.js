// Migration 0001 — baseline: the whole schema as it stood after Phase 5,
// plus the one-time data steps (chat split, scrypt wrap, conversation
// backfill) and the demo seed. Every statement is idempotent
// (IF NOT EXISTS / run-once guards), so applying it to a database that
// already has this schema changes nothing — that is how existing
// installs adopt versioned migrations safely.
//
// Not reversible: going below the baseline would mean dropping every
// table, i.e. deleting all users, listings, chats and payments.
import { SEED_LISTINGS } from '../seed-listings';

export const version = '0001';
export const name = 'baseline';

export async function up(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    location TEXT,
    role TEXT NOT NULL,
    activated BOOLEAN NOT NULL DEFAULT FALSE,
    partner BOOLEAN NOT NULL DEFAULT FALSE,
    transfer_sent BOOLEAN NOT NULL DEFAULT FALSE,
    transfer_provider TEXT,
    created_at BIGINT NOT NULL
  )`);
  await db.query(`CREATE SEQUENCE IF NOT EXISTS account_number_seq`);
  await db.query(`CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    department TEXT NOT NULL,
    commune TEXT NOT NULL,
    price_htg BIGINT NOT NULL DEFAULT 0,
    bedrooms INT NOT NULL DEFAULT 0,
    bathrooms INT NOT NULL DEFAULT 0,
    area_m2 INT NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    photos JSONB NOT NULL DEFAULT '[]',
    videos JSONB NOT NULL DEFAULT '[]',
    purpose TEXT NOT NULL,
    advertised BOOLEAN NOT NULL DEFAULT FALSE,
    advertised_requested BOOLEAN NOT NULL DEFAULT FALSE,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    owner TEXT,
    rent_period TEXT NOT NULL DEFAULT 'monthly',
    seed_order INT,
    created_at BIGINT NOT NULL
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    at BIGINT NOT NULL
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS chat_messages_listing_idx ON chat_messages (listing_id, at)`);
  // Chat authors + read receipts (Oct 2026): who wrote each message
  // (so tenants get their own inbox, not just landlords), and when
  // each user last read each thread (so unread counts are real).
  await db.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS author TEXT`);
  await db.query(`CREATE TABLE IF NOT EXISTS chat_reads (
    listing_id TEXT NOT NULL,
    username TEXT NOT NULL,
    last_read_at BIGINT NOT NULL,
    PRIMARY KEY (listing_id, username)
  )`);
  // Listing takedown (Oct 2026): a removed listing is hidden, not
  // deleted — its chats and visits stay in the database.
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`);
  // Per-side chat delete (Oct 2026): hiding a thread removes it from
  // that user's inbox only; the other side keeps it. A new message
  // from either side after the hide brings the thread back.
  await db.query(`CREATE TABLE IF NOT EXISTS chat_hidden (
    listing_id TEXT NOT NULL,
    username TEXT NOT NULL,
    hidden_at BIGINT NOT NULL,
    PRIMARY KEY (listing_id, username)
  )`);
  // One-time cleanup (Oct 2026): the old demo greeting seeded fake
  // dialogue ("Bonjou! Èske ... toujou disponib?" / "Wi, li
  // disponib...") into real threads. Real messages can never carry
  // the exact -m1/-m2 ids, so deleting those rows removes only the
  // fake ones. Runs on every boot but matches nothing after the
  // first pass.
  await db.query(`DELETE FROM chat_messages WHERE id LIKE '%-m1' OR id LIKE '%-m2'`);
  await db.query(`CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    listing_title TEXT NOT NULL,
    owner TEXT,
    tenant TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'proposed',
    created_at BIGINT NOT NULL
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS revenue_entries (
    username TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount_htg INT NOT NULL,
    activated_at BIGINT NOT NULL
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY,
    moncash_number TEXT NOT NULL DEFAULT '',
    natcash_number TEXT NOT NULL DEFAULT ''
  )`);
  await db.query(`INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING`);
  // Server sessions (Oct 2026): the cookie holds a random token, the
  // table only its SHA-256 — see lib/session-server.js.
  await db.query(`CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS sessions_username_idx ON sessions (username)`);
  await db.query(`DELETE FROM sessions WHERE expires_at < $1`, [Date.now()]);
  // Per-tenant chat threads (Oct 2026): a thread is (listing, tenant),
  // not just the listing, so tenants never read each other's
  // messages. '' is the legacy thread of anonymous writers.
  await db.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS tenant TEXT`);
  await db.query(`ALTER TABLE chat_reads ADD COLUMN IF NOT EXISTS tenant TEXT NOT NULL DEFAULT ''`);
  await db.query(`ALTER TABLE chat_hidden ADD COLUMN IF NOT EXISTS tenant TEXT NOT NULL DEFAULT ''`);
  await db.query(`ALTER TABLE chat_reads DROP CONSTRAINT IF EXISTS chat_reads_pkey`);
  await db.query(`ALTER TABLE chat_hidden DROP CONSTRAINT IF EXISTS chat_hidden_pkey`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS chat_reads_thread_idx ON chat_reads (listing_id, username, tenant)`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS chat_hidden_thread_idx ON chat_hidden (listing_id, username, tenant)`);
  await db.query(`CREATE INDEX IF NOT EXISTS chat_messages_thread_idx ON chat_messages (listing_id, tenant, at)`);
  // Admin-assisted password recovery (Phase 1b): one live code per
  // account, stored as SHA-256, single-use, 24h.
  await db.query(`CREATE TABLE IF NOT EXISTS password_reset_codes (
    username TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL
  )`);
  // Conversations (Phase 2): a stable id per (listing, tenant) thread,
  // plus block state. Messages still carry listing_id + tenant.
  await db.query(`CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    tenant TEXT NOT NULL,
    landlord TEXT,
    blocked_by TEXT,
    blocked_at BIGINT,
    created_at BIGINT NOT NULL,
    UNIQUE (listing_id, tenant)
  )`);
  // Reports (Phase 2): a user flags a conversation or a listing; the
  // admin reviews and resolves. Nothing is deleted automatically.
  await db.query(`CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    listing_id TEXT,
    reporter TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_at BIGINT NOT NULL,
    resolved_at BIGINT,
    resolved_by TEXT
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at)`);
  // Visits (Phase 2): who proposed the current time (the other side
  // confirms), last change, and an append-only history.
  await db.query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS proposed_by TEXT NOT NULL DEFAULT 'tenant'`);
  await db.query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS updated_at BIGINT`);
  await db.query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]'`);
  await db.query(`CREATE INDEX IF NOT EXISTS visits_listing_idx ON visits (listing_id, created_at)`);
  // Listings (Phase 3): structured optional details (sanitized JSON,
  // see lib/listing-details.js) and an admin verification flag — set
  // only by a human check, never automatically for paying accounts.
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'`);
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS verified_at BIGINT`);
  await db.query(`CREATE INDEX IF NOT EXISTS listings_status_created_idx ON listings (status, created_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS listings_owner_idx ON listings (owner)`);
  // Payments (Phase 4): submitted MonCash/NatCash references, admin
  // review, append-only events. One (provider, reference) ever.
  await db.query(`CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    kind TEXT NOT NULL,
    listing_id TEXT,
    months INT,
    provider TEXT NOT NULL,
    reference TEXT NOT NULL,
    amount_htg INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    review_note TEXT NOT NULL DEFAULT '',
    events JSONB NOT NULL DEFAULT '[]',
    submitted_at BIGINT NOT NULL,
    reviewed_at BIGINT,
    reviewed_by TEXT,
    UNIQUE (provider, reference)
  )`);
  await db.query(`CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status, submitted_at)`);
  await db.query(`CREATE INDEX IF NOT EXISTS payments_user_idx ON payments (username)`);
  // Advertising period (Phase 4): paid months set advertised_until;
  // the carousel stops showing the home when it passes. NULL = an
  // admin approval without an end date (pre-Phase-4 approvals).
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS advertised_since BIGINT`);
  await db.query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS advertised_until BIGINT`);
  await db.query(`CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, ran_at BIGINT NOT NULL)`);
  await runOnce(db, 'chat-per-tenant-threads', migrateChatThreads);
  await runOnce(db, 'scrypt-password-hashes', migratePasswordHashes);
  await runOnce(db, 'conversations-backfill', migrateConversations);
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM listings');
  if (rows[0].n === 0) {
    for (let i = 0; i < SEED_LISTINGS.length; i++) {
      const s = SEED_LISTINGS[i];
      await db.query(
        `INSERT INTO listings (id, type, department, commune, price_htg, bedrooms, bathrooms, area_m2, title, description, photos, videos, purpose, advertised, advertised_requested, lat, lng, owner, rent_period, seed_order, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'', '[]', '[]', $10, FALSE, FALSE, $11, $12, NULL, 'monthly', $13, 0)`,
        [s.id, s.type, s.department, s.commune, s.price, s.bedrooms, s.bathrooms, s.areaM2 || 0, s.title, s.purpose, s.lat, s.lng, i],
      );
    }
  }
}

export async function down() {
  throw new Error('0001 baseline cannot be reverted: it would delete all data. Restore a backup instead (DEPLOY.md).');
}

async function runOnce(db, name, fn) {
  const { rows } = await db.query('SELECT 1 FROM migrations WHERE name = $1', [name]);
  if (rows.length > 0) return;
  await fn(db);
  await db.query('INSERT INTO migrations (name, ran_at) VALUES ($1,$2)', [name, Date.now()]);
}

// Split the old one-thread-per-listing chats: each tenant message belongs
// to its author; each owner reply goes to the tenant who wrote last
// before it. Read and hidden markers follow their threads.
async function migrateChatThreads(db) {
  await db.query(`UPDATE chat_messages SET tenant = COALESCE(author, '') WHERE tenant IS NULL AND sender = 'tenant'`);
  await db.query(`UPDATE chat_messages o SET tenant = COALESCE((
      SELECT t.tenant FROM chat_messages t
      WHERE t.listing_id = o.listing_id AND t.sender = 'tenant' AND t.at <= o.at
      ORDER BY t.at DESC LIMIT 1), '')
    WHERE o.tenant IS NULL`);
  for (const table of ['chat_reads', 'chat_hidden']) {
    const at = table === 'chat_reads' ? 'last_read_at' : 'hidden_at';
    // Tenant side: their marker is for their own thread.
    await db.query(`UPDATE ${table} r SET tenant = r.username
      WHERE r.tenant = '' AND NOT EXISTS (SELECT 1 FROM listings l WHERE l.id = r.listing_id AND l.owner = r.username)`);
    // Owner side: copy the marker onto every tenant thread of the listing.
    await db.query(`INSERT INTO ${table} (listing_id, username, ${at}, tenant)
      SELECT r.listing_id, r.username, r.${at}, m.tenant FROM ${table} r
      JOIN listings l ON l.id = r.listing_id AND l.owner = r.username
      JOIN (SELECT DISTINCT listing_id, tenant FROM chat_messages WHERE tenant <> '') m ON m.listing_id = r.listing_id
      WHERE r.tenant = ''
      ON CONFLICT DO NOTHING`);
  }
}

// One conversation row per existing (listing, tenant) thread. The
// anonymous legacy thread ('') gets one too, so the owner can report it.
async function migrateConversations(db) {
  await db.query(`INSERT INTO conversations (id, listing_id, tenant, landlord, created_at)
    SELECT 'conv-' || md5(m.listing_id || '|' || m.tenant), m.listing_id, m.tenant, l.owner, MIN(m.at)
    FROM chat_messages m LEFT JOIN listings l ON l.id = m.listing_id
    WHERE m.tenant IS NOT NULL
    GROUP BY m.listing_id, m.tenant, l.owner
    ON CONFLICT DO NOTHING`);
}

// Wrap every stored browser SHA-256 in salted scrypt. The browser keeps
// sending the same SHA-256, so nobody has to change their password.
async function migratePasswordHashes(db) {
  const { hashSecret, isServerHash } = await import('../password');
  const { rows } = await db.query('SELECT id, password_hash FROM accounts');
  for (const r of rows) {
    if (isServerHash(r.password_hash)) continue;
    await db.query('UPDATE accounts SET password_hash = $2 WHERE id = $1', [r.id, await hashSecret(r.password_hash)]);
  }
}
