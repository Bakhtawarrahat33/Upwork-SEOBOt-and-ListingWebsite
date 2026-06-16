const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const pool = new Pool({host:'localhost',port:5432,user:'postgres',password:'1234',database:'upwork_jobs'});

async function create() {
  const fatimeToken = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..JiG-rX33ywWmRtET.-CRbhBN8gsFZspccUdX2aaAZU8kJnrZp8rO_u6AVFegqqsmEjj-fxoHYdFjrPEoV_BVlGgaS8mQIFWTHRa07f7x5EUqs0A6nauOja4c4QxItwjHnxSf6lXSIQ7mT38JeaOt1zLveCJr5OaWllXTDElzVW2UoZWyF0ZRGCY9GcOZgthJ6qBg0Z6kOsvYNGtgXjVwSj6Oz0Qmk8ADTYOXf2p9dMEAaInYvvianiGmtcrhXS0698wt8tLDuJCaKzfV7H6vvPHERTg2EnYAYbJ6j7Th1k2ajukkHuoGdxXcy1bWNG-rK2u3e77q1as7rMFGYkZ6oGQwG75wdH-f9HFUm_5usr5vd2ZukhPBcgEvl5Dy3gtdtHwUMxkLJoHI6c86wsFYV8wfy8hMp07vUr_iIY3Xo31vw12TG4Pc74l6kXD_UwEPeIfl9-5CWku1J5BFyDgjI9QE6exVnb7rF-BWnY0FRIh9wfzE4Cvoo7E8PTRGXp4vLfiKZor_WBqonghCmN5BePv4ur';

  const cookies = JSON.stringify([{
    name: '__Secure-next-auth.session-token',
    value: fatimeToken,
    domain: '.chatgpt.com',
    path: '/',
    secure: true,
    httpOnly: true
  }]);

  const id = nanoid();
  const now = new Date().toISOString();

  await pool.query(
    'INSERT INTO gpt_accounts (id, name, cookies, created_at, updated_at) VALUES ($1, $2, $3::jsonb, $4, $5)',
    [id, 'Fatime Account', cookies, now, now]
  );

  console.log(`✅ Created Fatime Account (${id})`);
}

create().catch(console.error).finally(() => pool.end());
