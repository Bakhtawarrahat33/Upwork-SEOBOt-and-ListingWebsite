import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'listing_site',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
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

// Products (from listing_site.products)
export async function getProducts() {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
  return rows.map(toCamelRow);
}

export async function getProductById(id: string) {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return rows.length ? toCamelRow(rows[0]) : null;
}

export async function createProduct(data: { title: string; description: string; content: string; topics?: string[]; status?: string }) {
  const { rows } = await pool.query(
    'INSERT INTO products (title, description, content, topics, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
    [data.title, data.description, data.content, JSON.stringify(data.topics || []), data.status || 'published']
  );
  return toCamelRow(rows[0]);
}

// Blogs (from listing_site.blogs)
export async function getBlogs() {
  const { rows } = await pool.query('SELECT * FROM blogs ORDER BY created_at DESC');
  return rows.map(toCamelRow);
}

export async function getBlogById(id: string) {
  const { rows } = await pool.query('SELECT * FROM blogs WHERE id = $1', [id]);
  return rows.length ? toCamelRow(rows[0]) : null;
}

export async function createBlog(data: { title: string; content: string; topics?: string[]; status?: string }) {
  const { rows } = await pool.query(
    'INSERT INTO blogs (title, content, topics, status, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
    [data.title, data.content, JSON.stringify(data.topics || []), data.status || 'published']
  );
  return toCamelRow(rows[0]);
}

// Services (from listing_site.services)
export async function getServices() {
  const { rows } = await pool.query('SELECT * FROM services ORDER BY created_at DESC');
  return rows.map(toCamelRow);
}

export async function getServiceById(id: string) {
  const { rows } = await pool.query('SELECT * FROM services WHERE id = $1', [id]);
  return rows.length ? toCamelRow(rows[0]) : null;
}

export async function createService(data: { title: string; description: string; content: string; topics?: string[]; status?: string }) {
  const { rows } = await pool.query(
    'INSERT INTO services (title, description, content, topics, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
    [data.title, data.description, data.content, JSON.stringify(data.topics || []), data.status || 'published']
  );
  return toCamelRow(rows[0]);
}

// Jobs (from listing_site.jobs)
export async function getJobs() {
  const { rows } = await pool.query('SELECT * FROM jobs ORDER BY created_at DESC');
  return rows.map(toCamelRow);
}

export async function getJobById(id: string) {
  const { rows } = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
  return rows.length ? toCamelRow(rows[0]) : null;
}

export async function createJob(data: { title: string; description: string; niche?: string; platform?: string; tool?: string; upworkJobUrl?: string }) {
  const { rows } = await pool.query(
    'INSERT INTO jobs (campaign_id, title, description, niche, platform, tool, upwork_job_url, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *',
    ['manual', data.title, data.description, data.niche || '', data.platform || '', data.tool || '', data.upworkJobUrl || '']
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
      'SELECT id, name, status, upwork_search_input as search, progress, created_at FROM upwork_campaigns ORDER BY created_at DESC LIMIT $1',
      [_limit]
    );
    return rows.map(toCamelRow);
  } catch (err) {
    console.error('getRecentCampaigns error:', err);
    return [];
  }
}

export async function getRecentLogs(_limit = 10) {
  try {
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
  const { rows } = await pool.query(
    'SELECT id, run_at, table_name, rows_synced, duration_ms, error FROM sync_audit_log ORDER BY id DESC LIMIT $1',
    [limit]
  );
  return rows.map(toCamelRow);
}
