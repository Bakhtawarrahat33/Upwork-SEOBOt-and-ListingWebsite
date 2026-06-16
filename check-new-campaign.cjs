const { Pool } = require('pg');
const pool = new Pool({host:'localhost',port:5432,user:'postgres',password:'1234',database:'upwork_jobs'});

async function check() {
  // Find the newest campaign
  const { rows: campaigns } = await pool.query(
    'SELECT id, name, status, upwork_search_input, progress FROM upwork_campaigns ORDER BY created_at DESC LIMIT 3'
  );

  console.log('=== NEWEST CAMPAIGNS ===');
  campaigns.forEach(c => {
    console.log(`\n${c.name} (${c.id})`);
    console.log(`Status: ${c.status}`);
    console.log(`Search: "${c.upwork_search_input}"`);
    console.log(`Progress: ${JSON.stringify(c.progress)}`);
  });

  // Get logs for the newest running campaign
  if (campaigns.length > 0 && campaigns[0].status === 'Running') {
    const cid = campaigns[0].id;
    console.log(`\n=== RECENT LOGS FOR "${campaigns[0].name}" ===`);
    const { rows: logs } = await pool.query(
      `SELECT level, message, timestamp FROM logs WHERE campaign_id = $1 ORDER BY timestamp DESC LIMIT 30`,
      [cid]
    );
    if (logs.length === 0) {
      console.log('No logs yet — campaign may have just started');
    } else {
      logs.reverse().forEach(row => {
        console.log(`[${row.level}] ${row.message}`);
      });
    }
  }
}

check().catch(console.error).finally(() => pool.end());
