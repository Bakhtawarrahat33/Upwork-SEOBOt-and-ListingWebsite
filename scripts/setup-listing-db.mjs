import pg from 'pg';

const SRC_CONFIG = {
  host: 'localhost', port: 5432, user: 'postgres', password: '1234', database: 'upwork_jobs',
  max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000,
};

const DST_CONFIG = {
  host: 'localhost', port: 5432, user: 'postgres', password: '1234', database: 'listing_site',
  max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000,
};

async function createDatabase() {
  const adminPool = new pg.Pool({
    host: 'localhost', port: 5432, user: 'postgres', password: '1234', database: 'postgres',
    max: 1, connectionTimeoutMillis: 5000,
  });
  const { rows } = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = 'listing_site'");
  if (rows.length === 0) {
    await adminPool.query('CREATE DATABASE listing_site');
    console.log('✅ Created listing_site database');
  } else {
    console.log('ℹ️  listing_site database already exists');
  }
  await adminPool.end();
}

async function createTables() {
  const dstPool = new pg.Pool(DST_CONFIG);
  const client = await dstPool.connect();

  try {
    await client.query('BEGIN');

    // Drop existing tables to get clean schema
    await client.query('DROP TABLE IF EXISTS products, blogs, services, jobs, upwork_campaigns CASCADE');

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY, campaign_id TEXT, title TEXT, description TEXT,
        content TEXT, topics JSONB DEFAULT '[]'::jsonb,
        repo_url TEXT, status TEXT DEFAULT 'draft',
        created_at TEXT, updated_at TEXT,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Created products table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS blogs (
        id TEXT PRIMARY KEY, campaign_id TEXT, title TEXT,
        content TEXT, topics JSONB DEFAULT '[]'::jsonb,
        status TEXT DEFAULT 'draft', created_at TEXT, updated_at TEXT,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Created blogs table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY, campaign_id TEXT, title TEXT, description TEXT,
        content TEXT, topics JSONB DEFAULT '[]'::jsonb,
        status TEXT DEFAULT 'draft', created_at TEXT, updated_at TEXT,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Created services table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, campaign_id TEXT, title TEXT, description TEXT,
        niche TEXT, platform TEXT, tool TEXT, repo_url TEXT,
        upwork_job_url TEXT, viability TEXT DEFAULT 'Yes',
        created_at TEXT, updated_at TEXT,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Created jobs table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS upwork_campaigns (
        id TEXT PRIMARY KEY, category TEXT DEFAULT 'upwork', name TEXT,
        upwork_search_input TEXT, scrape_job_urls JSONB DEFAULT '[]'::jsonb,
        scrape_job_niche TEXT, gpt_account_id TEXT,
        time_coefficient TEXT DEFAULT 'balanced',
        delay_between_repos INTEGER DEFAULT 900000, repos_per_hour INTEGER DEFAULT 4,
        status TEXT DEFAULT 'Idle', progress JSONB DEFAULT '{}'::jsonb,
        results JSONB DEFAULT '[]'::jsonb, created_at TEXT, updated_at TEXT,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Created upwork_campaigns table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        campaign_id TEXT,
        level TEXT,
        message TEXT,
        timestamp BIGINT,
        created_at TEXT
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_logs_campaign ON logs(campaign_id, timestamp DESC)');
    console.log('Created logs table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_watermarks (
        table_name TEXT PRIMARY KEY,
        last_synced_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01 00:00:00+00'
      )
    `);

    const tables = ['product', 'blog', 'services', 'jobs_selected', 'upwork_campaigns'];
    for (const t of tables) {
      await client.query(
        `INSERT INTO sync_watermarks (table_name, last_synced_at) VALUES ($1, '1970-01-01 00:00:00+00')
         ON CONFLICT (table_name) DO NOTHING`,
        [t]
      );
    }
    console.log('✅ Created sync_watermarks table with initial entries');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_audit_log (
        id SERIAL PRIMARY KEY,
        run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        table_name TEXT NOT NULL,
        rows_synced INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        error TEXT
      )
    `);
    console.log('✅ Created sync_audit_log table');

    await client.query('COMMIT');
    console.log('\n🎉 All tables created successfully in listing_site database');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to create tables:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await dstPool.end();
  }
}

async function main() {
  await createDatabase();
  await createTables();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
