const { Pool } = require('pg');
const pool = new Pool({host:'localhost',port:5432,user:'postgres',password:'1234',database:'upwork_jobs'});

async function check() {
  // Check recent logs
  const { rows: logs } = await pool.query(
    `SELECT campaign_id, level, message, timestamp 
     FROM logs 
     WHERE timestamp > $1 
     ORDER BY timestamp DESC LIMIT 50`,
    [Date.now() - 1000 * 60 * 30] // last 30 min
  );

  console.log('=== RECENT CAMPAIGN LOGS (last 30 min) ===\n');
  if (logs.length === 0) {
    console.log('No recent logs. Campaign may not be running.\n');
  } else {
    logs.reverse().forEach(row => {
      const time = new Date(row.timestamp).toLocaleTimeString();
      console.log(`[${time}] [${row.level}] ${row.message}`);
    });
  }

  // Check DB content
  console.log('\n=== DATABASE CONTENT ===');
  const tables = ['jobs_selected', 'product', 'blog', 'services'];
  for (const table of tables) {
    const { rows } = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
    console.log(`${table}: ${rows[0].count} rows`);
  }

  // Check campaign statuses
  console.log('\n=== CAMPAIGN STATUSES ===');
  const { rows: campaigns } = await pool.query('SELECT id, name, status FROM upwork_campaigns ORDER BY created_at DESC LIMIT 5');
  campaigns.forEach(c => {
    console.log(`${c.name}: ${c.status} (${c.id})`);
  });
}

check().catch(console.error).finally(() => pool.end());
