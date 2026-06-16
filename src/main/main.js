import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { fileURLToPath } from 'url';
import { upworkCampaignManager } from '../services/upworkCampaignManager.js';
import { initializeDefaultGPTAccount } from '../services/initializeGPTAccounts.js';
import './ipcHandlers.js'; // This registers all IPC handlers

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
const DEV_SERVER_POLL_INTERVAL = 200;  // ms between retries
const DEV_SERVER_TIMEOUT = 10000;      // 10s max wait

/**
 * Polls the Vite dev server TCP port until it accepts connections.
 * This prevents Electron from loading the URL before Vite is ready.
 */
function waitForDevServer(url, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const urlObj = new URL(url);
    const port = Number(urlObj.port) || 5173;
    const host = urlObj.hostname;

    const tryConnect = () => {
      const client = net.createConnection({ port, host }, () => {
        client.destroy();
        resolve();
      });
      client.on('error', () => {
        client.destroy();
        if (Date.now() - start >= timeout) {
          reject(new Error(`Vite dev server not ready after ${timeout}ms`));
        } else {
          setTimeout(tryConnect, DEV_SERVER_POLL_INTERVAL);
        }
      });
    };

    tryConnect();
  });
}

let mainWindow;

// Function to run tests (moved from top level)
async function runTests() {
  console.log('\n🔧 ===== RUNNING TESTS =====');
  
  try {
    // First, fix the cookies.json file if needed
    await fixCookiesFile();
    
    // Create test-results directory if it doesn't exist
    const testResultsDir = path.join(process.cwd(), 'test-results');
    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
      console.log('✅ Created test-results directory');
    }
    
    // Run tests based on command line argument
    const testType = process.argv[2] || 'none';
    
    switch(testType) {
      case 'test-full':
        console.log('Running full test suite...');
        await testChatGPTScraper();
        break;
      case 'test-cookie':
        console.log('Testing cookie loading...');
        await testCookieLoading();
        break;
      case 'test-quick':
        console.log('Running quick test...');
        await quickTest();
        break;
      case 'test-mock':
        console.log('Running mock test...');
        await mockTest();
        break;
      case 'test-all':
        console.log('Running all tests...');
        await testChatGPTScraper();
        await testCookieLoading();
        await quickTest();
        await mockTest();
        break;
      default:
        console.log('No tests requested. Use command line args: test-full, test-cookie, test-quick, test-mock, or test-all');
        break;
    }
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

// Function to fix cookies.json file structure
async function fixCookiesFile() {
  try {
    const userDataPath = app.getPath('userData');
    const cookiesPath = path.join(userDataPath, 'cookies.json');
    const altCookiesPath = path.join(process.cwd(), 'cookies.json');
    
    // Check which path has the file
    let targetPath = null;
    if (fs.existsSync(cookiesPath)) {
      targetPath = cookiesPath;
    } else if (fs.existsSync(altCookiesPath)) {
      targetPath = altCookiesPath;
    }
    
    if (!targetPath) {
      console.log('⚠️ No cookies.json file found. Creating template...');
      
      // Create a template cookies.json file
      const template = {
        "sessionToken": "PASTE_YOUR_CHATGPT_SESSION_TOKEN_HERE",
        "__Secure-next-auth.session-token": "PASTE_YOUR_CHATGPT_SESSION_TOKEN_HERE"
      };
      
      // Save to current directory
      fs.writeFileSync(altCookiesPath, JSON.stringify(template, null, 2));
      console.log(`📝 Created template cookies.json at: ${altCookiesPath}`);
      console.log('⚠️ Please edit the file and add your ChatGPT session token!');
      console.log('\nTo get your session token:');
      console.log('1. Open ChatGPT in your browser');
      console.log('2. Open Developer Tools (F12)');
      console.log('3. Go to Application tab > Cookies > https://chatgpt.com');
      console.log('4. Find "__Secure-next-auth.session-token" and copy its value');
      console.log('5. Paste it in the cookies.json file\n');
      return false;
    }
    
    // Read and check the structure
    const data = fs.readFileSync(targetPath, 'utf-8');
    let cookies;
    
    try {
      cookies = JSON.parse(data);
    } catch (e) {
      console.error('❌ Invalid JSON in cookies.json');
      return false;
    }
    
    // Check if it's an array (wrong structure)
    if (Array.isArray(cookies)) {
      console.log('⚠️ cookies.json has wrong structure (array). Fixing...');
      
      // Check if it might be browser cookies export
      let sessionToken = null;
      
      // Try to find session token in array of cookies
      for (const cookie of cookies) {
        if (cookie.name === '__Secure-next-auth.session-token' || 
            cookie.name === 'sessionToken') {
          sessionToken = cookie.value;
          break;
        }
      }
      
      if (sessionToken) {
        // Found token, create proper structure
        const fixedCookies = {
          "sessionToken": sessionToken,
          "__Secure-next-auth.session-token": sessionToken
        };
        
        // Backup old file
        const backupPath = targetPath + '.backup';
        fs.copyFileSync(targetPath, backupPath);
        console.log(`📦 Backed up old cookies.json to: ${backupPath}`);
        
        // Write fixed structure
        fs.writeFileSync(targetPath, JSON.stringify(fixedCookies, null, 2));
        console.log('✅ Fixed cookies.json structure');
        return true;
      } else {
        console.error('❌ Could not find session token in cookies array');
        console.log('Creating template file...');
        
        const template = {
          "sessionToken": "PASTE_YOUR_CHATGPT_SESSION_TOKEN_HERE",
          "__Secure-next-auth.session-token": "PASTE_YOUR_CHATGPT_SESSION_TOKEN_HERE"
        };
        
        // Backup old file
        const backupPath = targetPath + '.backup';
        fs.copyFileSync(targetPath, backupPath);
        console.log(`📦 Backed up old cookies.json to: ${backupPath}`);
        
        fs.writeFileSync(targetPath, JSON.stringify(template, null, 2));
        console.log('⚠️ Please edit cookies.json and add your ChatGPT session token!');
        return false;
      }
    }
    
    // Check if it has the required fields
    if (!cookies.sessionToken && !cookies['__Secure-next-auth.session-token']) {
      console.log('⚠️ cookies.json missing required fields. Adding template...');
      
      // Add the required fields
      cookies.sessionToken = cookies.sessionToken || "PASTE_YOUR_CHATGPT_SESSION_TOKEN_HERE";
      cookies['__Secure-next-auth.session-token'] = cookies['__Secure-next-auth.session-token'] || "PASTE_YOUR_CHATGPT_SESSION_TOKEN_HERE";
      
      fs.writeFileSync(targetPath, JSON.stringify(cookies, null, 2));
      console.log('⚠️ Please edit cookies.json and add your ChatGPT session token!');
      return false;
    }
    
    console.log('✅ cookies.json structure is correct');
    return true;
    
  } catch (error) {
    console.error('❌ Error fixing cookies file:', error);
    return false;
  }
}

function resolvePreloadPath() {
  // Prefer the CommonJS-bundled preload generated by Vite
  const builtPreload = path.join(__dirname, '../preload/preload.js');
  if (fs.existsSync(builtPreload)) {
    return builtPreload;
  }

  // Fallback to a local preload next to main (may be ESM)
  const localPreload = path.join(__dirname, 'preload.js');
  if (fs.existsSync(localPreload)) {
    return localPreload;
  }

  // Last resort: try project root preload (packaged builds sometimes include it)
  return path.resolve(__dirname, '../../preload.js');
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0f0f0f',
    show: false,                             // hidden until content is ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolvePreloadPath()
    },
    titleBarStyle: 'hiddenInset',
    frame: false,
  });

  // Add diagnostic listeners for load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc, failedUrl) => {
    console.error(`❌ Failed to load ${failedUrl}: [${errorCode}] ${errorDesc}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Renderer loaded successfully');
    // Fallback: ensure window is shown even if ready-to-show doesn't fire
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      console.log('📺 Showing window (did-finish-load fallback)');
      mainWindow.show();
    }
  });

  // Load the app — wait for Vite in dev mode
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  const isDev = devUrl || process.env.NODE_ENV === 'development';

  if (isDev) {
    const url = devUrl || 'http://localhost:5173';
    try {
      console.log(`⏳ Waiting for Vite dev server at ${url}...`);
      await waitForDevServer(url, DEV_SERVER_TIMEOUT);
      console.log('✅ Vite dev server is ready');
      await mainWindow.loadURL(url);
    } catch (err) {
      console.error('❌ Vite dev server failed to start:', err);
      app.quit();
      return;
    }
    setupDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Setup DevTools with error suppression
  function setupDevTools() {
    // Open DevTools
    // mainWindow.webContents.openDevTools();

    // Suppress autofill errors in console
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      // Filter out Autofill errors
      if (message.includes('Autofill.enable') ||
          message.includes('Autofill.setAddresses') ||
          message.includes("wasn't found")) {
        event.preventDefault();
        return;
      }

      // Log other console messages normally (optional)
      if (level === 2) { // Error level
        console.error(`Console Error: ${message}`);
      }
    });
  }

  // Show window when ready — eliminates black flash
  mainWindow.once('ready-to-show', () => {
    console.log('📺 Showing window (ready-to-show)');
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize default GPT account
  await initializeDefaultGPTAccount();

  // Reset any stale 'Running' campaigns from previous sessions
  await upworkCampaignManager.resetRunningCampaigns();

  // Run tests if requested
  // await runTests();

  // Create window (now async — waits for Vite)
  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Upwork campaign events forwarding to renderer
upworkCampaignManager.on('log', (evt) => {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('log:message', evt);
    }
  });
});

upworkCampaignManager.on('status', (evt) => {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('upwork-campaign:status', evt);
    }
  });
});

upworkCampaignManager.on('progress', (evt) => {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('campaign:progress', evt);
    }
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});