import { createRequire } from 'module';
import { storage } from '../services/storage.js';
import { upworkCampaignManager } from '../services/upworkCampaignManager.js';
import { ensureDiscordBotRunning } from '../services/discordBotRunner.js';

const require = createRequire(import.meta.url);
const { ipcMain, app } = require('electron');

async function startCampaignDirect(id) {
  const campaign = await storage.getUpworkCampaign(id);
  if (!campaign) {
    console.warn(`Campaign ${id} not found`);
    return;
  }
  const botState = ensureDiscordBotRunning({
    searchInput: campaign.upworkSearchInput,
    keyword: campaign.name,
    category: campaign.category,
  });
  // Discord is the sole job source. The local polling loop used to run alongside
  // the Discord bridge, which duplicated job discovery and opened parallel GPT sessions.
  await storage.updateUpworkCampaign(id, { status: 'Running' });
  console.log(`Starting bridge campaign ${id}; Discord bot ${botState.started ? 'started' : 'already running'}`);
}

ipcMain.handle('app:get-info', async () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    userDataPath: app.getPath('userData'),
  };
});

// ==================== Campaign Operations ====================
ipcMain.handle('campaigns:list', async () => {
  try {
    const campaigns = await storage.getCampaigns();
    return campaigns;
  } catch (error) {
    console.error('Error listing campaigns:', error);
    throw error;
  }
});

ipcMain.handle('campaigns:create', async (_event, payload) => {
  try {
    const campaign = await storage.createCampaign(payload);
    return campaign;
  } catch (error) {
    console.error('Error creating campaign:', error);
    throw error;
  }
});

ipcMain.handle('campaigns:update', async (_event, id, updates) => {
  try {
    const campaign = await storage.updateCampaign(id, updates);
    return campaign;
  } catch (error) {
    console.error('Error updating campaign:', error);
    throw error;
  }
});

ipcMain.handle('campaigns:delete', async (_event, id) => {
  try {
    await storage.deleteCampaign(id);
    return { ok: true };
  } catch (error) {
    console.error('Error deleting campaign:', error);
    throw error;
  }
});

// ==================== Logs ====================
ipcMain.handle('logs:get', async (_event, { id, since = 0 }) => {
  try {
    const logs = await storage.getLogs(id, since);
    return logs;
  } catch (error) {
    console.error('Error getting logs:', error);
    throw error;
  }
});

ipcMain.handle('logs:clear', async (_event, { id }) => {
  try {
    await storage.clearLogs(id);
    return { ok: true };
  } catch (error) {
    console.error('Error clearing logs:', error);
    throw error;
  }
});

// ==================== Shell Operations ====================
ipcMain.handle('shell:openExternal', async (_event, url) => {
  try {
    const { shell } = await import('electron');
    await shell.openExternal(url);
    return { ok: true };
  } catch (error) {
    console.error('Error opening URL:', error);
    throw error;
  }
});

// ==================== GPT Accounts Operations ====================
ipcMain.handle('gptAccounts:list', async () => {
  try {
    const accounts = await storage.getGPTAccounts();
    return accounts;
  } catch (error) {
    console.error('Error listing GPT accounts:', error);
    throw error;
  }
});

ipcMain.handle('gptAccounts:create', async (_event, payload) => {
  try {
    const account = await storage.createGPTAccount(payload);
    return account;
  } catch (error) {
    console.error('Error creating GPT account:', error);
    throw error;
  }
});

ipcMain.handle('gptAccounts:update', async (_event, id, updates) => {
  try {
    await storage.updateGPTAccount(id, updates);
    return true;
  } catch (error) {
    console.error('Error updating GPT account:', error);
    throw error;
  }
});

ipcMain.handle('gptAccounts:delete', async (_event, id) => {
  try {
    await storage.deleteGPTAccount(id);
    return true;
  } catch (error) {
    console.error('Error deleting GPT account:', error);
    throw error;
  }
});

// ==================== Job Cache Status ====================
ipcMain.handle('jobCache:status', async () => {
  return upworkCampaignManager.getJobCacheStatus();
});

// ==================== Upwork Campaign Operations ====================
ipcMain.handle('upworkCampaigns:list', async () => {
  try {
    const campaigns = await storage.getUpworkCampaigns();
    return campaigns;
  } catch (error) {
    console.error('Error listing Upwork campaigns:', error);
    throw error;
  }
});

ipcMain.handle('pipeline:sync-status', async () => {
  try {
    return await storage.getPipelineSyncStatus();
  } catch (error) {
    console.error('Error getting pipeline sync status:', error);
    throw error;
  }
});

ipcMain.handle('upworkCampaigns:create', async (_event, payload) => {
  try {
    const campaign = await storage.createUpworkCampaign(payload);
    return campaign;
  } catch (error) {
    console.error('Error creating Upwork campaign:', error);
    throw error;
  }
});

ipcMain.handle('upworkCampaigns:start', async (_event, { id }) => {
  try {
    const campaign = await storage.getUpworkCampaign(id);
    if (!campaign) {
      return { ok: false, error: 'Campaign not found' };
    }
    await startCampaignDirect(id);
    return { ok: true, active: true, queued: false };
  } catch (error) {
    console.error('Error starting Upwork campaign:', error);
    throw error;
  }
});

ipcMain.handle('upworkCampaigns:stop', async (_event, { id }) => {
  try {
    await upworkCampaignManager.stopCampaign(id);
    return { ok: true };
  } catch (error) {
    console.error('Error stopping Upwork campaign:', error);
    throw error;
  }
});

ipcMain.handle('upworkCampaigns:delete', async (_event, id) => {
  try {
    await storage.deleteUpworkCampaign(id);
    return { ok: true };
  } catch (error) {
    console.error('Error deleting Upwork campaign:', error);
    throw error;
  }
});

// ==================== Scrape Jobs Campaign Operations ====================
ipcMain.handle('scrapeJobsCampaigns:list', async () => {
  try {
    const campaigns = await storage.getScrapeJobsCampaigns();
    return campaigns;
  } catch (error) {
    console.error('Error listing scrape-jobs campaigns:', error);
    throw error;
  }
});

ipcMain.handle('scrapeJobsCampaigns:create', async (_event, payload) => {
  try {
    const campaign = await storage.createScrapeJobsCampaign(payload);
    return campaign;
  } catch (error) {
    console.error('Error creating scrape-jobs campaign:', error);
    throw error;
  }
});

ipcMain.handle('scrapeJobsCampaigns:start', async (_event, { id }) => {
  try {
    const { upworkCampaignManager } = await import('../services/upworkCampaignManager.js');
    upworkCampaignManager.startScrapeJobsCampaign(id).catch(error => {
      console.error('Scrape-jobs campaign error:', error);
    });
    return { ok: true };
  } catch (error) {
    console.error('Error starting scrape-jobs campaign:', error);
    throw error;
  }
});

ipcMain.handle('scrapeJobsCampaigns:stop', async (_event, { id }) => {
  try {
    const { upworkCampaignManager } = await import('../services/upworkCampaignManager.js');
    await upworkCampaignManager.stopCampaign(id);
    return { ok: true };
  } catch (error) {
    console.error('Error stopping scrape-jobs campaign:', error);
    throw error;
  }
});

ipcMain.handle('scrapeJobsCampaigns:delete', async (_event, id) => {
  try {
    await storage.deleteScrapeJobsCampaign(id);
    return { ok: true };
  } catch (error) {
    console.error('Error deleting scrape-jobs campaign:', error);
    throw error;
  }
});
