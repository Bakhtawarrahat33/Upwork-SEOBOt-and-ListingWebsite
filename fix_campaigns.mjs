import { storage } from './src/services/storage.js';

async function main() {
  await storage.ensureConnected();

  const accounts = await storage.getGPTAccounts();
  const bakhtawar = accounts.find(a => a.name.toLowerCase().includes('bakhtawar'));
  const fatima = accounts.find(a => a.name.toLowerCase().includes('fatima'));

  if (!bakhtawar) { console.error('Bakhtawar account not found!'); process.exit(1); }
  if (!fatima) { console.error('Fatima account not found!'); process.exit(1); }

  console.log('Bakhtawar ID: ' + bakhtawar.id.substring(0,8));
  console.log('Fatima ID:    ' + fatima.id.substring(0,8));

  // Fix campaigns that reference deleted accounts
  const campaigns = await storage.getUpworkCampaigns();
  let fixed = 0;
  for (const c of campaigns) {
    const exists = accounts.some(a => a.id === c.gptAccountId);
    if (!exists && c.gptAccountId) {
      // Determine which account to assign based on campaign name or previous mapping
      // Previous account id was from a Bakhtawar duplicate, so reassign to Bakhtawar
      console.log(`Fixing campaign "${c.name}" (${c.id.substring(0,8)}) — was pointing to deleted ${c.gptAccountId.substring(0,8)}`);
      await storage.pool.query(
        'UPDATE upwork_campaigns SET gpt_account_id = $1 WHERE id = $2',
        [bakhtawar.id, c.id]
      );
      fixed++;
    }
  }

  // Also stop any running campaigns so they can restart cleanly
  const running = campaigns.filter(c => c.status === 'Running');
  for (const c of running) {
    console.log(`Stopping running campaign "${c.name}" (${c.id.substring(0,8)})`);
    await storage.pool.query(
      'UPDATE upwork_campaigns SET status = $1 WHERE id = $2',
      ['Stopped', c.id]
    );
  }

  console.log(`Fixed ${fixed} campaigns, stopped ${running.length} running`);
  await storage.close();
}

main().catch(e => { console.error(e); process.exit(1); });
