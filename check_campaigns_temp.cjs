const { Pool } = require('pg');
const pool = new Pool({ database: 'upwork_jobs', user: 'postgres', password: '1234', host: 'localhost', port: 5432 });
pool.query(
  'SELECT id, name, category, upwork_search_input, status, created_at FROM upwork_campaigns WHERE id = $1 OR id = $2 ORDER BY created_at',
  ['d_gkdD6-HqhBVaO5flNft', 'Q7Z6xcg7QpW7V18bkS8kZ']
).then(r => {
  console.log(JSON.stringify(r.rows, null, 2));
  pool.end();
}).catch(e => { console.error(e); pool.end(); });
