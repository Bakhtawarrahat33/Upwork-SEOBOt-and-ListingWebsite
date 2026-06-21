import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';

const POOL_CONFIG = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '1234',
  database: 'upwork_jobs',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
};

const LISTING_POOL_CONFIG = {
  host: process.env.LISTING_DB_HOST || 'localhost',
  port: Number(process.env.LISTING_DB_PORT) || 5432,
  user: process.env.LISTING_DB_USER || 'postgres',
  password: process.env.LISTING_DB_PASSWORD || '1234',
  database: process.env.LISTING_DB_NAME || 'listing_site',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

const LISTING_MIRRORS = {
  upwork_campaigns: {
    target: 'upwork_campaigns',
    columns: ['id','category','name','upwork_search_input','scrape_job_urls','scrape_job_niche','gpt_account_id','time_coefficient','delay_between_repos','repos_per_hour','status','progress','results','created_at','updated_at'],
  },
  jobs_selected: {
    target: 'jobs',
    columns: ['id','campaign_id','title','description','niche','platform','tool','repo_url','upwork_job_url','viability','created_at','updated_at'],
  },
  product: {
    target: 'products',
    columns: ['id','campaign_id','title','description','content','topics','repo_url','status','created_at','updated_at'],
  },
  blog: {
    target: 'blogs',
    columns: ['id','campaign_id','title','content','topics','status','created_at','updated_at'],
  },
  services: {
    target: 'services',
    columns: ['id','campaign_id','title','description','content','topics','status','created_at','updated_at'],
  },
};

const TABLES = `CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, name TEXT, category TEXT,
  gpt_account_id TEXT, keywords TEXT, questions TEXT, apify_urls TEXT,
  va_repo_type TEXT, va_platform TEXT, va_single_repo_descriptions TEXT,
  va_multiple_repo_descriptions TEXT, time_coefficient TEXT,
  delay_between_repos INTEGER DEFAULT 900000, repos_per_hour INTEGER DEFAULT 4,
  status TEXT DEFAULT 'Idle', progress JSONB DEFAULT '{}'::jsonb,
  results JSONB DEFAULT '[]'::jsonb, created_at TEXT, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_campaigns_id ON campaigns(id);

CREATE TABLE IF NOT EXISTS upwork_campaigns (
  id TEXT PRIMARY KEY, category TEXT DEFAULT 'upwork', name TEXT,
  upwork_search_input TEXT, scrape_job_urls JSONB DEFAULT '[]'::jsonb,
  scrape_job_niche TEXT, gpt_account_id TEXT,
  time_coefficient TEXT DEFAULT 'balanced',
  delay_between_repos INTEGER DEFAULT 900000, repos_per_hour INTEGER DEFAULT 4,
  status TEXT DEFAULT 'Idle', progress JSONB DEFAULT '{}'::jsonb,
  results JSONB DEFAULT '[]'::jsonb, created_at TEXT, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_upwork_campaigns_id ON upwork_campaigns(id);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY, campaign_id TEXT, level TEXT, message TEXT,
  timestamp BIGINT, created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_campaign ON logs(campaign_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS gpt_accounts (
  id TEXT PRIMARY KEY, name TEXT, cookies JSONB,
  created_at TEXT, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_gpt_accounts_id ON gpt_accounts(id);

CREATE TABLE IF NOT EXISTS processed_jobs (
  id TEXT, title TEXT, normalized_title TEXT, description TEXT,
  campaign_id TEXT, niche TEXT, platform TEXT, tool TEXT,
  repo_url TEXT, created_at TEXT, upwork_job_url TEXT,
  viable BOOLEAN DEFAULT true, rejection_reason TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_jobs_id ON processed_jobs(id);
CREATE INDEX IF NOT EXISTS idx_processed_jobs_norm ON processed_jobs(normalized_title);
CREATE INDEX IF NOT EXISTS idx_processed_jobs_campaign ON processed_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_processed_jobs_created ON processed_jobs(created_at DESC);

CREATE TABLE IF NOT EXISTS data_to_export (
  id TEXT PRIMARY KEY, campaign_id TEXT, title TEXT, description TEXT,
  topics JSONB DEFAULT '[]'::jsonb, readme TEXT, category TEXT,
  platform_domain TEXT, created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_data_to_export_campaign ON data_to_export(campaign_id);
CREATE INDEX IF NOT EXISTS idx_data_to_export_created ON data_to_export(created_at DESC);

CREATE TABLE IF NOT EXISTS jobs_selected (
  id TEXT PRIMARY KEY, campaign_id TEXT, title TEXT, description TEXT,
  niche TEXT, platform TEXT, tool TEXT, repo_url TEXT,
  upwork_job_url TEXT, viability TEXT DEFAULT 'Yes',
  created_at TEXT, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_selected_id ON jobs_selected(id);
CREATE INDEX IF NOT EXISTS idx_jobs_selected_campaign ON jobs_selected(campaign_id);

CREATE TABLE IF NOT EXISTS product (
  id TEXT PRIMARY KEY, campaign_id TEXT, title TEXT, description TEXT,
  content TEXT, topics JSONB DEFAULT '[]'::jsonb, repo_url TEXT,
  status TEXT DEFAULT 'draft', created_at TEXT, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_product_id ON product(id);
CREATE INDEX IF NOT EXISTS idx_product_campaign ON product(campaign_id);

CREATE TABLE IF NOT EXISTS blog (
  id TEXT PRIMARY KEY, campaign_id TEXT, title TEXT, content TEXT,
  topics JSONB DEFAULT '[]'::jsonb, status TEXT DEFAULT 'draft',
  created_at TEXT, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_blog_id ON blog(id);
CREATE INDEX IF NOT EXISTS idx_blog_campaign ON blog(campaign_id);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY, campaign_id TEXT, title TEXT, description TEXT,
  content TEXT, topics JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft', created_at TEXT, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_services_id ON services(id);
CREATE INDEX IF NOT EXISTS idx_services_campaign ON services(campaign_id);`;

class Storage {
  constructor() {
    this.pool = null;
    this.listingPool = null;
    this.connected = false;
    this._connectPromise = null;
  }

  _dbVal(v) {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'object' && !Array.isArray(v)) return JSON.stringify(v);
    if (Array.isArray(v)) return JSON.stringify(v);
    return v;
  }

  _maybeParse(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const camel = this._toCamel(obj);
    for (const [k, v] of Object.entries(camel)) {
      if (typeof v === 'string') {
        try { camel[k] = JSON.parse(v); } catch {}
      }
    }
    return camel;
  }

  async _getListingPool() {
    if (this.listingPool) return this.listingPool;
    this.listingPool = new pg.Pool(LISTING_POOL_CONFIG);
    this.listingPool.on('error', (err) => {
      console.warn('Listing DB pool error:', err.message);
    });
    return this.listingPool;
  }

  async _mirrorToListing(sourceTable, row) {
    const mapping = LISTING_MIRRORS[sourceTable];
    if (!mapping || !row) return;

    try {
      const pool = await this._getListingPool();
      const cols = mapping.columns;
      const colSql = cols.join(', ');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const updates = cols
        .filter(c => c !== 'id')
        .map(c => `"${c}" = EXCLUDED."${c}"`)
        .concat('synced_at = NOW()')
        .join(', ');
      const values = cols.map(c => this._dbVal(row[c]));

      await pool.query(
        `INSERT INTO ${mapping.target} (${colSql}, synced_at)
         VALUES (${placeholders}, NOW())
         ON CONFLICT (id) DO UPDATE SET ${updates}`,
        values
      );
    } catch (error) {
      console.warn(`Listing DB mirror skipped for ${sourceTable}: ${error.message}`);
    }
  }

  async _deleteFromListing(sourceTable, id) {
    const mapping = LISTING_MIRRORS[sourceTable];
    if (!mapping || !id) return;

    try {
      const pool = await this._getListingPool();
      await pool.query(`DELETE FROM ${mapping.target} WHERE id = $1`, [id]);
    } catch (error) {
      console.warn(`Listing DB delete skipped for ${sourceTable}: ${error.message}`);
    }
  }

  async connect() {
    if (this.connected) return;
    if (this._connectPromise) return this._connectPromise;

    this._connectPromise = (async () => {
      const MAX_RETRIES = 5;
      const RETRY_DELAY = 3000;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`🔌 PostgreSQL connection attempt ${attempt}/${MAX_RETRIES}...`);

          this.pool = new pg.Pool(POOL_CONFIG);

          this.pool.on('error', (err) => {
            console.error('⚠️ PostgreSQL pool error:', err.message);
          });

          const client = await this.pool.connect();
          client.release();

          await this._initTables();
          this.connected = true;
          console.log('✅ PostgreSQL connected successfully');
          return;

        } catch (error) {
          console.error(`❌ Connection attempt ${attempt} failed: ${error.message}`);

          if (this.pool) {
            await this.pool.end().catch(() => {});
            this.pool = null;
          }

          if (attempt < MAX_RETRIES) {
            console.log(`⏳ Retrying in ${RETRY_DELAY / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          } else {
            console.error('❌ All PostgreSQL connection attempts failed');
            this._connectPromise = null;
            throw new Error(`PostgreSQL connection failed after ${MAX_RETRIES} attempts: ${error.message}`);
          }
        }
      }
    })();

    return this._connectPromise;
  }

  async _initTables() {
    const client = await this.pool.connect();
    try {
      // Drop old unused tables
      const dropTables = [
        'stars_campaigns', 'indexer_campaigns', 'view_campaigns'
      ];
      for (const table of dropTables) {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      }

      // Remove old columns from existing tables (schema cleanup)
      await client.query('ALTER TABLE campaigns DROP COLUMN IF EXISTS account_group_id');
      await client.query('ALTER TABLE upwork_campaigns DROP COLUMN IF EXISTS account_group_id');

      const statements = TABLES.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of statements) {
        try {
          await client.query(stmt + ';');
        } catch (createErr) {
          // Skip if table already exists (handles edge cases where pg_type conflicts)
          if (createErr.code === '23505' && createErr.constraint === 'pg_type_typname_nsp_index') {
            console.warn(`Skipping table creation (already exists): ${stmt.substring(0, 60)}...`);
          } else {
            throw createErr;
          }
        }
      }

      await client.query("ALTER TABLE gpt_accounts ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false");
      await client.query("ALTER TABLE gpt_accounts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'");
      await client.query("ALTER TABLE processed_jobs ADD COLUMN IF NOT EXISTS viable BOOLEAN DEFAULT true");
      await client.query("ALTER TABLE processed_jobs ADD COLUMN IF NOT EXISTS rejection_reason TEXT");
    } finally {
      client.release();
    }
  }

  async ensureConnected() {
    if (!this.connected) await this.connect();
  }

  // ==================== Campaign Operations ====================
  async getCampaigns() {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
      return rows.map(r => this._maybeParse(r));
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      throw error;
    }
  }

  async getCampaign(id) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM campaigns WHERE id = $1', [id]);
      return rows.length ? this._maybeParse(rows[0]) : null;
    } catch (error) {
      console.error('Error fetching campaign:', error);
      throw error;
    }
  }

  async createCampaign(campaignData) {
    await this.ensureConnected();
    try {
      let totalItems = 0;
      if (campaignData.category === 'apify') {
        totalItems = campaignData.apifyUrls?.split('\n').filter(l => l.trim()).length || 0;
      } else if (campaignData.category === 'va') {
        totalItems = campaignData.vaRepoType === 'single'
          ? 1
          : campaignData.vaMultipleRepoDescriptions?.split('\n').filter(l => l.trim()).length || 0;
      } else {
        totalItems = campaignData.keywords?.split('\n').filter(l => l.trim()).length || 0;
      }

      const now = new Date().toISOString();
      const campaign = {
        id: uuidv4(),
        name: campaignData.name,
        category: campaignData.category || 'keywords',
        gpt_account_id: campaignData.gptAccountId,
        keywords: campaignData.keywords || '',
        questions: campaignData.questions || '',
        apify_urls: campaignData.apifyUrls || '',
        va_repo_type: campaignData.vaRepoType,
        va_platform: campaignData.vaPlatform || 'bitbash',
        va_single_repo_descriptions: campaignData.vaSingleRepoDescriptions || '',
        va_multiple_repo_descriptions: campaignData.vaMultipleRepoDescriptions || '',
        time_coefficient: campaignData.timeCoefficient || 'balanced',
        delay_between_repos: campaignData.delayBetweenRepos || 900000,
        repos_per_hour: campaignData.reposPerHour || 4,
        status: 'Idle',
        progress: JSON.stringify({ processed: 0, total: totalItems }),
        results: JSON.stringify([]),
        created_at: now,
        updated_at: now,
      };

      const { rowCount } = await this.pool.query(
        `INSERT INTO campaigns (id, name, category, gpt_account_id,
         keywords, questions, apify_urls, va_repo_type, va_platform,
         va_single_repo_descriptions, va_multiple_repo_descriptions,
         time_coefficient, delay_between_repos, repos_per_hour,
         status, progress, results, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,$20)`,
        [campaign.id, campaign.name, campaign.category,
         campaign.gpt_account_id, campaign.keywords, campaign.questions,
         campaign.apify_urls, campaign.va_repo_type, campaign.va_platform,
         campaign.va_single_repo_descriptions, campaign.va_multiple_repo_descriptions,
         campaign.time_coefficient, campaign.delay_between_repos, campaign.repos_per_hour,
         campaign.status, campaign.progress, campaign.results, campaign.created_at, campaign.updated_at]
      );

      if (rowCount === 0) throw new Error('Failed to insert campaign');
      return this._maybeParse(this._toCamel(campaign));
    } catch (error) {
      console.error('Error creating campaign:', error);
      throw error;
    }
  }

  async updateCampaign(id, updates) {
    await this.ensureConnected();
    try {
      updates.updatedAt = new Date().toISOString();
      const row = await this._update('campaigns', id, updates);
      if (!row) throw new Error(`Campaign ${id} not found`);
      return this._maybeParse(row);
    } catch (error) {
      console.error('Error updating campaign:', error);
      throw error;
    }
  }

  async deleteCampaign(id) {
    await this.ensureConnected();
    try {
      await this.pool.query('DELETE FROM logs WHERE campaign_id = $1', [id]);
      const { rowCount } = await this.pool.query('DELETE FROM campaigns WHERE id = $1', [id]);
      if (rowCount === 0) throw new Error(`Campaign ${id} not found`);
      return true;
    } catch (error) {
      console.error('Error deleting campaign:', error);
      throw error;
    }
  }

  // ==================== Logs Operations ====================
  async appendLog(campaignId, logEntry) {
    await this.ensureConnected();
    try {
      const log = {
        id: uuidv4(),
        campaign_id: campaignId,
        level: logEntry.level,
        message: logEntry.message,
        timestamp: logEntry.timestamp || Date.now(),
        created_at: new Date().toISOString(),
      };
      await this.pool.query(
        'INSERT INTO logs (id, campaign_id, level, message, timestamp, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [log.id, log.campaign_id, log.level, log.message, log.timestamp, log.created_at]
      );
      return this._toCamel(log);
    } catch (error) {
      console.error('Error appending log:', error);
    }
  }

  async getLogs(campaignId, since = 0) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query(
        'SELECT * FROM logs WHERE campaign_id = $1 AND timestamp > $2 ORDER BY timestamp ASC',
        [campaignId, since]
      );
      return rows;
    } catch (error) {
      console.error('Error fetching logs:', error);
      throw error;
    }
  }

  async clearLogs(campaignId) {
    await this.ensureConnected();
    try {
      await this.pool.query('DELETE FROM logs WHERE campaign_id = $1', [campaignId]);
      return true;
    } catch (error) {
      console.error('Error clearing logs:', error);
      throw error;
    }
  }

  // ==================== GPT Accounts Operations ====================
  async getGPTAccounts() {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM gpt_accounts ORDER BY created_at DESC');
      return rows.map(r => this._maybeParse(r));
    } catch (error) {
      console.error('Error getting GPT accounts:', error);
      throw error;
    }
  }

  async getGPTAccount(id) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM gpt_accounts WHERE id = $1', [id]);
      if (!rows.length) return null;
      return this._maybeParse(rows[0]);
    } catch (error) {
      console.error('Error getting GPT account:', error);
      throw error;
    }
  }

  async createGPTAccount(data) {
    await this.ensureConnected();
    try {
      const now = new Date().toISOString();
      // If no accounts exist yet, make this one the default
      const { rows: existing } = await this.pool.query('SELECT COUNT(*)::int as cnt FROM gpt_accounts');
      const isDefault = data.isDefault !== undefined ? data.isDefault : (existing[0]?.cnt === 0);
      const account = {
        id: nanoid(),
        name: data.name,
        cookies: this._dbVal(data.cookies),
        is_default: isDefault,
        status: data.status || 'active',
        created_at: now,
        updated_at: now,
      };
      await this.pool.query(
        `INSERT INTO gpt_accounts (id, name, cookies, is_default, status, created_at, updated_at) VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7)`,
        [account.id, account.name, account.cookies, account.is_default, account.status, account.created_at, account.updated_at]
      );
      return account;
    } catch (error) {
      console.error('Error creating GPT account:', error);
      throw error;
    }
  }

  async updateGPTAccount(id, updates) {
    await this.ensureConnected();
    try {
      updates.updatedAt = new Date().toISOString();
      const row = await this._update('gpt_accounts', id, updates);
      if (!row) throw new Error('GPT account not found');
      return true;
    } catch (error) {
      console.error('Error updating GPT account:', error);
      throw error;
    }
  }

  async deleteGPTAccount(id) {
    await this.ensureConnected();
    try {
      const { rowCount } = await this.pool.query('DELETE FROM gpt_accounts WHERE id = $1', [id]);
      if (rowCount === 0) throw new Error('GPT account not found');
      return true;
    } catch (error) {
      console.error('Error deleting GPT account:', error);
      throw error;
    }
  }

  // ==================== Upwork Campaign Operations ====================
  async getUpworkCampaigns() {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM upwork_campaigns');
      return rows.map(r => this._maybeParse(r));
    } catch (error) {
      console.error('Error fetching Upwork campaigns:', error);
      throw error;
    }
  }

  async getPipelineSyncStatus() {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query(`
        SELECT MAX(ts) AS last_source_update_at
        FROM (
          SELECT updated_at::timestamptz AS ts FROM upwork_campaigns WHERE updated_at IS NOT NULL
          UNION ALL SELECT updated_at::timestamptz FROM product WHERE updated_at IS NOT NULL
          UNION ALL SELECT updated_at::timestamptz FROM blog WHERE updated_at IS NOT NULL
          UNION ALL SELECT updated_at::timestamptz FROM services WHERE updated_at IS NOT NULL
          UNION ALL SELECT updated_at::timestamptz FROM jobs_selected WHERE updated_at IS NOT NULL
        ) updates
      `);
      return this._maybeParse(rows[0] || { last_source_update_at: null });
    } catch (error) {
      console.error('Error fetching pipeline sync status:', error);
      return { lastSourceUpdateAt: null };
    }
  }

  async getUpworkCampaign(id) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM upwork_campaigns WHERE id = $1', [id]);
      if (!rows.length) throw new Error('Upwork campaign not found');
      return this._maybeParse(rows[0]);
    } catch (error) {
      console.error('Error fetching Upwork campaign:', error);
      throw error;
    }
  }

  async createUpworkCampaign(campaignData) {
    await this.ensureConnected();
    try {
      const now = new Date().toISOString();
      const campaign = {
        id: nanoid(),
        name: campaignData.name,
        category: 'upwork',
        upwork_search_input: campaignData.upworkSearchInput,
        gpt_account_id: campaignData.gptAccountId,
        time_coefficient: campaignData.timeCoefficient || 'balanced',
        delay_between_repos: campaignData.delayBetweenRepos || 900000,
        repos_per_hour: campaignData.reposPerHour || 4,
        status: 'Idle',
        progress: { processed: 0, total: 0, viable: 0, nonViable: 0 },
        results: [],
        created_at: now,
        updated_at: now,
      };

      const { rowCount } = await this.pool.query(
        `INSERT INTO upwork_campaigns (id, name, category, upwork_search_input,
         gpt_account_id, time_coefficient, delay_between_repos, repos_per_hour,
         status, progress, results, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [campaign.id, campaign.name, campaign.category, campaign.upwork_search_input,
         campaign.gpt_account_id, campaign.time_coefficient,
         campaign.delay_between_repos, campaign.repos_per_hour, campaign.status,
         campaign.progress, campaign.results, campaign.created_at, campaign.updated_at]
      );

      if (rowCount === 0) throw new Error('Failed to create Upwork campaign');
      await this._mirrorToListing('upwork_campaigns', campaign);
      return this._maybeParse(this._toCamel(campaign));
    } catch (error) {
      console.error('Error creating Upwork campaign:', error.message, error.detail, error.hint, error.where);
      throw error;
    }
  }

  async updateUpworkCampaign(id, updates) {
    await this.ensureConnected();
    try {
      updates.updatedAt = new Date().toISOString();
      const row = await this._update('upwork_campaigns', id, updates);
      if (!row) throw new Error('Upwork campaign not found');
      await this._mirrorToListing('upwork_campaigns', row);
      return this._maybeParse(row);
    } catch (error) {
      console.error('Error updating Upwork campaign:', error);
      throw error;
    }
  }

  async deleteUpworkCampaign(id) {
    await this.ensureConnected();
    try {
      await this.pool.query('DELETE FROM logs WHERE campaign_id = $1', [id]);
      await this.pool.query('DELETE FROM upwork_campaigns WHERE id = $1', [id]);
      await this._deleteFromListing('upwork_campaigns', id);
    } catch (error) {
      console.error('Error deleting Upwork campaign:', error);
      throw error;
    }
  }

  // ==================== Scrape Jobs Campaign Operations ====================
  async getScrapeJobsCampaigns() {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query("SELECT * FROM upwork_campaigns WHERE category = 'scrape-jobs'");
      return rows.map(r => this._maybeParse(r));
    } catch (error) {
      console.error('Error fetching scrape-jobs campaigns:', error);
      throw error;
    }
  }

  async getScrapeJobsCampaign(id) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query(
        "SELECT * FROM upwork_campaigns WHERE id = $1 AND category = 'scrape-jobs'", [id]
      );
      if (!rows.length) throw new Error('Scrape-jobs campaign not found');
      return this._maybeParse(rows[0]);
    } catch (error) {
      console.error('Error fetching scrape-jobs campaign:', error);
      throw error;
    }
  }

  async createScrapeJobsCampaign(campaignData) {
    await this.ensureConnected();
    try {
      const jobEntries = campaignData.scrapeJobUrls
        .split('---')
        .map(job => job.trim())
        .filter(job => job.length > 0);

      const now = new Date().toISOString();
      const campaign = {
        id: nanoid(),
        name: campaignData.name,
        category: 'scrape-jobs',
        scrape_job_urls: jobEntries,
        scrape_job_niche: campaignData.scrapeJobNiche,
        gpt_account_id: campaignData.gptAccountId,
        time_coefficient: campaignData.timeCoefficient || 'balanced',
        delay_between_repos: campaignData.delayBetweenRepos || 900000,
        repos_per_hour: campaignData.reposPerHour || 4,
        status: 'Idle',
        progress: { processed: 0, total: jobEntries.length, viable: 0, nonViable: 0, duplicates: 0 },
        results: [],
        created_at: now,
        updated_at: now,
      };

      const { rowCount } = await this.pool.query(
        `INSERT INTO upwork_campaigns (id, name, category, scrape_job_urls, scrape_job_niche,
         gpt_account_id, time_coefficient, delay_between_repos,
         repos_per_hour, status, progress, results, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [campaign.id, campaign.name, campaign.category, campaign.scrape_job_urls,
         campaign.scrape_job_niche, campaign.gpt_account_id,
         campaign.time_coefficient, campaign.delay_between_repos, campaign.repos_per_hour,
         campaign.status, campaign.progress, campaign.results,
         campaign.created_at, campaign.updated_at]
      );

      if (rowCount === 0) throw new Error('Failed to create scrape-jobs campaign');
      await this._mirrorToListing('upwork_campaigns', campaign);
      return this._maybeParse(this._toCamel(campaign));
    } catch (error) {
      console.error('Error creating scrape-jobs campaign:', error);
      throw error;
    }
  }

  async updateScrapeJobsCampaign(id, updates) {
    await this.ensureConnected();
    try {
      updates.updatedAt = new Date().toISOString();
      const row = await this._updateScoped('upwork_campaigns', id, updates, { category: 'scrape-jobs' });
      if (!row) throw new Error('Scrape-jobs campaign not found');
      await this._mirrorToListing('upwork_campaigns', row);
      return this._maybeParse(row);
    } catch (error) {
      console.error('Error updating scrape-jobs campaign:', error);
      throw error;
    }
  }

  async deleteScrapeJobsCampaign(id) {
    await this.ensureConnected();
    try {
      await this.pool.query('DELETE FROM logs WHERE campaign_id = $1', [id]);
      const { rowCount } = await this.pool.query(
        "DELETE FROM upwork_campaigns WHERE id = $1 AND category = 'scrape-jobs'", [id]
      );
      if (rowCount > 0) await this._deleteFromListing('upwork_campaigns', id);
      if (rowCount === 0) throw new Error('Scrape-jobs campaign not found');
    } catch (error) {
      console.error('Error deleting scrape-jobs campaign:', error);
      throw error;
    }
  }

  // ==================== Processed Jobs Operations ====================
  normalizeJobTitle(title) {
    if (!title) return '';
    return title.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1;
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  async checkJobDuplicate(title, description, similarityThreshold = 0.85) {
    await this.ensureConnected();
    try {
      const normalizedTitle = this.normalizeJobTitle(title);
      if (!normalizedTitle) return null;

      const { rows: exactRows } = await this.pool.query(
        'SELECT * FROM processed_jobs WHERE normalized_title = $1 LIMIT 1',
        [normalizedTitle]
      );
      if (exactRows.length > 0) return exactRows[0];

      const { rows: allJobs } = await this.pool.query(
        'SELECT * FROM processed_jobs ORDER BY created_at DESC LIMIT 1000'
      );

      for (const job of allJobs) {
        const titleSimilarity = this.calculateSimilarity(normalizedTitle, job.normalized_title);
        if (titleSimilarity >= similarityThreshold) return job;

        if (description && job.description) {
          const desc1 = this.normalizeJobTitle(description.substring(0, 200));
          const desc2 = this.normalizeJobTitle(job.description.substring(0, 200));
          const descSimilarity = this.calculateSimilarity(desc1, desc2);
          if (titleSimilarity >= 0.7 && descSimilarity >= 0.8) return job;
        }
      }
      return null;
    } catch (error) {
      console.error('Error checking job duplicate:', error);
      return null;
    }
  }

  async checkDuplicateByJobId(jobId) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query(
        'SELECT id FROM processed_jobs WHERE id = $1 LIMIT 1',
        [jobId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error checking job ID duplicate:', error);
      return null;
    }
  }

  async storeProcessedJob(jobData) {
    await this.ensureConnected();
    try {
      const normalizedTitle = this.normalizeJobTitle(jobData.title);
      const job = {
        id: jobData.id || jobData.ciphertext,
        title: jobData.title,
        normalized_title: normalizedTitle,
        description: jobData.description,
        campaign_id: jobData.campaignId,
        niche: jobData.niche || null,
        platform: jobData.platform || null,
        tool: jobData.tool || null,
        repo_url: jobData.repoUrl,
        created_at: new Date().toISOString(),
        upwork_job_url: jobData.upworkJobUrl,
        viable: jobData.viable !== undefined ? jobData.viable : true,
        rejection_reason: jobData.rejectionReason || null,
      };
      await this.pool.query(
        `INSERT INTO processed_jobs (id, title, normalized_title, description, campaign_id, niche, platform, tool, repo_url, created_at, upwork_job_url, viable, rejection_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO NOTHING`,
        [job.id, job.title, job.normalized_title, job.description, job.campaign_id,
         job.niche, job.platform, job.tool, job.repo_url, job.created_at, job.upwork_job_url,
         job.viable, job.rejection_reason]
      );
      return job;
    } catch (error) {
      console.error('Error storing processed job:', error);
      throw error;
    }
  }

  async getProcessedJobsForCampaign(campaignId) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query(
        'SELECT * FROM processed_jobs WHERE campaign_id = $1 ORDER BY created_at DESC',
        [campaignId]
      );
      return rows;
    } catch (error) {
      console.error('Error fetching processed jobs:', error);
      return [];
    }
  }

  async getProcessedJobsStats() {
    await this.ensureConnected();
    try {
      const { rows: countRows } = await this.pool.query('SELECT COUNT(*) as count FROM processed_jobs');
      const total = parseInt(countRows[0].count, 10);

      const { rows: nicheRows } = await this.pool.query(
        'SELECT niche, COUNT(*) as count FROM processed_jobs WHERE niche IS NOT NULL GROUP BY niche ORDER BY count DESC'
      );
      const byNiche = nicheRows.reduce((acc, r) => { acc[r.niche] = parseInt(r.count, 10); return acc; }, {});

      return { totalProcessed: total, byNiche };
    } catch (error) {
      console.error('Error fetching processed jobs stats:', error);
      return { totalProcessed: 0, byNiche: {} };
    }
  }

  async clearOldProcessedJobs(daysOld = 30) {
    await this.ensureConnected();
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const { rowCount } = await this.pool.query(
        'DELETE FROM processed_jobs WHERE created_at < $1',
        [cutoffDate.toISOString()]
      );
      return rowCount;
    } catch (error) {
      console.error('Error clearing old processed jobs:', error);
      return 0;
    }
  }

  // ==================== Data To Export Operations ====================
  async storeDataToExport(exportData) {
    await this.ensureConnected();
    try {
      const data = {
        id: nanoid(),
        campaign_id: exportData.campaignId,
        title: exportData.title,
        description: exportData.description,
        topics: JSON.stringify(exportData.topics || []),
        readme: exportData.readme,
        category: exportData.category,
        platform_domain: exportData.platformDomain || 'None',
        created_at: new Date().toISOString(),
      };
      await this.pool.query(
        `INSERT INTO data_to_export (id, campaign_id, title, description, topics, readme, category, platform_domain, created_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)`,
        [data.id, data.campaign_id, data.title, data.description,
         data.topics, data.readme, data.category, data.platform_domain, data.created_at]
      );
      return data;
    } catch (error) {
      console.error('Error storing data to export:', error);
      throw error;
    }
  }

  async getExportDataByCampaign(campaignId) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query(
        'SELECT * FROM data_to_export WHERE campaign_id = $1 ORDER BY created_at DESC',
        [campaignId]
      );
      return rows.map(r => this._maybeParse(r));
    } catch (error) {
      console.error('Error fetching export data:', error);
      throw error;
    }
  }

  async getAllExportData() {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM data_to_export ORDER BY created_at DESC');
      return rows.map(r => this._maybeParse(r));
    } catch (error) {
      console.error('Error fetching all export data:', error);
      throw error;
    }
  }

  async deleteExportDataByCampaign(campaignId) {
    await this.ensureConnected();
    try {
      await this.pool.query('DELETE FROM data_to_export WHERE campaign_id = $1', [campaignId]);
    } catch (error) {
      console.error('Error deleting export data:', error);
      throw error;
    }
  }

  // ==================== Jobs Selected Operations ====================
  async getJobsSelected() {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM jobs_selected ORDER BY created_at DESC');
      return rows;
    } catch (error) {
      console.error('Error fetching jobs selected:', error);
      throw error;
    }
  }

  async getJobsSelectedByCampaign(campaignId) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query(
        'SELECT * FROM jobs_selected WHERE campaign_id = $1 ORDER BY created_at DESC', [campaignId]
      );
      return rows;
    } catch (error) {
      console.error('Error fetching jobs selected by campaign:', error);
      return [];
    }
  }

  async getJobsSelectedById(id) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM jobs_selected WHERE id = $1', [id]);
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error fetching jobs selected by id:', error);
      throw error;
    }
  }

  async createJobsSelected(data) {
    await this.ensureConnected();
    try {
      const now = new Date().toISOString();
      const job = {
        id: nanoid(),
        campaign_id: data.campaignId,
        title: data.title,
        description: data.description,
        niche: data.niche || null,
        platform: data.platform || null,
        tool: data.tool || null,
        repo_url: data.repoUrl || null,
        upwork_job_url: data.upworkJobUrl || null,
        viability: 'Yes',
        created_at: now,
        updated_at: now,
      };
      await this.pool.query(
        `INSERT INTO jobs_selected (id, campaign_id, title, description, niche, platform, tool, repo_url, upwork_job_url, viability, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [job.id, job.campaign_id, job.title, job.description, job.niche, job.platform,
         job.tool, job.repo_url, job.upwork_job_url, job.viability, job.created_at, job.updated_at]
      );
      await this._mirrorToListing('jobs_selected', job);
      return job;
    } catch (error) {
      console.error('Error creating jobs selected:', error);
      throw error;
    }
  }

  async updateJobsSelected(id, updates) {
    await this.ensureConnected();
    try {
      updates.updatedAt = new Date().toISOString();
      const row = await this._update('jobs_selected', id, updates);
      if (!row) throw new Error(`Jobs selected ${id} not found`);
      await this._mirrorToListing('jobs_selected', row);
      return row;
    } catch (error) {
      console.error('Error updating jobs selected:', error);
      throw error;
    }
  }

  async deleteJobsSelected(id) {
    await this.ensureConnected();
    try {
      const { rowCount } = await this.pool.query('DELETE FROM jobs_selected WHERE id = $1', [id]);
      if (rowCount > 0) await this._deleteFromListing('jobs_selected', id);
      if (rowCount === 0) throw new Error(`Jobs selected ${id} not found`);
      return true;
    } catch (error) {
      console.error('Error deleting jobs selected:', error);
      throw error;
    }
  }

  // ==================== Product Operations ====================
  async getProducts() {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM product ORDER BY created_at DESC');
      return rows.map(r => this._maybeParse(r));
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  async getProductsByCampaign(campaignId) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query(
        'SELECT * FROM product WHERE campaign_id = $1 ORDER BY created_at DESC', [campaignId]
      );
      return rows.map(r => this._maybeParse(r));
    } catch (error) {
      console.error('Error fetching products by campaign:', error);
      return [];
    }
  }

  async getProduct(id) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM product WHERE id = $1', [id]);
      return rows.length ? this._maybeParse(rows[0]) : null;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  }

  async createProduct(data) {
    await this.ensureConnected();
    try {
      const now = new Date().toISOString();
      if (data.title) {
        const existing = await this.pool.query(
          'SELECT * FROM product WHERE title = $1 LIMIT 1',
          [data.title]
        );
        if (existing.rows.length > 0) {
          await this._mirrorToListing('product', existing.rows[0]);
          return this._maybeParse(existing.rows[0]);
        }
      }
      const product = {
        id: nanoid(),
        campaign_id: data.campaignId,
        title: data.title,
        description: data.description || '',
        content: data.content || '',
        topics: this._dbVal(data.topics || []),
        repo_url: data.repoUrl || null,
        status: data.status || 'draft',
        created_at: now,
        updated_at: now,
      };
      await this.pool.query(
        `INSERT INTO product (id, campaign_id, title, description, content, topics, repo_url, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`,
        [product.id, product.campaign_id, product.title, product.description,
         product.content, product.topics, product.repo_url, product.status,
         product.created_at, product.updated_at]
      );
      await this._mirrorToListing('product', product);
      return product;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(id, updates) {
    await this.ensureConnected();
    try {
      updates.updatedAt = new Date().toISOString();
      const row = await this._update('product', id, updates);
      if (!row) throw new Error(`Product ${id} not found`);
      await this._mirrorToListing('product', row);
      return this._maybeParse(row);
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  async deleteProduct(id) {
    await this.ensureConnected();
    try {
      const { rowCount } = await this.pool.query('DELETE FROM product WHERE id = $1', [id]);
      if (rowCount > 0) await this._deleteFromListing('product', id);
      if (rowCount === 0) throw new Error(`Product ${id} not found`);
      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // ==================== Blog Operations ====================
  async getBlogPosts() {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM blog ORDER BY created_at DESC');
      return rows.map(r => this._maybeParse(r));
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      throw error;
    }
  }

  async getBlogPostsByCampaign(campaignId) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query(
        'SELECT * FROM blog WHERE campaign_id = $1 ORDER BY created_at DESC', [campaignId]
      );
      return rows.map(r => this._maybeParse(r));
    } catch (error) {
      console.error('Error fetching blog posts by campaign:', error);
      return [];
    }
  }

  async getBlogPost(id) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM blog WHERE id = $1', [id]);
      return rows.length ? this._maybeParse(rows[0]) : null;
    } catch (error) {
      console.error('Error fetching blog post:', error);
      throw error;
    }
  }

  async createBlogPost(data) {
    await this.ensureConnected();
    try {
      const now = new Date().toISOString();
      if (data.title) {
        const existing = await this.pool.query(
          'SELECT * FROM blog WHERE title = $1 LIMIT 1',
          [data.title]
        );
        if (existing.rows.length > 0) {
          await this._mirrorToListing('blog', existing.rows[0]);
          return this._maybeParse(existing.rows[0]);
        }
      }
      const post = {
        id: nanoid(),
        campaign_id: data.campaignId,
        title: data.title,
        content: data.content || '',
        topics: this._dbVal(data.topics || []),
        status: data.status || 'draft',
        created_at: now,
        updated_at: now,
      };
      await this.pool.query(
        `INSERT INTO blog (id, campaign_id, title, content, topics, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`,
        [post.id, post.campaign_id, post.title, post.content,
         post.topics, post.status, post.created_at, post.updated_at]
      );
      await this._mirrorToListing('blog', post);
      return post;
    } catch (error) {
      console.error('Error creating blog post:', error);
      throw error;
    }
  }

  async updateBlogPost(id, updates) {
    await this.ensureConnected();
    try {
      updates.updatedAt = new Date().toISOString();
      const row = await this._update('blog', id, updates);
      if (!row) throw new Error(`Blog post ${id} not found`);
      await this._mirrorToListing('blog', row);
      return this._maybeParse(row);
    } catch (error) {
      console.error('Error updating blog post:', error);
      throw error;
    }
  }

  async deleteBlogPost(id) {
    await this.ensureConnected();
    try {
      const { rowCount } = await this.pool.query('DELETE FROM blog WHERE id = $1', [id]);
      if (rowCount > 0) await this._deleteFromListing('blog', id);
      if (rowCount === 0) throw new Error(`Blog post ${id} not found`);
      return true;
    } catch (error) {
      console.error('Error deleting blog post:', error);
      throw error;
    }
  }

  // ==================== Services Operations ====================
  async getServices() {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM services ORDER BY created_at DESC');
      return rows.map(r => this._maybeParse(r));
    } catch (error) {
      console.error('Error fetching services:', error);
      throw error;
    }
  }

  async getServicesByCampaign(campaignId) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query(
        'SELECT * FROM services WHERE campaign_id = $1 ORDER BY created_at DESC', [campaignId]
      );
      return rows.map(r => this._maybeParse(r));
    } catch (error) {
      console.error('Error fetching services by campaign:', error);
      return [];
    }
  }

  async getService(id) {
    await this.ensureConnected();
    try {
      const { rows } = await this.pool.query('SELECT * FROM services WHERE id = $1', [id]);
      return rows.length ? this._maybeParse(rows[0]) : null;
    } catch (error) {
      console.error('Error fetching service:', error);
      throw error;
    }
  }

  async createService(data) {
    await this.ensureConnected();
    try {
      const now = new Date().toISOString();
      if (data.title) {
        const existing = await this.pool.query(
          'SELECT * FROM services WHERE title = $1 LIMIT 1',
          [data.title]
        );
        if (existing.rows.length > 0) {
          await this._mirrorToListing('services', existing.rows[0]);
          return this._maybeParse(existing.rows[0]);
        }
      }
      const service = {
        id: nanoid(),
        campaign_id: data.campaignId,
        title: data.title,
        description: data.description || '',
        content: data.content || '',
        topics: this._dbVal(data.topics || []),
        status: data.status || 'draft',
        created_at: now,
        updated_at: now,
      };
      await this.pool.query(
        `INSERT INTO services (id, campaign_id, title, description, content, topics, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`,
        [service.id, service.campaign_id, service.title, service.description,
         service.content, service.topics, service.status, service.created_at, service.updated_at]
      );
      await this._mirrorToListing('services', service);
      return service;
    } catch (error) {
      console.error('Error creating service:', error);
      throw error;
    }
  }

  async updateService(id, updates) {
    await this.ensureConnected();
    try {
      updates.updatedAt = new Date().toISOString();
      const row = await this._update('services', id, updates);
      if (!row) throw new Error(`Service ${id} not found`);
      await this._mirrorToListing('services', row);
      return this._maybeParse(row);
    } catch (error) {
      console.error('Error updating service:', error);
      throw error;
    }
  }

  async deleteService(id) {
    await this.ensureConnected();
    try {
      const { rowCount } = await this.pool.query('DELETE FROM services WHERE id = $1', [id]);
      if (rowCount > 0) await this._deleteFromListing('services', id);
      if (rowCount === 0) throw new Error(`Service ${id} not found`);
      return true;
    } catch (error) {
      console.error('Error deleting service:', error);
      throw error;
    }
  }

  // ==================== Internal Helpers ====================

  _toSnakeCase(str) {
    return str.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
  }

  _toCamel(row) {
    if (!row || typeof row !== 'object') return row;
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      out[camel] = v;
    }
    return out;
  }

  async _update(table, id, updates) {
    const keys = Object.keys(updates);
    if (keys.length === 0) return null;

    const setClauses = [];
    const values = [id];
    let idx = 2;

    for (const key of keys) {
      const col = this._toSnakeCase(key);
      const val = updates[key];

      if (val instanceof Date) {
        values.push(val.toISOString());
        setClauses.push(`${col} = $${idx}`);
      } else if (val !== null && typeof val === 'object') {
        values.push(JSON.stringify(val));
        setClauses.push(`${col} = $${idx}::jsonb`);
      } else {
        values.push(val);
        setClauses.push(`${col} = $${idx}`);
      }
      idx++;
    }

    const query = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;
    const { rows } = await this.pool.query(query, values);
    return rows[0] || null;
  }

  async _updateScoped(table, id, updates, scopes) {
    const keys = Object.keys(updates);
    if (keys.length === 0) return null;

    const setClauses = [];
    const whereClauses = ['id = $1'];
    const values = [id];
    let idx = 2;

    for (const [k, v] of Object.entries(scopes)) {
      whereClauses.push(`${k} = $${idx}`);
      values.push(v);
      idx++;
    }

    for (const key of keys) {
      const col = this._toSnakeCase(key);
      const val = updates[key];

      if (val instanceof Date) {
        values.push(val.toISOString());
        setClauses.push(`${col} = $${idx}`);
      } else if (val !== null && typeof val === 'object') {
        values.push(JSON.stringify(val));
        setClauses.push(`${col} = $${idx}::jsonb`);
      } else {
        values.push(val);
        setClauses.push(`${col} = $${idx}`);
      }
      idx++;
    }

    const query = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')} RETURNING *`;
    const { rows } = await this.pool.query(query, values);
    return rows[0] || null;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
      this.pool = null;
    }
    if (this.listingPool) {
      await this.listingPool.end();
      this.listingPool = null;
    }
  }
}

const storage = new Storage();

storage.connect().catch(error => {
  console.error('⚠️ Initial PostgreSQL connection failed — will retry on first use:', error.message);
});

process.on('SIGINT', async () => {
  await storage.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await storage.close();
  process.exit(0);
});

export { storage };
