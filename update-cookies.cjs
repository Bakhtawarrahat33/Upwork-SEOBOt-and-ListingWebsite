const { Pool } = require('pg');
const pool = new Pool({host:'localhost',port:5432,user:'postgres',password:'1234',database:'upwork_jobs'});

async function update() {
  // Check current accounts
  const { rows: accounts } = await pool.query('SELECT id, name, cookies FROM gpt_accounts ORDER BY created_at DESC');
  console.log('Current GPT accounts:');
  accounts.forEach(a => {
    console.log(`- ${a.name} (${a.id})`);
    console.log(`  Cookies:`, JSON.stringify(a.cookies).substring(0, 100));
  });

  // Update Bakhtawar Account
  const bakhtawarToken = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..f9fTqV1L6r4Iso-f.fahz3UMJDzfa5JxSR66UV1MHu1do3eOC7zMH_INXqpY-W0Bxx76LRXnz_JqpQiMJqkGbwri3LP8iX75iGk22x0YodRaWJqwNSwZahEthleZd5PYKyf8KCl0nYjdus27lSn5wjH6WOpYGgfH9ijIkJ_u3fSF__iLFztdyZpOPdILdiBeeYLigtv8p3S-41Ea2Syxg0RWXiAGwsmLR-Cj3KRcFuJTn6j5ed0KOdM1ZA0pFp2bbPxToyrcsE_CEFpTkWm785U4xEF1ltaM1_-QaKd85CHvOcK3ZDgontkjI7u-e9s6fDNweaIB7ix2FdG4yh4n-39OzzS3M4CM5wvGa_McY52KaaLM6LZOARbU9QuEFMzGnuox7hIcGlitpaoBEiF46OrwPILfSvFcqVtTorodzc95cz7gmwS_s85U2kuRv15hwo08Zw1oVdWMtMz0gUd5TkJpa3kfsPju6KKFMOKHgkcgfxRfpiJoAhp-GEknY_VgUP_tjPsa2X8U0rvoodkdDE4fqV_peeNkZsqMVI4NMAmPsgLFYola6jLlLNs0vWFmVV-MlNvbw31Qj_KWg_o_C9sr8kcZdXctft9wcLcvQqjodK8M5B4PtgAPWVV6psOreJ2LMjFpHFQKhnsyjIJGxzE5LVzJCQ_Kocsm0z7AFJJII85DgL0qt2MBSujlsPKkg1';

  const fatimeToken = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..JiG-rX33ywWmRtET.-CRbhBN8gsFZspccUdX2aaAZU8kJnrZp8rO_u6AVFegqqsmEjj-fxoHYdFjrPEoV_BVlGgaS8mQIFWTHRa07f7x5EUqs0A6nauOja4c4QxItwjHnxSf6lXSIQ7mT38JeaOt1zLveCJr5OaWllXTDElzVW2UoZWyF0ZRGCY9GcOZgthJ6qBg0Z6kOsvYNGtgXjVwSj6Oz0Qmk8ADTYOXf2p9dMEAaInYvvianiGmtcrhXS0698wt8tLDuJCaKzfV7H6vvPHERTg2EnYAYbJ6j7Th1k2ajukkHuoGdxXcy1bWNG-rK2u3e77q1as7rMFGYkZ6oGQwG75wdH-f9HFUm_5usr5vd2ZukhPBcgEvl5Dy3gtdtHwUMxkLJoHI6c86wsFYV8wfy8hMp07vUr_iIY3Xo31vw12TG4Pc74l6kXD_UwEPeIfl9-5CWku1J5BFyDgjI9QE6exVnb7rF-BWnY0FRIh9wfzE4Cvoo7E8PTRGXp4vLfiKZor_WBqonghCmN5BePv4ur';

  const cookieValue = (token) => JSON.stringify([{
    name: '__Secure-next-auth.session-token',
    value: token,
    domain: '.chatgpt.com',
    path: '/',
    secure: true,
    httpOnly: true
  }]);

  for (const acc of accounts) {
    const name = acc.name.toLowerCase();
    if (name.includes('bakhtawar')) {
      await pool.query('UPDATE gpt_accounts SET cookies = $1::jsonb, updated_at = NOW() WHERE id = $2', [cookieValue(bakhtawarToken), acc.id]);
      console.log(`✅ Updated Bakhtawar Account`);
    } else if (name.includes('fatime')) {
      await pool.query('UPDATE gpt_accounts SET cookies = $1::jsonb, updated_at = NOW() WHERE id = $2', [cookieValue(fatimeToken), acc.id]);
      console.log(`✅ Updated Fatime Account`);
    }
  }

  // Verify
  const { rows: updated } = await pool.query('SELECT id, name FROM gpt_accounts ORDER BY created_at DESC');
  console.log('\nUpdated accounts:');
  updated.forEach(a => console.log(`- ${a.name} (${a.id})`));
}

update().catch(console.error).finally(() => pool.end());
