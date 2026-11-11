// Server-only advertiser store — Postgres. External businesses (not
// listing owners) post picture ads: a campaign is created 'pending',
// an advertising payment (100–1,000 HTG, MonCash/NatCash) is submitted
// against it, and the admin's confirmation sets the view/click budgets
// and flips it to 'active' (see lib/payments-server.js).
//
// Privacy rule, same as listing ads: advertisers see COUNTS ONLY
// (views/clicks used on their own campaigns) — never who viewed or
// clicked, never anyone else's numbers. The public feed carries no
// counts at all.
import { randomBytes } from 'crypto';
import { query } from './db';

function mapCampaign(r) {
  return {
    id: r.id,
    title: r.title,
    imageUrl: r.image_url,
    linkUrl: r.link_url,
    amountHTG: r.amount_htg != null ? Number(r.amount_htg) : null,
    viewsUsed: Number(r.ad_views_used || 0),
    clicksUsed: Number(r.ad_clicks_used || 0),
    paused: r.ad_paused === true,
    status: r.status,
  };
}

// A campaign as its advertiser sees it, plus the owner (for the pause
// route's ownership check). Never served publicly.
function mapCampaignWithOwner(r) {
  return { ...mapCampaign(r), advertiserUsername: r.advertiser_username };
}

export async function getCampaign(id) {
  if (!id) return null;
  const { rows } = await query('SELECT * FROM ad_campaigns WHERE id = $1', [id]);
  return rows[0] ? mapCampaignWithOwner(rows[0]) : null;
}

export async function createCampaign({ username, title, imageUrl, linkUrl }) {
  const cleanTitle = String(title || '').trim();
  const cleanImage = String(imageUrl || '').trim();
  const cleanLink = String(linkUrl || '').trim();
  if (!cleanTitle) return { error: 'invalid_title' };
  if (!cleanImage) return { error: 'invalid_image' };
  if (!cleanLink.startsWith('http://') && !cleanLink.startsWith('https://')) return { error: 'invalid_link' };
  const { rows } = await query(
    `INSERT INTO ad_campaigns (id, advertiser_username, title, image_url, link_url, amount_htg, status, created_at)
     VALUES ($1,$2,$3,$4,$5,0,'pending',$6) RETURNING *`,
    [`adv-${randomBytes(10).toString('hex')}`, username, cleanTitle, cleanImage, cleanLink, Date.now()],
  );
  return { campaign: mapCampaignWithOwner(rows[0]) };
}

export async function listMyCampaigns(username) {
  const { rows } = await query(
    'SELECT * FROM ad_campaigns WHERE advertiser_username = $1 ORDER BY created_at DESC',
    [username],
  );
  return rows.map(mapCampaign);
}

export async function getAdvertiserStats(username) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS campaigns,
       COALESCE(SUM(ad_views_used), 0)::int AS views_used,
       COALESCE(SUM(ad_clicks_used), 0)::int AS clicks_used
     FROM ad_campaigns WHERE advertiser_username = $1`,
    [username],
  );
  const r = rows[0] || {};
  return {
    campaigns: r.campaigns || 0,
    viewsUsed: r.views_used || 0,
    clicksUsed: r.clicks_used || 0,
  };
}

// Public feed: only campaigns that may show right now — active, not
// paused, and with budget room on both counters (a NULL budget means
// that counter is unbounded, same as the listing display rule). No
// counts leave here.
export async function listActiveCampaigns() {
  const { rows } = await query(
    `SELECT id, title, image_url, link_url FROM ad_campaigns
     WHERE status = 'active' AND ad_paused = FALSE
       AND (ad_views_budget IS NULL OR ad_views_used < ad_views_budget)
       AND (ad_clicks_budget IS NULL OR ad_clicks_used < ad_clicks_budget)
     ORDER BY created_at DESC`,
  );
  return rows.map((r) => ({ id: r.id, title: r.title, imageUrl: r.image_url, linkUrl: r.link_url }));
}

// Advertiser self-serve pause/resume. Ownership is checked by the
// route; this only flips the flag — a paused campaign keeps its
// remaining budget, and resuming spends nothing extra.
export async function setCampaignPaused(id, paused) {
  const { rows } = await query(
    'UPDATE ad_campaigns SET ad_paused = $2 WHERE id = $1 RETURNING *',
    [id, paused === true],
  );
  return rows[0] ? mapCampaignWithOwner(rows[0]) : null;
}
