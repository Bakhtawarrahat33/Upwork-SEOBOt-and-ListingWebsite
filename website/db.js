import pg from 'pg';

const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '1234',
  database: 'upwork_jobs',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

function toCamel(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}

export async function getProducts() {
  const { rows } = await pool.query('SELECT * FROM product ORDER BY created_at DESC');
  return rows.map(toCamel);
}

export async function getProductBySlug(slug) {
  const { rows } = await pool.query(
    "SELECT * FROM product WHERE id = $1 OR title = $1",
    [slug]
  );
  return rows.length ? toCamel(rows[0]) : null;
}

export async function getBlogPosts() {
  const { rows } = await pool.query('SELECT * FROM blog ORDER BY created_at DESC');
  return rows.map(toCamel);
}

export async function getBlogPostBySlug(slug) {
  const { rows } = await pool.query(
    "SELECT * FROM blog WHERE id = $1 OR title = $1",
    [slug]
  );
  return rows.length ? toCamel(rows[0]) : null;
}

export async function getServices() {
  const { rows } = await pool.query('SELECT * FROM services ORDER BY created_at DESC');
  return rows.map(toCamel);
}

export async function getServiceBySlug(slug) {
  const { rows } = await pool.query(
    "SELECT * FROM services WHERE id = $1 OR title = $1",
    [slug]
  );
  return rows.length ? toCamel(rows[0]) : null;
}

export async function getProcessedJobs() {
  const { rows } = await pool.query('SELECT * FROM processed_jobs ORDER BY created_at DESC');
  return rows.map(toCamel);
}

export async function getSelectedJobs() {
  const { rows } = await pool.query('SELECT * FROM jobs_selected ORDER BY created_at DESC');
  return rows.map(toCamel);
}
