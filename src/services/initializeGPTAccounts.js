import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  try {
    const envPath = path.join(__dirname, '..', '..', 'upwork-discord-bot 3', 'upwork-discord-bot', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (key.startsWith('CHATGPT_')) process.env[key] = value;
      }
    }
  } catch (e) {
    console.warn('[initAccounts] Could not load .env:', e.message);
  }
}
loadEnv();

/**
 * Initialize default GPT account from cookies.json if not already exists
 */
export async function initializeDefaultGPTAccount() {
  try {
    console.log('🔍 Checking for default GPT account...');
    
    const existingAccounts = await storage.getGPTAccounts();
    const existingNames = new Set(existingAccounts.map(a => a.name.toLowerCase()));

    // Create from env credentials if not already in DB
    const envAccounts = [
      { name: 'Bakhtawar Account', emailKey: 'CHATGPT_EMAIL_BAKHTAWAR', passKey: 'CHATGPT_PASSWORD_BAKHTAWAR' },
      { name: 'Fatima Account', emailKey: 'CHATGPT_EMAIL_FATIMA', passKey: 'CHATGPT_PASSWORD_FATIMA' },
    ];

    let created = false;
    for (const envAcc of envAccounts) {
      if (!existingNames.has(envAcc.name.toLowerCase())) {
        const email = process.env[envAcc.emailKey];
        const password = process.env[envAcc.passKey];
        if (email && password) {
          await storage.createGPTAccount({
            name: envAcc.name,
            cookies: {},
            status: 'active'
          });
          console.log(`✅ GPT account "${envAcc.name}" created from .env credentials`);
          created = true;
        }
      }
    }

    if (created) return;

    // Fall back to cookies.json for Bakhtawar Account
    if (existingNames.has('bakhtawar account')) {
      console.log('✅ GPT account "Bakhtawar Account" already exists');
      return;
    }

    const cookiesPath = path.join(__dirname, '..', '..', 'cookies.json');
    if (!fs.existsSync(cookiesPath)) {
      console.warn('⚠️ cookies.json not found, skipping default account creation');
      return;
    }

    const cookiesContent = fs.readFileSync(cookiesPath, 'utf8');
    const cookies = JSON.parse(cookiesContent);
    await storage.createGPTAccount({
      name: 'Bakhtawar Account',
      cookies: cookies,
      status: 'active'
    });
    console.log('✅ Default GPT account "Bakhtawar Account" created from cookies.json');
  } catch (error) {
    console.error('❌ Error initializing default GPT account:', error);
  }
}
