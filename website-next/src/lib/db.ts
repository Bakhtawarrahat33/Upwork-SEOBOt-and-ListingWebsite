import { Pool } from 'pg';
import crypto from 'crypto';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'listing_site',
  max: 10,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000,
  query_timeout: 30000,
  statement_timeout: 30000,
  keepAlive: true,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

function toCamel(row: Record<string, unknown>) {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}

function toCamelRow(row: Record<string, unknown>) {
  return toCamel(row);
}

function createId() {
  return crypto.randomUUID();
}

async function tableExists(tableName: string) {
  const { rows } = await pool.query('SELECT to_regclass($1) AS table_name', [`public.${tableName}`]);
  return Boolean(rows[0]?.table_name);
}

async function safeRows<T = Record<string, unknown>>(label: string, query: string, params: unknown[] = []): Promise<T[]> {
  try {
    const { rows } = await pool.query(query, params);
    return rows as T[];
  } catch (err) {
    console.error(`${label} error:`, err);
    return [];
  }
}

async function safeOne<T = Record<string, unknown>>(label: string, query: string, params: unknown[] = []): Promise<T | null> {
  const rows = await safeRows<T>(label, query, params);
  return rows[0] || null;
}

// Products (from listing_site.products)
export async function getProducts() {
  const rows = await safeRows('getProducts', "SELECT * FROM products WHERE COALESCE(status, 'published') = 'published' ORDER BY created_at DESC");
  return rows.map(toCamelRow);
}

export async function getProductById(id: string) {
  const row = await safeOne('getProductById', "SELECT * FROM products WHERE id = $1 AND COALESCE(status, 'published') = 'published'", [id]);
  return row ? toCamelRow(row) : null;
}

export async function createProduct(data: { title: string; description: string; content: string; topics?: string[]; status?: string }) {
  const { rows } = await pool.query(
    'INSERT INTO products (id, campaign_id, title, description, content, topics, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $8) RETURNING *',
    [createId(), 'manual', data.title, data.description, data.content, JSON.stringify(data.topics || []), data.status || 'published', new Date().toISOString()]
  );
  return toCamelRow(rows[0]);
}

// Blogs (from listing_site.blogs)
export async function getBlogs() {
  const rows = await safeRows('getBlogs', "SELECT * FROM blogs WHERE COALESCE(status, 'published') = 'published' ORDER BY created_at DESC");
  return rows.map(toCamelRow);
}

export async function getBlogById(id: string) {
  const row = await safeOne('getBlogById', "SELECT * FROM blogs WHERE id = $1 AND COALESCE(status, 'published') = 'published'", [id]);
  return row ? toCamelRow(row) : null;
}

export async function createBlog(data: { title: string; content: string; topics?: string[]; status?: string }) {
  const { rows } = await pool.query(
    'INSERT INTO blogs (id, campaign_id, title, content, topics, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $7) RETURNING *',
    [createId(), 'manual', data.title, data.content, JSON.stringify(data.topics || []), data.status || 'published', new Date().toISOString()]
  );
  return toCamelRow(rows[0]);
}

// Services (from listing_site.services)
export async function getServices() {
  const rows = await safeRows('getServices', "SELECT * FROM services WHERE COALESCE(status, 'published') = 'published' ORDER BY created_at DESC");
  return rows.map(toCamelRow);
}

export async function getServiceById(id: string) {
  const row = await safeOne('getServiceById', "SELECT * FROM services WHERE id = $1 AND COALESCE(status, 'published') = 'published'", [id]);
  return row ? toCamelRow(row) : null;
}

export async function createService(data: { title: string; description: string; content: string; topics?: string[]; status?: string }) {
  const { rows } = await pool.query(
    'INSERT INTO services (id, campaign_id, title, description, content, topics, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $8) RETURNING *',
    [createId(), 'manual', data.title, data.description, data.content, JSON.stringify(data.topics || []), data.status || 'published', new Date().toISOString()]
  );
  return toCamelRow(rows[0]);
}

// Jobs (from listing_site.jobs)
export async function getJobs() {
  const rows = await safeRows('getJobs', 'SELECT * FROM jobs ORDER BY created_at DESC');
  return rows.map(toCamelRow);
}

export async function getJobById(id: string) {
  const row = await safeOne('getJobById', 'SELECT * FROM jobs WHERE id = $1', [id]);
  return row ? toCamelRow(row) : null;
}

