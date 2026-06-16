import pg from 'pg';

const SRC = {
  host: process.env.SRC_DB_HOST || 'localhost',
  port: Number(process.env.SRC_DB_PORT) || 5432,
  user: process.env.SRC_DB_USER || 'postgres',
  password: process.env.SRC_DB_PASSWORD || '1234',
  database: process.env.SRC_DB_NAME || 'upwork_jobs',
  max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000,
};

const DST = {
  host: process.env.DST_DB_HOST || 'localhost',
  port: Number(process.env.DST_DB_PORT) || 5432,
  user: process.env.DST_DB_USER || 'postgres',
  password: process.env.DST_DB_PASSWORD || '1234',
  database: process.env.DST_DB_NAME || 'listing_site',
  max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000,
};

const TABLE_MAP = [
  { source: 'product',          target: 'products',         columns: ['id','campaign_id','title','description','content','topics','repo_url','status','created_at','updated_at'] },
  { source: 'blog',             target: 'blogs',            columns: ['id','campaign_id','title','content','topics','status','created_at','updated_at'] },
  { source: 'services',         target: 'services',         columns: ['id','campaign_id','title','description','content','topics','status','created_at','updated_at'] },
  { source: 'jobs_selected',    target: 'jobs',             columns: ['id','campaign_id','title','description','niche','platform','tool','repo_url','upwork_job_url','viability','created_at','updated_at'] },
  { source: 'upwork_campaigns', target: 'upwork_campaigns', columns: ['id','category','name','upwork_search_input','scrape_job_urls','scrape_job_niche','gpt_account_id','time_coefficient','delay_between_repos','repos_per_hour','status','progress','results','created_at','updated_at'] },
];

async function syncTable(srcPool, dstPool, mapping) {
  const { source, target, columns } = mapping;
  const cols = columns.join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updates = columns.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');

  const startTime = Date.now();

  // 1. Read watermark
  const { rows: wmRows } = await dstPool.query(
    'SELECT last_synced_at FROM sync_watermarks WHERE table_name = $1',
    [source]
  );
  const lastSyncedAt = wmRows.length > 0 ? wmRows[0].last_synced_at : new Date('1970-01-01');

  // 2. Fetch new rows from source
  const { rows: newRows } = await srcPool.query(
    `SELECT ${cols} FROM ${source} WHERE created_at::timestamptz > $1 ORDER BY created_at`,
    [lastSyncedAt]
  );

  if (newRows.length === 0) {
    const duration = Date.now() - startTime;
    await dstPool.query(
      `INSERT INTO sync_audit_log (table_name, rows_synced, duration_ms, error)
       VALUES ($1, 0, $2, NULL)`,
      [source, duration]
    );
    console.log(`  ${source} → ${target}: 0 rows (up to date)`);
    return 0;
  }

  // 3. Insert into target (upsert to handle re-runs)
  let inserted = 0;
  for (const row of newRows) {
    const values = columns.map(c => {
      let v = row[c] ?? null;
      // Handle JSONB fields: serialize objects/arrays to string for safe pg insert
      if (v !== null && typeof v === 'object') {
        v = JSON.stringify(v);
      }
      return v;
    });
    try {
      await dstPool.query(
        `INSERT INTO ${target} (${cols}, synced_at)
         VALUES (${placeholders}, NOW())
         ON CONFLICT (id) DO UPDATE SET ${updates}, synced_at = NOW()`,
        values
      );
      inserted++;
    } catch (insertErr) {
      console.error(`  ⚠️  Failed to insert row ${row.id}: ${insertErr.message}`);
    }
  }

  // 4. Update watermark only if at least one row was inserted
  if (inserted > 0) {
    await dstPool.query(
      'UPDATE sync_watermarks SET last_synced_at = NOW() WHERE table_name = $1',
      [source]
    );
  }

  // 5. Write audit log
  const duration = Date.now() - startTime;
  await dstPool.query(
    `INSERT INTO sync_audit_log (table_name, rows_synced, duration_ms, error)
     VALUES ($1, $2, $3, NULL)`,
    [source, inserted, duration]
  );

  console.log(`  ${source} → ${target}: ${inserted} rows synced in ${duration}ms`);
  return inserted;
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting sync...`);

  const srcPool = new pg.Pool(SRC);
  const dstPool = new pg.Pool(DST);

  let hasError = false;

  try {
    for (const mapping of TABLE_MAP) {
      const startTime = Date.now();
      try {
        await syncTable(srcPool, dstPool, mapping);
      } catch (tableErr) {
        hasError = true;
        const duration = Date.now() - startTime;
        console.error(`  ❌ ${mapping.source} → ${mapping.target} FAILED: ${tableErr.message}`);

        try {
          await dstPool.query(
            `INSERT INTO sync_audit_log (table_name, rows_synced, duration_ms, error)
             VALUES ($1, 0, $2, $3)`,
            [mapping.source, duration, tableErr.message]
          );
        } catch (logErr) {
          console.error(`  ⚠️  Failed to write audit log: ${logErr.message}`);
        }
      }
    }
  } finally {
    await srcPool.end();
    await dstPool.end();
  }

  console.log(`[${new Date().toISOString()}] Sync ${hasError ? 'completed with errors' : 'completed successfully'}`);
  process.exit(hasError ? 1 : 0);
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  try {
    const dstPool = new pg.Pool(DST);
    dstPool.query(
      `INSERT INTO sync_audit_log (table_name, rows_synced, duration_ms, error)
       VALUES ('FATAL', 0, 0, $1)`,
      [err.message]
    ).finally(() => dstPool.end().catch(() => {}));
  } catch {}
  process.exit(1);
});
