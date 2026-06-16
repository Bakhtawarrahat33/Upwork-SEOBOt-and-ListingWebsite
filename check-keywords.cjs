const { Pool } = require('pg');
const pool = new Pool({host:'localhost',port:5432,user:'postgres',password:'1234',database:'upwork_jobs'});

async function check() {
  // What campaigns are searching for
  console.log('=== CURRENT CAMPAIGN SEARCHES ===');
  const { rows: campaigns } = await pool.query('SELECT name, upwork_search_input FROM upwork_campaigns WHERE status = \'Running\'');
  campaigns.forEach(c => {
    console.log(`${c.name}: "${c.upwork_search_input}"`);
  });

  // What jobs were previously fetched
  console.log('\n=== PREVIOUSLY FETCHED JOB TITLES (sample) ===');
  const { rows: jobs } = await pool.query('SELECT title, niche, platform, tool, upwork_job_url FROM processed_jobs ORDER BY created_at DESC LIMIT 20');
  jobs.forEach(j => {
    console.log(`- ${j.title} | Niche: ${j.niche} | Platform: ${j.platform} | Tool: ${j.tool}`);
  });

  // Count by niche/platform
  console.log('\n=== NICHE BREAKDOWN ===');
  const { rows: niches } = await pool.query('SELECT niche, COUNT(*) as count FROM processed_jobs GROUP BY niche ORDER BY count DESC');
  niches.forEach(n => console.log(`${n.niche}: ${n.count}`));

  console.log('\n=== PLATFORM BREAKDOWN ===');
  const { rows: platforms } = await pool.query('SELECT platform, COUNT(*) as count FROM processed_jobs WHERE platform IS NOT NULL AND platform != \'None\' GROUP BY platform ORDER BY count DESC LIMIT 10');
  platforms.forEach(p => console.log(`${p.platform}: ${p.count}`));

  console.log('\n=== TOOL BREAKDOWN ===');
  const { rows: tools } = await pool.query('SELECT tool, COUNT(*) as count FROM processed_jobs WHERE tool IS NOT NULL AND tool != \'None\' GROUP BY tool ORDER BY count DESC LIMIT 10');
  tools.forEach(t => console.log(`${t.tool}: ${t.count}`));
}

check().catch(console.error).finally(() => pool.end());
