import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

let botProcess = null;
let activeSearchSignature = '';

function resolvePythonPath() {
  const commonPythonPaths = [
    'C:\\Users\\Bakhtawar\\AppData\\Local\\Programs\\Python\\Python310\\python.exe',
    'C:\\Users\\Bakhtawar\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
    'C:\\Users\\Bakhtawar\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
    'C:\\Python310\\python.exe',
    'C:\\Python311\\python.exe',
    'C:\\Python312\\python.exe',
  ];

  return commonPythonPaths.find((candidate) => fs.existsSync(candidate)) || 'python';
}

export function ensureDiscordBotRunning(options = {}) {
  const campaignSearchInput = String(options.searchInput || '').trim();
  const searchSignature = campaignSearchInput.toLowerCase();

  if (botProcess && !botProcess.killed) {
    if (activeSearchSignature !== searchSignature) {
      stopDiscordBot();
    } else {
      return { started: false, pid: botProcess.pid };
    }
  }

  const botPath = path.resolve(process.cwd(), 'upwork-discord-bot 3', 'upwork-discord-bot');
  const mainScript = path.join(botPath, 'main.py');

  if (!fs.existsSync(mainScript)) {
    throw new Error(`Discord bot entry file not found: ${mainScript}`);
  }

  const child = spawn(resolvePythonPath(), ['main.py'], {
    cwd: botPath,
    env: {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      ...(campaignSearchInput ? {
        CAMPAIGN_SEARCH_QUERY: campaignSearchInput,
        CAMPAIGN_SEARCH_KEYWORD: String(options.keyword || options.name || campaignSearchInput),
        CAMPAIGN_CATEGORY: String(options.category || 'Campaign'),
      } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  botProcess = child;
  activeSearchSignature = searchSignature;

  child.stdout.on('data', (chunk) => {
    console.log(`[DiscordBot] ${chunk.toString().trim()}`);
  });

  child.stderr.on('data', (chunk) => {
    console.warn(`[DiscordBot] ${chunk.toString().trim()}`);
  });

  child.on('exit', (code) => {
    console.log(`[DiscordBot] exited with code ${code}`);
    if (botProcess === child) {
      botProcess = null;
      activeSearchSignature = '';
    }
  });

  return { started: true, pid: child.pid };
}

export function stopDiscordBot() {
  if (botProcess && !botProcess.killed) {
    botProcess.kill();
  }
  botProcess = null;
  activeSearchSignature = '';
}