export async function createJob(data: { title: string; description: string; niche?: string; platform?: string; tool?: string; upworkJobUrl?: string }) {
  const { rows } = await pool.query(
    'INSERT INTO jobs (id, campaign_id, title, description, niche, platform, tool, upwork_job_url, viability, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING *',
    [createId(), 'manual', data.title, data.description, data.niche || '', data.platform || '', data.tool || '', data.upworkJobUrl || '', 'Yes', new Date().toISOString()]
  );
  return toCamelRow(rows[0]);
}

// Campaign Stats (handle gracefully if tables don't exist in listing DB)
export async function getCampaignStats() {
  try {
    const { rows: campaignRows } = await pool.query(`
      SELECT status, COUNT(*) as count FROM upwork_campaigns GROUP BY status
    `);
    const { rows: todayJobs } = await pool.query(`
      SELECT COUNT(*) as count FROM jobs WHERE created_at::timestamp >= NOW() - INTERVAL '24 hours'
    `);
    const { rows: todayContent } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM products WHERE created_at::timestamp >= NOW() - INTERVAL '24 hours') as products,
        (SELECT COUNT(*) FROM blogs WHERE created_at::timestamp >= NOW() - INTERVAL '24 hours') as blogs,
        (SELECT COUNT(*) FROM services WHERE created_at::timestamp >= NOW() - INTERVAL '24 hours') as services
    `);
    return {
      campaigns: campaignRows,
      jobsToday: parseInt(todayJobs[0]?.count || '0'),
      contentToday: todayContent[0] || { products: 0, blogs: 0, services: 0 },
    };
  } catch (err) {
    console.error('getCampaignStats error:', err);
    return { campaigns: [], jobsToday: 0, contentToday: { products: 0, blogs: 0, services: 0 } };
  }
}

export async function getRecentCampaigns(_limit = 5) {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, status, upwork_search_input as search, progress, created_at, updated_at FROM upwork_campaigns ORDER BY updated_at::timestamptz DESC NULLS LAST, created_at::timestamptz DESC LIMIT $1',
      [_limit]
    );
    return rows.map(toCamelRow);
  } catch (err) {
    console.error('getRecentCampaigns error:', err);
    return [];
  }
}

export async function getSyncStatus() {
  try {
    const { rows } = await pool.query(`
      SELECT
        GREATEST(
          COALESCE((SELECT MAX(synced_at) FROM products), '1970-01-01'::timestamptz),
          COALESCE((SELECT MAX(synced_at) FROM blogs), '1970-01-01'::timestamptz),
          COALESCE((SELECT MAX(synced_at) FROM services), '1970-01-01'::timestamptz),
          COALESCE((SELECT MAX(synced_at) FROM jobs), '1970-01-01'::timestamptz),
          COALESCE((SELECT MAX(synced_at) FROM upwork_campaigns), '1970-01-01'::timestamptz),
          COALESCE((SELECT MAX(run_at) FROM sync_audit_log WHERE error IS NULL), '1970-01-01'::timestamptz)
        ) AS last_synced_at
    `);
    const value = rows[0]?.last_synced_at;
    return { lastSyncedAt: value && new Date(value).getFullYear() > 1970 ? value : null };
  } catch (err) {
    console.error('getSyncStatus error:', err);
    return { lastSyncedAt: null };
  }
}

export async function getRecentLogs(_limit = 10) {
  try {
    if (!(await tableExists('logs'))) {
      if (!(await tableExists('sync_audit_log'))) return [];

      const { rows } = await pool.query(
        `SELECT
          CASE WHEN error IS NULL THEN 'info' ELSE 'error' END AS level,
          CASE
            WHEN error IS NULL THEN table_name || ': synced ' || rows_synced || ' row(s)'
            ELSE table_name || ': ' || error
          END AS message,
          run_at AS timestamp
        FROM sync_audit_log
        ORDER BY run_at DESC
        LIMIT $1`,
        [_limit]
      );
      return rows;
    }

    const { rows } = await pool.query(
      `SELECT level, message, timestamp FROM logs ORDER BY timestamp DESC LIMIT $1`,
      [_limit]
    );
    return rows;
  } catch (err) {
    console.error('getRecentLogs error:', err);
    return [];
  }
}

// Sync audit log (for the listing site)
export async function getSyncAuditLog(limit = 20) {
  const rows = await safeRows('getSyncAuditLog',
    'SELECT id, run_at, table_name, rows_synced, duration_ms, error FROM sync_audit_log ORDER BY id DESC LIMIT $1',
    [limit]
  );
  return rows.map(toCamelRow);
}
