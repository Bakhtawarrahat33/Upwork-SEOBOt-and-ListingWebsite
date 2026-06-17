const { Pool } = require('pg');

const upworkPool = new Pool({ database: 'upwork_jobs', user: 'postgres', password: '1234', host: 'localhost', port: 5432 });
const listingPool = new Pool({ database: 'listing_site', user: 'postgres', password: '1234', host: 'localhost', port: 5432 });

async function main() {
  // Show both services for user to decide
  const { rows } = await upworkPool.query('SELECT id, campaign_id, title, created_at FROM services ORDER BY created_at');
  console.log('Existing services in upwork_jobs:');
  rows.forEach((r, i) => {
    console.log(`  [${i + 1}] ID: ${r.id} | Campaign: ${r.campaign_id} | Created: ${r.created_at}`);
    console.log(`      Title: ${r.title}`);
  });

  // Keep the older one (first created), delete the newer one
  if (rows.length > 1) {
    const keep = rows[0];
    const delete_ = rows[1];
    console.log(`\nKeeping: ${keep.title} (from ${keep.created_at})`);
    console.log(`Deleting: ${delete_.title} (from ${delete_.created_at})`);

    // Delete from upwork_jobs
    await upworkPool.query('DELETE FROM services WHERE id = $1', [delete_.id]);
    console.log(`\n✅ Deleted from upwork_jobs.services`);

    // Delete from listing_site
    await listingPool.query('DELETE FROM services WHERE id = $1', [delete_.id]);
    console.log(`✅ Deleted from listing_site.services`);
  } else {
    console.log('No duplicates found.');
  }

  await upworkPool.end();
  await listingPool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
