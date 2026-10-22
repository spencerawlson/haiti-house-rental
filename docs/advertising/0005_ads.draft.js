// ============================================================
//  DRAFT — NOT APPLIED. NOT A MIGRATION YET.
// ============================================================
// This file deliberately lives in docs/, not lib/migrations/, and is not
// listed in lib/migrations/index.js. The migration runner reads that
// static list only, so nothing here can run against a database by
// accident. To adopt it: move it to lib/migrations/0005_ads.js (renumber
// if another migration has shipped since), append it to index.js, and
// review it as part of that pull request.
//
// Schema for the advertising MVP (see docs/advertising/ASSESSMENT.md).
// Three tables, deliberately few:
//
//   advertisers  one row = one advertiser AND its one placement. A
//                separate "campaigns" table only earns its keep when a
//                single advertiser runs several concurrent creatives.
//                At five advertisers that is pure overhead; split it
//                later if it is ever needed.
//   ad_stats     one row per advertiser per DAY. Impressions are counted
//                by upsert, not by inserting a row per view: listing
//                pages are force-dynamic and uncached, so a row per
//                impression would add a write to every search render.
//   ad_clicks    one row per outbound click. Clicks are rare and are what
//                an advertiser actually pays attention to, so these are
//                counted exactly. Coarse geography only — no IP, no user
//                agent, no account id.
//
// Unlike the rest of this schema (which has no foreign keys at all),
// these tables use real ones. They are new, so there is no legacy to
// accommodate, and ON DELETE RESTRICT means a paid advertiser cannot be
// deleted out from under its own statistics.
export const version = '0005';
export const name = 'ads';

export async function up(db) {
  // coverage shapes: {"national":true} | {"departments":["ouest"]} |
  // {"communes":["Pétion-Ville","Delmas"]}. Matching is commune →
  // department → national → serve nothing (never an empty placeholder).
  await db.query(`CREATE TABLE IF NOT EXISTS advertisers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    logo_url TEXT,
    dest_url TEXT NOT NULL,
    whatsapp TEXT,
    coverage JSONB NOT NULL DEFAULT '{"national":true}',
    active BOOLEAN NOT NULL DEFAULT FALSE,
    starts_at BIGINT,
    ends_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`);
  // The serving query filters on active + the date window.
  await db.query('CREATE INDEX IF NOT EXISTS advertisers_serving_idx ON advertisers (active, ends_at)');

  await db.query(`CREATE TABLE IF NOT EXISTS ad_stats (
    advertiser_id TEXT NOT NULL REFERENCES advertisers (id) ON DELETE RESTRICT,
    day DATE NOT NULL,
    impressions INT NOT NULL DEFAULT 0,
    clicks INT NOT NULL DEFAULT 0,
    PRIMARY KEY (advertiser_id, day)
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS ad_clicks (
    id BIGSERIAL PRIMARY KEY,
    advertiser_id TEXT NOT NULL REFERENCES advertisers (id) ON DELETE RESTRICT,
    at BIGINT NOT NULL,
    department TEXT,
    commune TEXT
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS ad_clicks_advertiser_idx ON ad_clicks (advertiser_id, at DESC)');
}

export async function down(db) {
  await db.query('DROP TABLE IF EXISTS ad_clicks');
  await db.query('DROP TABLE IF EXISTS ad_stats');
  await db.query('DROP TABLE IF EXISTS advertisers');
}
