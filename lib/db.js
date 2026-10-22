// Postgres connection + schema. DATABASE_URL comes from the environment
// (docker-compose points it at the db service; local dev defaults to a
// local Postgres). Tables are created on first use, and the demo listings
// are seeded only when the listings table is empty — so a restart or a
// rebuild never wipes real data, and never duplicates the demos.
import { Pool } from 'pg';
import { SEED_LISTINGS } from './seed-listings';

let pool = null;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/kayayiti',
    });
  }
  return pool;
}

let initPromise = null;
export async function initDb() {
  if (!initPromise) {
    initPromise = (async () => {
      const db = getPool();
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
      const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM listings');
      if (rows[0].n === 0) {
        for (let i = 0; i < SEED_LISTINGS.length; i++) {
          const s = SEED_LISTINGS[i];
          await db.query(
            `INSERT INTO listings (id, type, department, commune, price_htg, bedrooms, bathrooms, area_m2, title, description, photos, videos, purpose, advertised, advertised_requested, lat, lng, owner, rent_period, seed_order, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'', '[]', '[]', $10, FALSE, FALSE, $11, $12, NULL, 'monthly', $13, 0)`,
            [s.id, s.type, s.department, s.commune, s.priceHTG, s.bedrooms, s.bathrooms, s.areaM2 || 0, s.title, s.purpose, s.lat, s.lng, i],
          );
        }
      }
    })().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

export async function query(text, params) {
  await initDb();
  return getPool().query(text, params);
}
