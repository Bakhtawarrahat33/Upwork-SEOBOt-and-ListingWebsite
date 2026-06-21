import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './storage.js';
import { upworkJobService } from './upworkJobService.js';
import { extractAndRepairJSON, normalizeJobFilterResponse } from '../utils/jsonRepairUtil.js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile() {
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
        if (key.startsWith('CHATGPT_') || key === 'SHOW_GPT_BROWSER') process.env[key] = value;
      }
    }
  } catch (e) {
    console.warn('[env] Could not load .env:', e.message);
  }
}
loadEnvFile();
const showGPTBrowser = process.env.SHOW_GPT_BROWSER === 'true';

function getChatGPTCredentials(accountName) {
  const name = (accountName || '').toLowerCase();
  if (name.includes('bakhtawar')) {
    return { email: process.env.CHATGPT_EMAIL_BAKHTAWAR, password: process.env.CHATGPT_PASSWORD_BAKHTAWAR };
  }
  if (name.includes('fatima')) {
    return { email: process.env.CHATGPT_EMAIL_FATIMA, password: process.env.CHATGPT_PASSWORD_FATIMA };
  }
  return null;
}

function loadPromptTemplate(filename) {
  try {
    const promptPath = path.join(__dirname, '..', '..', 'prompts', filename);
    if (!fs.existsSync(promptPath)) {
      console.warn(`[Prompt] Missing file: ${filename}`);
      return null;
    }
    const content = fs.readFileSync(promptPath, 'utf-8').trim();
    if (!content) {
      console.warn(`[Prompt] Empty file: ${filename}`);
      return null;
    }
    return content;
  } catch (err) {
    console.warn(`[Prompt] Error loading ${filename}: ${err.message}`);
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeCookiesForContentGen(raw) {
  if (Array.isArray(raw)) {
    return raw.map(c => ({
      name: c.name || c.key || '',
      value: c.value || c.session || c.sessionToken || '',
      domain: c.domain || '.chatgpt.com',
      path: c.path || '/',
      secure: c.secure !== undefined ? !!c.secure : true,
      httpOnly: c.httpOnly !== undefined ? !!c.httpOnly : true,
    })).filter(c => c.name && c.value);
  }
  if (typeof raw === 'object' && raw !== null) {
    return Object.entries(raw).map(([name, value]) => ({
      name,
      value: String(value),
      domain: '.chatgpt.com',
      path: '/',
      secure: true,
      httpOnly: true,
    })).filter(c => c.name && c.value);
  }
  return [];
}

function getStandaloneChatGPTProfileDir(gptAccountId = 'default') {
  const safeId = String(gptAccountId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const profileDir = path.join(process.cwd(), '.chatgpt-profiles', safeId);
  fs.mkdirSync(profileDir, { recursive: true });
  return profileDir;
}

function getFallbackChatGPTProfileDir(gptAccountId = 'default') {
  const safeId = String(gptAccountId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const profileDir = path.join(process.cwd(), '.chatgpt-profiles', '_sessions', `${safeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(profileDir, { recursive: true });
  return profileDir;
}

function getInstalledChromePath() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

const installedChromePath = getInstalledChromePath();

async function launchPuppeteerWithProfileFallback(puppeteer, launchOptions, primaryProfileDir, fallbackProfileDir, logFn = console.warn) {
  try {
    return {
      browser: await puppeteer.launch({ ...launchOptions, userDataDir: primaryProfileDir }),
      profileDir: primaryProfileDir,
      usedFallback: false
    };
  } catch (error) {
    const message = error?.message || String(error);
    logFn(`Primary browser profile failed to launch: ${message}`);
    logFn(`Retrying with a fresh browser profile: ${fallbackProfileDir}`);
    await sleep(1500);
    return {
      browser: await puppeteer.launch({ ...launchOptions, userDataDir: fallbackProfileDir }),
      profileDir: fallbackProfileDir,
      usedFallback: true
    };
  }
}

async function launchBrowser(cookies, gptAccountId = 'default', accountName) {
  console.log('   🔧 Launching normal Chrome browser...');
  const launchOptions = {
    protocolTimeout: 300000,
    timeout: 60000,
    headless: false,
    executablePath: installedChromePath,
    defaultViewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--window-position=0,0',
      '--disable-blink-features=AutomationControlled',
    ],
  };
  const launched = await launchPuppeteerWithProfileFallback(
    puppeteer,
    launchOptions,
    getStandaloneChatGPTProfileDir(gptAccountId),
    getFallbackChatGPTProfileDir(gptAccountId),
    (msg) => console.warn(`   ${msg}`)
  );
  const browser = launched.browser;
  const page = await browser.newPage();
  let hasProfileSession = false;
  try {
    await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const status = await checkChatGPTLoggedInWithCloudflareRetry(page, (msg) => console.warn(`   ${msg}`));
    hasProfileSession = status === true;
  } catch {
    // sendPromptToChatGPT will retry navigation with the normal login checks.
  }

  if (cookies && !hasProfileSession) {
    const cookieArray = normalizeCookiesForContentGen(cookies);
    if (cookieArray.length > 0) {
      console.log(`🍪 Setting ${cookieArray.length} cookies for GPT session`);
      await page.setCookie(...cookieArray);
      await new Promise(resolve => setTimeout(resolve, 3000));
      await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => { });
      const status = await checkChatGPTLoggedInWithCloudflareRetry(page, (msg) => console.warn(`   ${msg}`));
      hasProfileSession = status === true;
    } else {
      console.warn('⚠️ No valid cookies to set after normalization');
    }
  } else if (hasProfileSession) {
    console.log('Using saved ChatGPT browser session instead of stored cookies');
  }

  if (!hasProfileSession) {
    const creds = getChatGPTCredentials(accountName || gptAccountId);
    if (creds && creds.email && creds.password) {
      console.log('🔑 Trying automated login with saved credentials...');
      const ok = await autoLoginChatGPT(page, creds.email, creds.password, (msg) => console.log(msg));
      if (ok) {
        hasProfileSession = true;
      }
    }
  }

  return { browser, page };
}

async function isStandaloneChatGPTLoggedIn(page) {
  const raw = await page.evaluate(() => {
    const text = document.body?.innerText || '';

    const isCloudflareChallenge =
      /checking your browser|verify you are human|cloudflare|ray id|just a moment/i.test(`${document.title || ''}\n${text}`) ||
      !!document.querySelector('#challenge-form, .cf-browser-verification, [class*="cf-"]');
    if (isCloudflareChallenge) return 'CLOUDFLARE';

    const composerSelector = [
      'textarea#prompt-textarea',
      '#prompt-textarea',
      '[data-testid="prompt-textarea"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Ask"]',
      '[role="textbox"][contenteditable="true"]',
      'div[contenteditable="true"]',
      '.ProseMirror'
    ].join(', ');
    const hasComposer = !!document.querySelector(composerSelector);
    const hasLoggedInShell = /new chat|search chats|library|projects|apps/i.test(text)
      && /ask anything|what are you working on|what.?s on your mind/i.test(text);
    const hasAccountProfile = !!document.querySelector(
      '[data-testid="accounts-profile-button"], [data-testid="profile-button"], button[aria-label*="Account" i]'
    );
    const hasLoginPrompt = /log in or sign up|sign up or log in to save chats|continue with google|continue with apple|email address/i.test(text);
    const onAuthRoute = /\/auth\/(login|signup)/.test(window.location.pathname);

    return (hasComposer || hasLoggedInShell) && hasAccountProfile && !hasLoginPrompt && !onAuthRoute;
  });
  if (raw === 'CLOUDFLARE') {
    console.warn('⚠️ Cloudflare challenge detected on chatgpt.com — bot fingerprint detection active');
    return false;
  }
  return raw;
}

async function checkChatGPTLoggedInWithCloudflareRetry(page, logFn = console.warn) {
  let result = await isStandaloneChatGPTLoggedIn(page);
  if (result === false) {
    logFn('⚠️ Not logged in or Cloudflare — waiting 10s and retrying...');
    await new Promise(r => setTimeout(r, 10000));
    result = await isStandaloneChatGPTLoggedIn(page);
  }
  return result;
}

async function autoLoginChatGPT(page, email, password, logFn) {
  async function openLoginPage() {
    await page.goto('https://chatgpt.com/auth/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  logFn('   🔑 Attempting automated ChatGPT login...');

  try {
    await openLoginPage();
  } catch { }

  await new Promise(resolve => setTimeout(resolve, 3000));

  const hasInvalidState = await page.evaluate(() => /invalid_state|sign-in session is no longer valid/i.test(document.body?.innerText || '')).catch(() => false);
  if (hasInvalidState) {
    logFn('   OpenAI login state expired. Clearing the automation profile auth state and retrying...');
    const authCookies = await page.cookies('https://auth.openai.com', 'https://chatgpt.com').catch(() => []);
    if (authCookies.length > 0) await page.deleteCookie(...authCookies).catch(() => { });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    }).catch(() => { });
    await openLoginPage().catch(() => { });
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async function findButtonByText(text) {
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const matches = await button.evaluate((element, searchText) => (
        element.offsetParent !== null
        && !element.disabled
        && (element.textContent || '').toLowerCase().includes(searchText.toLowerCase())
      ), text);
      if (matches) return button;
    }
    return null;
  }

  const emailSelectors = [
    'input[name="email"]', 'input[name="username"]', 'input[type="email"]', '#email',
    'input[placeholder*="email" i]', 'input[autocomplete="email"]',
    '[data-testid*="email" i] input', '[data-testid*="email" i]'
  ];
  // Current ChatGPT sometimes opens an intermediate page with a Login button.
  const openedLogin = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('button, a'));
    const launcher = candidates.find((element) => /^(log in|sign in|continue with email)$/i.test((element.textContent || '').trim()));
    if (!launcher || launcher.offsetParent === null) return false;
    launcher.click();
    return true;
  }).catch(() => false);
  if (openedLogin) await new Promise(resolve => setTimeout(resolve, 2000));

  let emailField = null;
  for (const sel of emailSelectors) {
    try { emailField = await page.waitForSelector(sel, { timeout: 3000 }); if (emailField) break; } catch { }
  }
  if (!emailField) {
    for (const frame of page.frames()) {
      for (const selector of emailSelectors) {
        try { emailField = await frame.$(selector); if (emailField) break; } catch { }
      }
      if (emailField) break;
    }
  }
  if (!emailField) { logFn('   ⚠️ Could not find email field'); return false; }

  await emailField.click({ delay: 100 });
  await new Promise(resolve => setTimeout(resolve, 500));
  await emailField.type(email, { delay: 30 });
  await new Promise(resolve => setTimeout(resolve, 1000));

  let continueBtn = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    continueBtn = await findButtonByText('Continue');
    if (continueBtn) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (continueBtn) {
    try { await continueBtn.click(); } catch { try { await page.click('button[type="submit"]'); } catch { } }
  } else {
    try { await emailField.press('Enter'); } catch { try { await page.click('button[type="submit"]'); } catch { } }
  }

  await new Promise(resolve => setTimeout(resolve, 3000));

  const passwordSelectors = ['input[name="password"]', 'input[type="password"]', '#password', 'input[placeholder*="password" i]', 'input[placeholder*="Password"]', 'input[autocomplete="current-password"]'];
  let passField = null;
  for (const sel of passwordSelectors) {
    try { passField = await page.waitForSelector(sel, { timeout: 3000 }); if (passField) break; } catch { }
  }
  if (!passField) { logFn('   ⚠️ Could not find password field'); return false; }

  await passField.click({ delay: 100 });
  await new Promise(resolve => setTimeout(resolve, 500));
  await passField.type(password, { delay: 30 });
  await new Promise(resolve => setTimeout(resolve, 1000));

  const signInBtn = await findButtonByText('Sign in') || await findButtonByText('Log in') || await findButtonByText('Continue');
  if (signInBtn) {
    try { await signInBtn.click(); } catch { try { await passField.press('Enter'); } catch { } }
  } else {
    try { await passField.press('Enter'); } catch { try { await page.click('button[type="submit"]'); } catch { } }
  }

  logFn('   ⏳ Waiting for ChatGPT to complete login...');
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      if (await isStandaloneChatGPTLoggedIn(page)) { logFn('   ✅ Automated ChatGPT login successful!'); return true; }
    } catch { }
    try {
      const errMsg = await page.evaluate(() => {
        const text = document.body?.innerText || '';
        return /incorrect|invalid.*password|wrong password|try again/i.test(text) ? text.substring(0, 200) : '';
      });
      if (errMsg) { logFn(`   ❌ Login error: ${errMsg}`); return false; }
    } catch { }
  }
  logFn('   ⚠️ Auto-login timed out');
  return false;
}

async function waitForStandaloneChatGPTLogin(page, logFn, timeoutMs = 600000, accountName) {
  if (await isStandaloneChatGPTLoggedIn(page)) return;

  if (accountName) {
    const creds = getChatGPTCredentials(accountName);
    if (creds && creds.email && creds.password) {
      const ok = await autoLoginChatGPT(page, creds.email, creds.password, logFn);
      if (ok) return;
    }
  }

  logFn('   ChatGPT is not logged in. Log in in the opened browser window, then wait here.');
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await sleep(5000);
    if (await isStandaloneChatGPTLoggedIn(page)) {
      logFn('   ChatGPT login detected. Continuing content generation.');
      return;
    }
  }
  throw new Error('Not logged in to ChatGPT after waiting for manual login.');
}

async function sendPromptToChatGPT(page, prompt, logFn, accountName, skipNavigation = false) {
  if (!skipNavigation) {
    logFn('   🌐 Navigating to ChatGPT...');
    await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(5000);
    await waitForStandaloneChatGPTLogin(page, logFn, 600000, accountName);
  } else {
    logFn('   💬 Using existing ChatGPT session...');
  }

  const assistantCountBefore = await page.evaluate(() => {
    return document.querySelectorAll('[data-message-author-role="assistant"]').length;
  });

  const promptSelectors = [
    '#prompt-textarea',
    '[data-testid="prompt-textarea"]',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="Send"]',
    'textarea[placeholder*="Ask"]',
    'div[contenteditable="true"][data-placeholder*="Message"]',
    'div[contenteditable="true"][data-placeholder*="Ask"]',
    'div[role="textbox"][contenteditable="true"]',
    '[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"]',
    '.ProseMirror',
    'textarea',
  ];

  let textarea = null;
  for (const sel of promptSelectors) {
    textarea = await page.$(sel);
    if (textarea) break;
  }

  if (!textarea) {
    throw new Error('Could not find ChatGPT prompt textarea');
  }

  const tagName = await textarea.evaluate(el => el.tagName.toLowerCase());

  logFn('   ✍️ Typing prompt into ChatGPT...');
  if (tagName === 'textarea' || tagName === 'input') {
    await textarea.evaluate(el => el.value = '');
    await textarea.type(prompt, { delay: 15 });
  } else {
    await textarea.evaluate((el, text) => {
      el.focus();
      el.textContent = '';
      document.execCommand('insertText', false, text);
      if ((el.textContent || '').length < text.length * 0.9) {
        el.textContent = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, prompt);
  }

  await sleep(1000);

  const sendButtonSelectors = [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send"]',
    'svg[aria-label*="Send"]',
    'button:has(svg.lucide-send)',
    'button:has(svg[aria-label="Send"])',
    'form button[type="submit"]',
    'button.absolute',
    'button:last-child',
  ];

  let sendBtn = null;
  for (const sel of sendButtonSelectors) {
    try {
      sendBtn = await page.$(sel);
      if (sendBtn) break;
    } catch { }
  }

  if (sendBtn) {
    await sendBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }

  logFn('   ⏳ Waiting for ChatGPT response...');

  await sleep(5000);

  const streamedResponseText = await waitForResponseComplete(page, 240000, logFn, assistantCountBefore);

  let responseText = await page.evaluate((previousAssistantCount) => {
    const assistantMessages = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
    const newAssistantMessages = assistantMessages.slice(previousAssistantCount);
    const assistantMsg = newAssistantMessages[newAssistantMessages.length - 1] || assistantMessages[assistantMessages.length - 1];
    if (!assistantMsg) return '';

    const markdown = assistantMsg.querySelector('.markdown, div[class*="markdown"], .prose');
    return (markdown?.textContent || assistantMsg.textContent || '').trim();
  }, assistantCountBefore);

  if (!responseText && streamedResponseText) {
    responseText = streamedResponseText;
  }

  logFn(`   ✅ ChatGPT response received (${responseText.length} chars)`);
  return responseText;
}

async function waitForResponseComplete(page, timeoutMs = 120000, logFn, previousAssistantCount = 0) {
  const startTime = Date.now();
  logFn('⏳ Waiting for GPT response to complete...');

  await new Promise(r => setTimeout(r, 3000));

  let stableCount = 0;
  let lastLength = 0;
  let lastChangeTime = Date.now();
  let latestResponseText = '';
  let latestResponseLength = 0;
  let hadResponseText = false;

  while (Date.now() - startTime < timeoutMs) {
    const status = await page.evaluate((assistantBaseline) => {
      function findStopButton() {
        return document.querySelector(
          '[data-testid="stop-button"], ' +
          'button[aria-label*="Stop" i], ' +
          'button[aria-label*="stop" i], ' +
          'button[class*="stop"]'
        );
      }

      function findAllAssistantMessages() {
        let msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (msgs.length > 0) return Array.from(msgs);
        msgs = document.querySelectorAll('article[data-testid*="assistant"]');
        if (msgs.length > 0) return Array.from(msgs);
        const articles = document.querySelectorAll('article[data-testid^="conversation-turn"]');
        const assistantArticles = Array.from(articles).filter(m =>
          m.textContent && !m.querySelector('[data-message-author-role="user"]')
        );
        if (assistantArticles.length > 0) return assistantArticles;
        const userMsgs = document.querySelectorAll('[data-message-author-role="user"]');
        if (userMsgs.length > 0) {
          const lastUser = userMsgs[userMsgs.length - 1];
          const result = [];
          let el = lastUser.nextElementSibling;
          while (el) {
            if (el.textContent && el.textContent.trim().length > 10) {
              result.push(el);
            }
            el = el.nextElementSibling;
          }
          if (result.length > 0) return result;
        }
        const main = document.querySelector('main') || document.querySelector('[class*="chat"]') || document.querySelector('[class*="conversation"]');
        if (main) {
          const children = Array.from(main.children).filter(c =>
            c.textContent && c.textContent.trim().length > 20 &&
            !c.querySelector('textarea, [contenteditable]')
          );
          if (children.length > 0) return children;
        }
        return Array.from(msgs);
      }

      const stopButton = findStopButton();

      const assistantMessages = findAllAssistantMessages();
      const newAssistantMessages = assistantMessages.slice(assistantBaseline);
      const lastMessage = newAssistantMessages[newAssistantMessages.length - 1];

      const markdown = lastMessage?.querySelector(
        '.markdown, ' +
        'div[class*="markdown"], ' +
        '.prose'
      );

      const responseText = markdown?.textContent || lastMessage?.textContent || '';
      const cleanText = responseText.trim();

      return {
        isStreaming: !!stopButton,
        hasResponse: !!lastMessage,
        responseText: cleanText.length,
        fullText: cleanText,
        preview: cleanText.substring(0, 100)
      };
    }, assistantBaseline);

    // Detect login redirect early
    try {
      const currentUrl = page.url();
      if (currentUrl && /\/auth\/(login|signup)/.test(currentUrl)) {
        throw new Error('GPT session redirected to login page — navigation detected');
      }
    } catch (urlErr) {
      if (urlErr.message?.includes('redirected to login')) throw urlErr;
    }

    if (status.responseText > 0) {
      latestResponseText = status.fullText;
      latestResponseLength = status.responseText;
      hadResponseText = true;
    }

    if (!status.isStreaming && hadResponseText && status.responseText === 0) {
      logFn(`âœ… Response complete (using captured stream at ${latestResponseLength} chars)`);
      return latestResponseText;
    }

    if (!status.isStreaming && status.hasResponse && status.responseText > 100) {
      if (status.responseText === lastLength) {
        stableCount++;
        // Must be stable for 4 checks AND at least 6 seconds since last change
        const timeSinceChange = Date.now() - lastChangeTime
        if (stableCount >= 4 && timeSinceChange >= 6000) {
          logFn(`✅ Response complete (stable at ${status.responseText} chars)`)
          return latestResponseText || status.fullText
        }
      } else {
        stableCount = 0
        lastLength = status.responseText
        lastChangeTime = Date.now()  // reset timer on any change
      }
    }

    logFn(`⏳ Waiting... streaming: ${status.isStreaming}, chars: ${status.responseText}`);
    await new Promise(r => setTimeout(r, 2000));
  }

  logFn('⚠️ Timeout waiting for response — saving debug info and proceeding with extraction');
  try {
    logFn(`📍 Current URL: ${page.url()}`);
    await page.screenshot({ path: `gpt-timeout-${Date.now()}.png` });
    const chatHtml = await page.evaluate(() => {
      const main = document.querySelector('main') || document.querySelector('[class*="chat"]') || document.querySelector('[class*="conversation"]') || document.body;
      return main.innerHTML.substring(0, 20000);
    });
    fs.writeFileSync(`gpt-debug-dom-${Date.now()}.html`, chatHtml);
  } catch (e) { }
  return latestResponseText;
}

function fillPrompt(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const placeholder = `{{${key}}}`;
    result = result.replaceAll(placeholder, value ?? '');
  }
  return result;
}

function parseProductResponse(text) {
  try {
    const result = extractAndRepairJSON(text, '[PRODUCT] ')
    const title = result.title || result.PRODUCT_TITLE || 'Untitled Product'
    const description = result.description || result.TAGLINE || ''
    const content = result.content || result.OVERVIEW || ''
    const topics = Array.isArray(result.topics) ? result.topics : []
    console.log(`✅ Product parsed: "${title}" (content: ${String(content).length} chars)`)
    return { title, description, content, topics, features: [], raw: result }
  } catch (err) {
    console.error('❌ parseProductResponse failed:', err.message)
    return { title: 'Untitled Product', description: '', content: '', topics: [], features: [] }
  }
}

function parseBlogResponse(text) {
  try {
    const result = extractAndRepairJSON(text, '[BLOG] ')
    const title = result.title || result.BLOG_TITLE || 'Untitled Blog Post'
    const content = result.content || result.BLOG_CONTENT || ''
    const metaDescription = result.meta_description || result.META_DESCRIPTION || ''
    const category = result.category || 'General'
    const tags = Array.isArray(result.tags) ? result.tags : []
    const topics = Array.isArray(result.topics) ? result.topics : []
    const blogSlug = result.slug || result.BLOG_SLUG || ''
    console.log(`✅ Blog parsed: "${title}" (content: ${String(content).length} chars)`)
    return { title, content, metaDescription, category, tags, topics, blogSlug }
  } catch (err) {
    console.error('❌ parseBlogResponse failed:', err.message)
    return { title: 'Untitled Blog Post', content: '', metaDescription: '', category: 'General', tags: [], topics: [], blogSlug: '' }
  }
}

function parseServiceResponse(text) {
  try {
    const result = extractAndRepairJSON(text, '[SERVICE] ')
    const title = result.title || result.SERVICE_TITLE || 'Untitled Service'
    const description = result.description || result.TAGLINE || ''
    const content = result.content || result.OVERVIEW || ''
    const topics = Array.isArray(result.topics) ? result.topics : []
    const serviceSlug = result.slug || result.SERVICE_SLUG || ''
    console.log(`✅ Service parsed: "${title}" (content: ${String(content).length} chars)`)
    return { title, description, content, topics, serviceSlug, deliverables: [] }
  } catch (err) {
    console.error('❌ parseServiceResponse failed:', err.message)
    return { title: 'Untitled Service', description: '', content: '', topics: [], serviceSlug: '', deliverables: [] }
  }
}

function isPlaceholderText(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return true;
  return [
    'blog post title here',
    'product title here',
    'service title here',
    'short description',
    'service description',
    'full product page content',
    'full blog post in markdown',
    'full service page content',
    '<original product title>',
    '<original seo blog title>',
    '<original service title>',
    '<specific product outcome tagline>',
    '<specific client outcome tagline>',
    '<complete markdown product page content>',
    '<complete markdown blog post>',
    '<complete markdown service page content>',
    'untitled product',
    'untitled blog post',
    'untitled service'
  ].some((placeholder) => text === placeholder || text.includes(placeholder));
}

function hasGeneratedContentQuality(item, type) {
  if (!item || isPlaceholderText(item.title) || isPlaceholderText(item.content)) return false;
  const content = String(item.content || '').trim();
  if (/^(system|user|assistant)\s*:/i.test(content)) return false;
  if (/\brespond with one valid json object only\b/i.test(content)) return false;
  if (/\{\{\s*job_/i.test(content)) return false;
  if (content.length < 250) return false;
  if (type === 'product' && isPlaceholderText(item.description)) return false;
  if (type === 'service' && isPlaceholderText(item.description)) return false;
  return true;
}

async function retryAsync(fn, options = {}) {
  const maxRetries = options.maxRetries || 1;
  const baseDelay = options.baseDelay || 2000;
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      await sleep(baseDelay * (attempt + 1));
    }
  }
  throw lastError;
}

async function generateForJob({ jobTitle, jobDescription, cookies, campaignId, gptAccountId, logFn, shouldAbort, jobSkills, jobBudget, existingBrowser, existingPage, sendPrompt }) {
  logFn(`\n${'='.repeat(60)}`);
  logFn(`🔄 PIPELINE START: ${jobTitle}`);
  logFn(`${'='.repeat(60)}`);

  const reuseSession = !!(existingBrowser && existingPage);
  let accountName = gptAccountId;
  try {
    const account = await storage.getGPTAccount(gptAccountId);
    if (account && account.name) accountName = account.name;
  } catch { }
  const { browser, page } = reuseSession
    ? { browser: existingBrowser, page: existingPage }
    : await launchBrowser(cookies, gptAccountId, accountName);
  const send = sendPrompt || ((prompt, skipNavigation) => (
    sendPromptToChatGPT(page, prompt, logFn, accountName, skipNavigation)
  ));

  const result = {
    product: null,
    blog: null,
    service: null,
    productParsed: null,
    blogParsed: null,
    serviceParsed: null,
  };
  let hasAnySuccess = false;

  try {
    const templateVars = {
      JOB_TITLE: jobTitle || '',
      JOB_DESCRIPTION: jobDescription || '',
      JOB_SKILLS_REQUIRED: jobSkills || 'Not specified',
      JOB_BUDGET: jobBudget || 'Not specified',
    };

    logFn(`\n[1/3] 📦 Generating Product Page...`);
    const productPromptRaw = loadPromptTemplate('product_page.txt');
    if (productPromptRaw) {
      let productParsed = null;
      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (shouldAbort && shouldAbort()) throw new Error('Campaign stopped by user');
          const productPrompt = fillPrompt(productPromptRaw, templateVars);
          logFn(`[1/3] ✍️ Sending prompt to ChatGPT...`);
          const productResponse = await retryAsync(
            () => send(productPrompt, reuseSession),
            { maxRetries: 1, baseDelay: 3000 }
          );
          logFn(`[1/3] 🔍 Parsing product response...`);
          console.log('🔍 RAW PRODUCT RESPONSE (first 500 chars):', productResponse.substring(0, 500))
          productParsed = parseProductResponse(productResponse);

          if (hasGeneratedContentQuality(productParsed, 'product')) {
            break;
          }

          logFn(`[1/3] ⚠️ Attempt ${attempt}/${maxAttempts}: low-quality response (title="${productParsed.title}", content=${productParsed.content.length}chars), retrying...`);
        } catch (productError) {
          logFn(`[1/3] ⚠️ Attempt ${attempt}/${maxAttempts} failed: ${productError.message}`);
          console.error(`[PRODUCT ERROR]`, productError?.stack);
          if (attempt === maxAttempts) {
            productParsed = { title: 'Untitled Product', description: '', content: '', topics: [] };
          }
        }
        await sleep(3000);
      }

      if (hasGeneratedContentQuality(productParsed, 'product')) {
        result.product = await storage.createProduct({
          campaignId,
          title: productParsed.title,
          description: productParsed.description,
          content: productParsed.content,
          topics: productParsed.topics,
          status: 'published',
        });
        result.productParsed = productParsed;
        hasAnySuccess = true;
        logFn(`[1/3] ✅ Product created: "${productParsed.title}"`);
      }
      await sleep(2000);
    } else {
      logFn(`[1/3] ⏭️ Product prompt missing — skipping`);
    }

    logFn(`\n[2/3] 📝 Generating Blog Post...`);
    const blogPromptRaw = loadPromptTemplate('blog_page.txt');
    if (blogPromptRaw) {
      let blogParsed = null;
      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (shouldAbort && shouldAbort()) throw new Error('Campaign stopped by user');
          const blogPrompt = fillPrompt(blogPromptRaw, templateVars);
          logFn(`[2/3] ✍️ Sending prompt to ChatGPT...`);
          const blogResponse = await retryAsync(
            () => send(blogPrompt, true),
            { maxRetries: 1, baseDelay: 3000 }
          );
          logFn(`[2/3] 🔍 Parsing blog response...`);
          console.log('🔍 RAW BLOG RESPONSE (first 500 chars):', blogResponse.substring(0, 500))
          blogParsed = parseBlogResponse(blogResponse);

          if (hasGeneratedContentQuality(blogParsed, 'blog')) {
            break;
          }

          logFn(`[2/3] ⚠️ Attempt ${attempt}/${maxAttempts}: low-quality response (title="${blogParsed.title}", content=${blogParsed.content.length}chars), retrying...`);
        } catch (blogError) {
          logFn(`[2/3] ⚠️ Attempt ${attempt}/${maxAttempts} failed: ${blogError.message}`);
          console.error(`[BLOG ERROR]`, blogError?.stack);
          if (attempt === maxAttempts) {
            blogParsed = { title: 'Untitled Blog Post', content: '', metaDescription: '', category: 'General', tags: [], topics: [], blogSlug: '' };
          }
        }
        await sleep(3000);
      }

      if (hasGeneratedContentQuality(blogParsed, 'blog')) {
        result.blog = await storage.createBlogPost({
          campaignId,
          title: blogParsed.title,
          content: blogParsed.content,
          topics: blogParsed.topics,
          status: 'published',
        });
        result.blogParsed = blogParsed;
        hasAnySuccess = true;
        logFn(`[2/3] ✅ Blog created: "${blogParsed.title}"`);
      }
      await sleep(2000);
    } else {
      logFn(`[2/3] ⏭️ Blog prompt missing — skipping`);
    }

    logFn(`\n[3/3] 🔧 Generating Service Page...`);
    const servicePromptRaw = loadPromptTemplate('service_page.txt');
    if (servicePromptRaw) {
      let serviceParsed = null;
      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (shouldAbort && shouldAbort()) throw new Error('Campaign stopped by user');
          const servicePrompt = fillPrompt(servicePromptRaw, templateVars);
          logFn(`[3/3] ✍️ Sending prompt to ChatGPT...`);
          const serviceResponse = await retryAsync(
            () => send(servicePrompt, true),
            { maxRetries: 1, baseDelay: 3000 }
          );
          logFn(`[3/3] 🔍 Parsing service response...`);
          console.log('🔍 RAW SERVICE RESPONSE (first 500 chars):', serviceResponse.substring(0, 500))
          serviceParsed = parseServiceResponse(serviceResponse);

          if (hasGeneratedContentQuality(serviceParsed, 'service')) {
            break;
          }

          logFn(`[3/3] ⚠️ Attempt ${attempt}/${maxAttempts}: low-quality response (title="${serviceParsed.title}", content=${serviceParsed.content.length}chars), retrying...`);
        } catch (serviceError) {
          logFn(`[3/3] ⚠️ Attempt ${attempt}/${maxAttempts} failed: ${serviceError.message}`);
          console.error(`[SERVICE ERROR]`, serviceError?.stack);
          if (attempt === maxAttempts) {
            serviceParsed = { title: 'Untitled Service', description: '', content: '', topics: [], serviceSlug: '', deliverables: [] };
          }
        }
        await sleep(3000);
      }

      if (hasGeneratedContentQuality(serviceParsed, 'service')) {
        result.service = await storage.createService({
          campaignId,
          title: serviceParsed.title,
          description: serviceParsed.description,
          content: serviceParsed.content,
          topics: serviceParsed.topics,
          status: 'published',
        });
        result.serviceParsed = serviceParsed;
        hasAnySuccess = true;
        logFn(`[3/3] ✅ Service created: "${serviceParsed.title}"`);
      }
      await sleep(2000);
    } else {
      logFn(`[3/3] ⏭️ Service prompt missing — skipping`);
    }

    if (!(result.product && result.blog && result.service)) {
      logFn('\nIncomplete content set generated. Rolling back partial content.');
      await Promise.all([
        result.product ? storage.deleteProduct(result.product.id).catch(() => { }) : Promise.resolve(),
        result.blog ? storage.deleteBlogPost(result.blog.id).catch(() => { }) : Promise.resolve(),
        result.service ? storage.deleteService(result.service.id).catch(() => { }) : Promise.resolve(),
      ]);
      throw new Error('Incomplete content set: product, blog, and service are all required');
    }

    if (hasAnySuccess) {
      logFn(`\n✅ ===== CONTENT GENERATION COMPLETE =====`);
      if (result.productParsed) logFn(`   📦 Product: ${result.productParsed.title}`);
      if (result.blogParsed) logFn(`   📝 Blog: ${result.blogParsed.title}`);
      if (result.serviceParsed) logFn(`   🔧 Service: ${result.serviceParsed.title}`);
    } else {
      throw new Error('All content generation steps failed');
    }

    return result;
  } catch (error) {
    logFn(`\n❌ Content generation error: ${error.message}`);
    console.error(`[CONTENT GENERATOR ERROR]`, error.stack);
    throw error;
  } finally {
    if (!reuseSession) {
      await browser.close();
    }
    logFn(`🏁 Pipeline finished for: ${jobTitle}`);
  }
}

/**
 * Upwork Campaign Manager
 * Continuously fetches Upwork jobs, filters them with GPT, and creates repos
 */
class UpworkCampaignManager extends EventEmitter {
  constructor() {
    super();
    this.running = new Map();
    this.seenJobIds = new Map(); // Track seen jobs per campaign: campaignId -> Set of job IDs
    this.stoppedByUser = new Set(); // Track campaigns explicitly stopped by user click
    this.activeBrowsers = new Map(); // campaignId -> puppeteer Browser instance
    this.prompts = {
      filter: '',
      scraperReadme: '',
      automationReadme: ''
    };
    // Circuit breaker state per campaign
    this.failureCounts = new Map(); // campaignId -> consecutive failure count
    this.circuitBreakerThreshold = 5; // Pause campaign after 5 consecutive failures
    this.invalidGptAccounts = new Set(); // GPT accounts with invalid cookies
    this._browserLocks = {}; // Per-campaign mutex for concurrent Bridge API operations
    this.bridgeJobQueueTail = Promise.resolve();
    this.bridgeQueueDepth = 0;
    this.loadPrompts();
    console.log('UpworkCampaignManager initialized');
  }

  processSingleJob(jobData, source = 'bridge') {
    const jobId = jobData.id || jobData.url || `bridge_${Date.now()}`;
    const title = jobData.title || 'Unknown Job';
    const queuePosition = this.bridgeQueueDepth + 1;
    this.bridgeQueueDepth += 1;

    const task = this.bridgeJobQueueTail
      .catch((error) => console.error('Previous bridge job failed:', error))
      .then(() => this._processSingleJob(jobData, source));

    // Keep the queue alive after a failed job, so later jobs are never blocked.
    this.bridgeJobQueueTail = task.catch((error) => {
      console.error(`Queued bridge job failed: ${title}`, error);
    });

    task.then(
      (result) => console.log(`Bridge queue completed "${title}": ${result.status}`),
      (error) => console.error(`Bridge queue failed "${title}":`, error)
    ).finally(() => {
      this.bridgeQueueDepth = Math.max(0, this.bridgeQueueDepth - 1);
    });

    console.log(`Bridge job queued (${queuePosition}): "${title}"`);
    return { status: 'queued', queue_position: queuePosition, job_id: jobId, title };
  }

  async _processSingleJob(jobData, source = 'bridge') {
    const jobId = jobData.id || jobData.url || `bridge_${Date.now()}`;
    const title = jobData.title || 'Unknown Job';
    const campaign = await this._findCampaignForJob(jobData.keyword, jobData.category);

    if (!campaign) {
      console.log(`No campaign found for keyword="${jobData.keyword}" category="${jobData.category}"`);
      return { status: 'no_campaign', job_id: jobData.id, title };
    }

    const id = campaign.id;
    const channelInfo = jobData.discord_channel_id
      ? ` channel_id=${jobData.discord_channel_id}${jobData.discord_channel_name ? ` (${jobData.discord_channel_name})` : ''}`
      : '';
    this.log(id, 'info', `Bridge received job: "${title}" (source: ${source})${channelInfo}`);

    let cookies;
    try {
      cookies = await this.getGPTCookies(campaign.gptAccountId, id);
    } catch (error) {
      this.log(id, 'error', `Cannot process bridge job: ${error.message}`);
      return { status: 'error', error: error.message, job_id: jobData.id, title };
    }

    try {
      const idDuplicate = jobId ? await storage.checkDuplicateByJobId(jobId) : null;
      if (idDuplicate) {
        this.log(id, 'warning', `Duplicate by job ID: ${jobId}`);
        return { status: 'duplicate', job_id: jobData.id, title, existing: idDuplicate };
      }

      const titleDuplicate = await storage.checkJobDuplicate(jobData.title, jobData.description || '', 0.85);
      if (titleDuplicate) {
        this.log(id, 'warning', `Duplicate by title: "${title}"`);
        return { status: 'duplicate', job_id: jobData.id, title, existing: titleDuplicate };
      }
    } catch (error) {
      this.log(id, 'warning', `Duplicate check failed: ${error.message}`);
    }

    const jobForFilter = {
      title: jobData.title,
      description: jobData.description || '',
      skills: Array.isArray(jobData.skills) ? jobData.skills : (jobData.skills ? [jobData.skills] : []),
      budget: jobData.budget || 'Not specified',
      url: jobData.url || '',
      id: jobData.id || '',
      ciphertext: jobData.id || '',
    };

    const jobDescription = upworkJobService.buildJobDescription(jobForFilter);

    // Profiles are per GPT account, not per campaign. Serializing on the account
    // prevents two campaigns from typing into the same ChatGPT session at once.
    return this._withExclusiveBrowser(`gpt:${campaign.gptAccountId || id}`, async () => {
      // Create shared browser for both filter and content generation
      let sharedBrowser = null;
      let sharedPage = null;
      let filterResult;

      try {
        this.log(id, 'info', 'Launching shared ChatGPT session for filter + content generation...');
        const launched = await this.launchChatGPTBrowser(
          campaign.gptAccountId,
          id
        );
        sharedBrowser = launched.browser;
        sharedPage = launched.page;
        this.activeBrowsers.set(id, sharedBrowser);

        // Navigate and set up session once
        await this.navigateToChatGPT(sharedPage, id);
        const profileHasSession = await this.checkChatGPTLoggedInWithRetry(sharedPage);
        const sanitizedCookies = profileHasSession ? [] : this.sanitizeCookies(cookies);
        if (profileHasSession) {
          this.log(id, 'info', 'Using saved ChatGPT browser session.');
        }
        if (sanitizedCookies.length > 0) {
          await sharedPage.setCookie(...sanitizedCookies);
          await this.navigateToChatGPT(sharedPage, id);
        }
        sharedPage = await this.ensureChatGPTSession(sharedPage, id, campaign.gptAccountId);

        // Filter (no retry — uses existing browser for speed)
        this.log(id, 'info', 'Checking job viability with GPT...');
        // Diagnosis reference: SELECTOR_PROMPT_INPUT and SELECTOR_STOP_BUTTON
        // in diagnosis.md. A stuck conversation is reset before the one retry.
        filterResult = await this.retryWithBackoff(
          () => this._filterJobWithGPTInternal(
            jobForFilter, cookies, id, campaign.gptAccountId, sharedPage, sharedBrowser
          ),
          {
            maxRetries: 1,
            baseDelay: 3000,
            shouldRetry: (error) => !/cloudflare|challenge page/i.test(error?.message || ''),
            onRetry: async (attempt, delay, error) => {
              this.log(id, 'warning', `GPT viability retry ${attempt}/1 after ${delay}ms: ${error.message}`);
              await this.startNewChat(sharedPage, (message) => this.log(id, 'info', message));
            }
          }
        );
      } catch (error) {
        this.log(id, 'error', `GPT viability check failed: ${error.message}`);
        // B: Auth recovery — try refreshing cookies on auth errors
        if (this.isChatGPTAuthError(error)) {
          try {
            this.log(id, 'warning', 'Auth error during filter — refreshing GPT session...');
            await this._refreshCookiesViaAutoLogin(id, campaign.gptAccountId);
            cookies = await this.getGPTCookies(campaign.gptAccountId, id);
          } catch (refreshError) {
            this.log(id, 'error', `Cookie refresh failed: ${refreshError.message}`);
          }
        }
        if (sharedBrowser) {
          await sharedBrowser.close().catch(() => { });
          this.activeBrowsers.delete(id);
        }
        return { status: 'error', error: error.message, job_id: jobData.id, title };
      }

      if (!filterResult.viable) {
        this.log(id, 'warning', `Job rejected by GPT: ${filterResult.reason || 'Not viable'}`);
        await storage.storeProcessedJob({
          id: jobId,
          title: jobData.title,
          description: jobData.description || '',
          campaignId: id,
          niche: filterResult.niche || 'Other',
          platform: filterResult.platform || 'None',
          tool: filterResult.tool || 'None',
          repoUrl: '',
          upworkJobUrl: jobData.url || '',
          viable: false,
          rejectionReason: filterResult.reason || 'GPT filter rejected',
        }).catch((error) => this.log(id, 'warning', `Failed to store rejected job: ${error.message}`));
        if (sharedBrowser) {
          await sharedBrowser.close().catch(() => { });
          this.activeBrowsers.delete(id);
        }
        return { status: 'rejected', job_id: jobData.id, title, reason: filterResult.reason || 'Not viable' };
      }

      this.log(id, 'success', `Job viable: ${filterResult.platform || 'unknown platform'} / ${filterResult.tool || 'unknown tool'}`);

      let contentResult;
      try {
        contentResult = await generateForJob({
          jobTitle: jobData.title,
          jobDescription,
          cookies,
          campaignId: id,
          gptAccountId: campaign.gptAccountId,
          logFn: (msg) => this.log(id, 'info', msg),
          shouldAbort: () => false,
          jobSkills: Array.isArray(jobData.skills) ? jobData.skills.join(', ') : (jobData.skills || 'Not specified'),
          jobBudget: jobData.budget || 'Not specified',
          existingBrowser: sharedBrowser,
          existingPage: sharedPage,
          sendPrompt: (prompt) => this.sendPromptAndReadGPTResponse(sharedPage, prompt, id),
        });
      } catch (error) {
        this.log(id, 'error', `Content generation failed: ${error.message}`);
        // B: Auth recovery — try refreshing cookies on auth errors
        if (this.isChatGPTAuthError(error)) {
          try {
            this.log(id, 'warning', 'Auth error during content gen — refreshing GPT session...');
            await this._refreshCookiesViaAutoLogin(id, campaign.gptAccountId);
            cookies = await this.getGPTCookies(campaign.gptAccountId, id);
          } catch (refreshError) {
            this.log(id, 'error', `Cookie refresh failed: ${refreshError.message}`);
          }
        }
        if (sharedBrowser) {
          await sharedBrowser.close().catch(() => { });
          this.activeBrowsers.delete(id);
        }
        return { status: 'error', error: error.message, job_id: jobData.id, title };
      } finally {
        if (sharedBrowser) {
          await sharedBrowser.close().catch(() => { });
          this.activeBrowsers.delete(id);
        }
      }

      await storage.createJobsSelected({
        campaignId: id,
        title: jobData.title,
        description: jobDescription,
        niche: filterResult.niche || 'Other',
        platform: filterResult.platform || 'None',
        tool: filterResult.tool || 'None',
        upworkJobUrl: jobData.url || '',
      }).catch((error) => this.log(id, 'warning', `Failed to store selected job: ${error.message}`));

      await storage.storeProcessedJob({
        id: jobId,
        title: jobData.title,
        description: jobData.description || '',
        campaignId: id,
        niche: filterResult.niche || 'Other',
        platform: filterResult.platform || 'None',
        tool: filterResult.tool || 'None',
        repoUrl: '',
        upworkJobUrl: jobData.url || '',
        viable: true,
      }).catch((error) => this.log(id, 'warning', `Failed to store processed job: ${error.message}`));

      return {
        status: 'success',
        job_id: jobData.id,
        campaign_id: id,
        title,
        viability: {
          viable: true,
          niche: filterResult.niche,
          platform: filterResult.platform,
          tool: filterResult.tool,
        },
        content: {
          product: { id: contentResult.product.id, title: contentResult.productParsed.title },
          blog: { id: contentResult.blog.id, title: contentResult.blogParsed.title },
          service: { id: contentResult.service.id, title: contentResult.serviceParsed.title },
        },
      };
    }); // end _withExclusiveBrowser
  }

  async _findCampaignForJob(keyword, category) {
    const campaigns = await storage.getUpworkCampaigns();
    if (!campaigns || campaigns.length === 0) return null;

    // Only a deliberately started campaign may consume jobs from Discord.
    // This prevents stopped test campaigns with matching keywords from taking work.
    const activeCampaigns = campaigns.filter((campaign) => (
      String(campaign.status || '').toLowerCase() === 'running'
    ));
    if (activeCampaigns.length === 0) return null;

    const normalize = (value) => String(value || '').toLowerCase();
    const kw = normalize(keyword);
    const cat = normalize(category);

    if (kw) {
      const exact = activeCampaigns.find((campaign) => normalize(campaign.upworkSearchInput).includes(kw));
      if (exact) return exact;

      const byName = activeCampaigns.find((campaign) => normalize(campaign.name).includes(kw));
      if (byName) return byName;
    }

    if (cat) {
      const byCategory = activeCampaigns.find((campaign) => normalize(campaign.name).includes(cat));
      if (byCategory) return byCategory;
    }

    return activeCampaigns[0];
  }

  /**
   * Retry an async function with exponential backoff
   * @param {Function} fn - Async function to retry
   * @param {Object} options - Retry options
   */
  async retryWithBackoff(fn, options = {}) {
    const maxRetries = options.maxRetries || 2;
    const baseDelay = options.baseDelay || 2000;
    const maxDelay = options.maxDelay || 20000;
    const onRetry = options.onRetry || (() => { });
    const shouldRetry = options.shouldRetry || (() => true);

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (!shouldRetry(error)) break;
        if (attempt === maxRetries) break;
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        await onRetry(attempt + 1, delay, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  /**
   * Track failure for circuit breaker logic
   */
  recordFailure(campaignId, error) {
    const count = (this.failureCounts.get(campaignId) || 0) + 1;
    this.failureCounts.set(campaignId, count);
    return count;
  }

  /**
   * Reset failure count on success
   */
  recordSuccess(campaignId) {
    this.failureCounts.set(campaignId, 0);
  }

  /**
   * Check if campaign has tripped circuit breaker
   */
  isCircuitOpen(campaignId) {
    return (this.failureCounts.get(campaignId) || 0) >= this.circuitBreakerThreshold;
  }

  isChatGPTAuthError(error) {
    return /not logged in to chatgpt|update gpt account cookies|cookies marked invalid|session.*expired|unauthorized|login required/i.test(error?.message || '');
  }

  /**
   * Check if job was posted within the specified number of minutes
   * @param {string|number|Date} createdDateTime - Job posting time
   * @param {number} minutes - Time window in minutes (default: 5)
   * @returns {boolean}
   */
  isJobPostedWithinMinutes(createdDateTime, minutes = 15) {
    if (!createdDateTime || createdDateTime === 'Unknown') {
      return false;
    }

    const now = new Date();
    let jobDate = null;

    try {
      // Handle Date object
      if (createdDateTime instanceof Date) {
        jobDate = createdDateTime;
      }
      // Handle timestamp (milliseconds)
      else if (typeof createdDateTime === 'number') {
        jobDate = new Date(createdDateTime);
      }
      // Handle string
      else if (typeof createdDateTime === 'string') {
        // Try ISO format first
        jobDate = new Date(createdDateTime);

        // If invalid, try parsing as timestamp
        if (isNaN(jobDate.getTime())) {
          const timestamp = parseFloat(createdDateTime);
          if (!isNaN(timestamp)) {
            jobDate = new Date(timestamp);
          }
        }
      }

      if (!jobDate || isNaN(jobDate.getTime())) {
        return false;
      }

      // Calculate time difference in minutes
      const diffMs = now - jobDate;
      const diffMinutes = diffMs / (1000 * 60);

      return diffMinutes <= minutes;

    } catch (error) {
      console.error('Error parsing job date:', error);
      return false;
    }
  }
  extractTopicsFromMetadata(metadataBlock) {
    console.log('\n🔍 Extracting topics from metadata...');
    const topics = [];
    const singleLineMatch = metadataBlock.match(/(?:Related Topics|Topics|Tags|Keywords):\s*([^\n]+)/i);
    if (singleLineMatch) {
      const raw = singleLineMatch[1];
      const parts = raw.split(/[,;|]/).map(t => t.trim()).filter(t => t.length > 0);
      topics.push(...parts);
    }
    if (topics.length > 0) return topics.slice(0, 20);
    return [];
  }

  /**
   * Log function - same as before
   */
  /**
   * Load prompts from text files
   */
  loadPrompts() {
    const promptsDir = path.join(__dirname, '..', '..', 'prompts');

    const loadPrompt = (filename) => {
      try {
        const content = fs.readFileSync(path.join(promptsDir, filename), 'utf-8').trim();
        if (!content) {
          console.warn(`⚠️ Prompt file empty: ${filename}`);
        }
        return content;
      } catch (err) {
        console.warn(`⚠️ Prompt file missing: ${filename}`);
        return '';
      }
    };

    this.prompts.filter = loadPrompt('upwork-saas-filter.txt');
    this.prompts.scraperReadme = loadPrompt('upwork-scraper-readme.txt');
    this.prompts.automationReadme = loadPrompt('upwork-automation-readme.txt');

    console.log('✅ Loaded prompts (missing files are OK — will skip those steps)');
  }

  log(campaignId, level, message) {
    const evt = { campaignId, level, message, timestamp: Date.now() };
    storage.appendLog(campaignId, evt);
    this.emit('log', evt);

    const emoji = {
      info: '[info]',
      success: '[success]',
      error: '[error]',
      warning: '[warning]'
    }[level] || '[log]';

    console.log(`${emoji} [${campaignId}] ${message}`);
  }

  async setStatus(campaignId, status) {
    console.log(`Setting Upwork campaign ${campaignId} status to: ${status}`);
    await storage.updateUpworkCampaign(campaignId, { status });
    this.emit('status', { campaignId, status });
  }

  updateProgress(campaignId, processed, total, viable = 0, nonViable = 0) {
    const progress = { processed, total, viable, nonViable };
    console.log(`Progress update: ${processed}/${total} (Viable: ${viable}, Non-viable: ${nonViable})`);
    storage.updateUpworkCampaign(campaignId, { progress });
    this.emit('progress', { campaignId, ...progress });
  }

  /**
   * Filter job with GPT using the SaaS viability filter prompt
   * @param {Object} jobDetails - Detailed job information
   * @param {string} cookies - GPT account cookies
   * @returns {Promise<{viable: boolean, niche: string, platform: string, tool: string}>}
   */
  getChatGPTComposerSelector() {
    return [
      'textarea#prompt-textarea',
      '#prompt-textarea',
      '[data-testid="prompt-textarea"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Ask"]',
      '[role="textbox"][contenteditable="true"]',
      'div[contenteditable="true"]',
      '.ProseMirror'
    ].join(', ');
  }

  async hasInvalidOpenAIState(page) {
    return page.evaluate(() => (
      /invalid_state|session (is )?no longer valid|session ended/i.test(document.body?.innerText || '')
    )).catch(() => false);
  }

  async clearChatGPTAuthState(page) {
    const cookies = await page.cookies('https://chatgpt.com', 'https://auth.openai.com').catch(() => []);
    if (cookies.length > 0) await page.deleteCookie(...cookies).catch(() => { });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    }).catch(() => { });
  }

  async navigateToChatGPT(page, campaignId) {
    try {
      await page.goto('https://chatgpt.com/', {
        // ChatGPT keeps long-lived connections open, so network-idle can hang.
        waitUntil: 'domcontentloaded',
        timeout: 90000
      });
    } catch (error) {
      if (!/timeout/i.test(error.message || '')) throw error;
      this.log(campaignId, 'warning', 'ChatGPT navigation was slow, continuing with the loaded page.');
    }

    // Wait for SPA to settle and check for stale session
    await page.waitForFunction(() => document.body && document.readyState !== 'loading', { timeout: 30000 }).catch(() => { });
    await new Promise(resolve => setTimeout(resolve, 5000));

    if (await this.hasInvalidOpenAIState(page)) {
      this.log(campaignId, 'warning', 'Stale OpenAI session detected. Clearing browser auth state and redirecting to login.');
      await this.clearChatGPTAuthState(page);
      await page.goto('https://chatgpt.com/auth/login', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    await page.waitForFunction(() => document.body && document.readyState !== 'loading', { timeout: 30000 }).catch(() => { });
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async waitForChatGPTComposer(page) {
    const selector = this.getChatGPTComposerSelector();
    await page.waitForFunction((composerSelector) => {
      const candidates = Array.from(document.querySelectorAll(composerSelector));
      return candidates.some((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      });
    }, { timeout: 45000 }, selector);
    return selector;
  }

  async focusChatGPTComposer(page, selector = this.getChatGPTComposerSelector()) {
    await page.evaluate((composerSelector) => {
      const candidates = Array.from(document.querySelectorAll(composerSelector));
      const el = candidates.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const style = window.getComputedStyle(candidate);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      });
      if (!el) throw new Error('Visible ChatGPT prompt input not found');
      el.scrollIntoView({ block: 'center', inline: 'center' });
      el.focus();
    }, selector);
  }

  async startNewChat(page, logFn) {
    logFn('Starting a clean ChatGPT conversation before retrying...');

    const clicked = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, a'));
      const newChat = candidates.find((element) => (
        /new chat/i.test((element.textContent || '').trim())
        && element.getBoundingClientRect().width > 0
        && element.getBoundingClientRect().height > 0
      ));
      if (!newChat) return false;
      newChat.click();
      return true;
    });

    if (!clicked) {
      await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    await page.waitForFunction(() => (
      Array.from(document.querySelectorAll('button')).some((element) => (
        /^clear chat$/i.test((element.textContent || '').trim()) && element.offsetParent !== null
      ))
    ), { timeout: 5000 }).catch(() => { });
    const cleared = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const confirm = buttons.find((element) => /^clear chat$/i.test((element.textContent || '').trim()));
      if (!confirm || confirm.offsetParent === null) return false;
      confirm.click();
      return true;
    });
    if (cleared) logFn('Confirmed the ChatGPT clear-chat dialog.');

    const selector = await this.waitForChatGPTComposer(page);
    await page.waitForFunction((composerSelector) => {
      const composer = Array.from(document.querySelectorAll(composerSelector)).find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return composer && !(composer.value || composer.textContent || composer.innerText || '').trim();
    }, { timeout: 15000 }, selector).catch(() => { });
  }

  /**
   * Send prompt using clipboard paste method (most reliable)
   */
  async sendPromptToGPT(page, prompt, logFn) {
    logFn(`Preparing to send prompt...`);
    logFn(`Using direct DOM method...`);
    const textareaSelector = await this.waitForChatGPTComposer(page);
    await this.sendPromptDirectDOM(page, prompt, textareaSelector);
    logFn(`Prompt entered successfully`);
    const userMessageCountBefore = await page.evaluate(() => (
      document.querySelectorAll('[data-message-author-role="user"]').length
    ));

    // Wait a moment for the text to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Find and click send button
    logFn(`📤 Sending message...`);
    const sendButtonSelector = [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[data-testid="fruitfly-send-button"]',
      'button:has(svg.lucide-send)',
      'button svg[aria-label*="Send"]',
      'button.absolute.bottom-3',
    ].join(', ');

    try {
      await page.waitForFunction((selector) => {
        return Array.from(document.querySelectorAll(selector)).some((button) => {
          const rect = button.getBoundingClientRect();
          const style = window.getComputedStyle(button);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !button.disabled;
        });
      }, { timeout: 7000 }, sendButtonSelector);
      const clicked = await page.evaluate((selector) => {
        const button = Array.from(document.querySelectorAll(selector)).find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          const style = window.getComputedStyle(candidate);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !candidate.disabled;
        });
        if (!button) return false;
        button.click();
        return true;
      }, sendButtonSelector);
      if (!clicked) throw new Error('Visible send button not found');
    } catch (e) {
      // Fallback: press Enter
      logFn(`⚠️ Send button not found, using Enter key...`);
      await this.focusChatGPTComposer(page).catch(() => { });
      await page.keyboard.press('Enter');
    }

    logFn(`✅ Message sent`);
    const submitted = await page.waitForFunction((previousCount) => (
      document.querySelectorAll('[data-message-author-role="user"]').length > previousCount
    ), { timeout: 20000 }, userMessageCountBefore).then(() => true).catch(() => false);

    if (!submitted) {
      throw new Error('ChatGPT did not accept the prompt after send.');
    }
  }

  async sendPromptAndReadGPTResponse(page, prompt, campaignId) {
    const assistantBaseline = await page.evaluate(() => (
      document.querySelectorAll('[data-message-author-role="assistant"]').length
    ));

    await this.sendPromptToGPT(page, prompt, (message) => this.log(campaignId, 'info', message));
    await this.waitForGPTResponse(page, (message) => this.log(campaignId, 'info', message), {
      maxStableChecks: 3,
      checkInterval: 1500,
      minLength: 50,
      overallTimeoutMs: 120000,
      assistantBaseline,
    });

    const response = await this.extractGPTResponse(page, assistantBaseline);
    if (!response) throw new Error('ChatGPT returned an empty response.');
    return response;
  }

  /**
   * Send prompt by directly manipulating the DOM (fallback method)
   */
  async sendPromptDirectDOM(page, prompt, textareaSelector) {
    await page.evaluate((selector, text) => {
      const el = Array.from(document.querySelectorAll(selector)).find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const style = window.getComputedStyle(candidate);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      });
      if (!el) throw new Error('ChatGPT prompt input not found');

      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.contentEditable === 'true') {
        el.focus();
        el.textContent = '';
        document.execCommand('insertText', false, text);
        if ((el.textContent || '').length < text.length * 0.9) {
          el.textContent = text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));

        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        });
        el.dispatchEvent(inputEvent);
      } else {
        throw new Error('ChatGPT prompt input is not editable');
      }
    }, textareaSelector, prompt);
  }

  /**
   * Wait for GPT response to complete with robust detection and timeout safeguards
   * Backwards compatible signature: (page, logFn, maxStableChecks?, checkInterval?, minLength?)
   */
  async waitForGPTResponse(page, logFn, a = 5, b = 2000, c = 50) {
    // Support old positional args or new options object
    const opts = typeof a === 'object'
      ? { maxStableChecks: 5, checkInterval: 2000, minLength: 50, overallTimeoutMs: 240000, resendOnIdleMs: 15000, initialResponseTimeoutMs: 30000, assistantBaseline: 0, ...a }
      : { maxStableChecks: a, checkInterval: b, minLength: c, overallTimeoutMs: 240000, resendOnIdleMs: 15000, initialResponseTimeoutMs: 30000, assistantBaseline: 0 };

    let previousLength = 0;
    let stableCount = 0;
    const start = Date.now();
    let lastChangeTs = Date.now();
    let resentOnce = false;

    logFn(`⏳ Waiting for response to complete...`);

    while (true) {
      // Timeout guard
      const elapsed = Date.now() - start;
      if (elapsed > opts.overallTimeoutMs) {
        await page.evaluate(() => {
          const stopButton = document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop" i]');
          stopButton?.click();
        }).catch(() => { });
        throw new Error(`GPT response timed out after ${Math.round(opts.overallTimeoutMs / 1000)}s without a usable reply.`);
      }

      await new Promise(resolve => setTimeout(resolve, opts.checkInterval));

      const state = await page.evaluate((assistantBaseline) => {
        function findAllAssistantMessages() {
          let msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
          if (msgs.length > 0) return Array.from(msgs);
          msgs = document.querySelectorAll('article[data-testid*="assistant"]');
          if (msgs.length > 0) return Array.from(msgs);
          const articles = document.querySelectorAll('article[data-testid^="conversation-turn"]');
          const assistantArticles = Array.from(articles).filter(m =>
            m.textContent && !m.querySelector('[data-message-author-role="user"]')
          );
          if (assistantArticles.length > 0) return assistantArticles;
          const userMsgs = document.querySelectorAll('[data-message-author-role="user"]');
          if (userMsgs.length > 0) {
            const lastUser = userMsgs[userMsgs.length - 1];
            const result = [];
            let el = lastUser.nextElementSibling;
            while (el) {
              if (el.textContent && el.textContent.trim().length > 10) {
                result.push(el);
              }
              el = el.nextElementSibling;
            }
            if (result.length > 0) return result;
          }
          const main = document.querySelector('main') || document.querySelector('[class*="chat"]') || document.querySelector('[class*="conversation"]');
          if (main) {
            const children = Array.from(main.children).filter(c =>
              c.textContent && c.textContent.trim().length > 20 &&
              !c.querySelector('textarea, [contenteditable]')
            );
            if (children.length > 0) return children;
          }
          return Array.from(msgs);
        }

        function findIsGenerating() {
          return !!(
            document.querySelector('[data-testid="stop-button"]') ||
            document.querySelector('button[aria-label*="Stop" i]') ||
            document.querySelector('button[aria-label*="stop" i]') ||
            document.querySelector('button[class*="stop"]')
          );
        }

        function findHasRegenerate() {
          return !!(
            document.querySelector('[data-testid="regenerate-button"]') ||
            document.querySelector('button[aria-label*="Regenerate" i]') ||
            document.querySelector('button[aria-label*="regenerate" i]')
          );
        }

        const messages = findAllAssistantMessages();
        const newMessages = messages.slice(assistantBaseline);
        const last = newMessages.length > 0 ? newMessages[newMessages.length - 1] : null;
        const length = last ? (last.textContent?.length || 0) : 0;
        const isGenerating = findIsGenerating();
        const hasRegenerate = findHasRegenerate();
        const pageText = document.body?.innerText || '';
        const challengeActive = /just a moment|checking your browser|verify you are human|cloudflare/i.test(
          `${document.title || ''}\n${pageText}`
        );
        return { length, isGenerating, hasRegenerate, challengeActive };
      }, opts.assistantBaseline);

      if (state.challengeActive) {
        throw new Error('ChatGPT is on a Cloudflare/OpenAI challenge page and cannot return a response.');
      }

      // Detect login redirect early instead of waiting for timeout
      try {
        const currentUrl = page.url();
        if (currentUrl && /\/auth\/(login|signup)/.test(currentUrl)) {
          throw new Error('GPT session redirected to login page — navigation detected');
        }
      } catch (urlErr) {
        if (urlErr.message?.includes('redirected to login')) throw urlErr;
      }

      // Consider finished if generation stopped and we have meaningful content
      if (!state.isGenerating && state.length > opts.minLength) {
        // Require a couple stable checks to ensure it's settled
        if (state.length === previousLength) {
          stableCount++;
        } else {
          stableCount = 0;
        }
        previousLength = state.length;

        if (stableCount >= opts.maxStableChecks) {
          logFn(`✅ Response complete (stable at ${state.length} chars)`);
          break;
        }
        continue;
      }

      // Track changes to detect idle
      if (state.length !== previousLength) {
        lastChangeTs = Date.now();
        stableCount = 0;
        previousLength = state.length;
      }

      // ChatGPT can leave an empty assistant turn with the stop button displayed
      // forever. It is not making progress, so cancel it and let the caller reset
      // the conversation for its one controlled retry.
      if (state.isGenerating && state.length <= opts.minLength && elapsed > opts.initialResponseTimeoutMs) {
        await page.evaluate(() => {
          document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop" i]')?.click();
        }).catch(() => { });
        throw new Error(`GPT generation started but produced no text after ${Math.round(opts.initialResponseTimeoutMs / 1000)}s.`);
      }

      // If idle for too long and nothing seems to be generating, try a gentle nudge (press Enter once)
      if (!state.isGenerating && state.length <= opts.minLength && (Date.now() - lastChangeTs) > opts.resendOnIdleMs && !resentOnce) {
        try {
          logFn('⚠️ No output detected after sending. Saving debug info...');
          try {
            logFn(`📍 Current URL: ${page.url()}`);
            await page.screenshot({ path: `gpt-timeout-${Date.now()}.png` });
            const chatHtml = await page.evaluate(() => {
              const main = document.querySelector('main') || document.querySelector('[class*="chat"]') || document.querySelector('[class*="conversation"]') || document.body;
              return main.innerHTML.substring(0, 20000);
            });
            fs.writeFileSync(`gpt-debug-dom-${Date.now()}.html`, chatHtml);
            logFn('📸 Screenshot + DOM saved for debugging');
          } catch (e) { }
          logFn('⚠️ Nudging with Enter once...');
          await page.keyboard.press('Enter');
          resentOnce = true;
          lastChangeTs = Date.now();
          continue;
        } catch { }
      }

      // Keep page scrolled to bottom to avoid lazy rendering issues
      try {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      } catch { }
    }
  }

  /**
   * Extract response from ChatGPT DOM
   * FIXED: Preserves code fences for metadata extraction
   */
  async extractGPTResponse(page, assistantBaseline = 0) {
    return await page.evaluate((baseline) => {
      function findAllAssistantMessages() {
        let msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (msgs.length > 0) return Array.from(msgs);
        msgs = document.querySelectorAll('article[data-testid*="assistant"]');
        if (msgs.length > 0) return Array.from(msgs);
        const articles = document.querySelectorAll('article[data-testid^="conversation-turn"]');
        const assistantArticles = Array.from(articles).filter(m =>
          m.textContent && !m.querySelector('[data-message-author-role="user"]')
        );
        if (assistantArticles.length > 0) return assistantArticles;
        const userMsgs = document.querySelectorAll('[data-message-author-role="user"]');
        if (userMsgs.length > 0) {
          const lastUser = userMsgs[userMsgs.length - 1];
          const result = [];
          let el = lastUser.nextElementSibling;
          while (el) {
            if (el.textContent && el.textContent.trim().length > 10) {
              result.push(el);
            }
            el = el.nextElementSibling;
          }
          if (result.length > 0) return result;
        }
        const main = document.querySelector('main') || document.querySelector('[class*="chat"]') || document.querySelector('[class*="conversation"]');
        if (main) {
          const children = Array.from(main.children).filter(c =>
            c.textContent && c.textContent.trim().length > 20 &&
            !c.querySelector('textarea, [contenteditable]')
          );
          if (children.length > 0) return children;
        }
        return Array.from(msgs);
      }

      const messages = findAllAssistantMessages();
      const newMessages = messages.slice(baseline);
      if (newMessages.length > 0) {
        const lastMessage = newMessages[newMessages.length - 1];

        // Remove copy buttons
        const clone = lastMessage.cloneNode(true);
        clone.querySelectorAll('button, [class*="copy"], [aria-label*="Copy"]').forEach(el => el.remove());

        // Reconstruct markdown with code fences
        let fullText = '';

        // Find all code blocks and reconstruct with fences
        const codeBlocks = clone.querySelectorAll('pre');
        if (codeBlocks.length > 0) {
          // Walk through DOM to preserve order
          const walker = document.createTreeWalker(
            clone,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            null
          );

          let node;
          let lastProcessedPre = null;

          while (node = walker.nextNode()) {
            // Skip if already processed as part of a pre block
            if (lastProcessedPre && lastProcessedPre.contains(node)) {
              continue;
            }

            if (node.nodeName === 'PRE') {
              lastProcessedPre = node;
              const code = node.querySelector('code');
              if (code) {
                // Get language from class (e.g., "language-pgsql")
                const langClass = code.className.match(/language-(\w+)/);
                const lang = langClass ? langClass[1] : '';

                // Reconstruct code fence
                fullText += `\n\`\`\`${lang}\n${code.textContent}\n\`\`\`\n`;
              }
            } else if (node.nodeType === Node.TEXT_NODE) {
              // Add text nodes
              const text = node.textContent.trim();
              if (text) {
                fullText += text + '\n';
              }
            } else if (node.nodeName === 'P' || node.nodeName === 'H1' || node.nodeName === 'H2' || node.nodeName === 'H3') {
              // For paragraphs and headers, get their text if not already processed
              if (!lastProcessedPre || !lastProcessedPre.contains(node)) {
                const text = node.textContent.trim();
                if (text && !fullText.includes(text)) {
                  fullText += text + '\n';
                }
              }
            }
          }

          return fullText.replace(/Copy code/gi, '').replace(/\n{3,}/g, '\n\n').trim();
        }

        // Fallback to textContent if no code blocks
        return lastMessage.textContent || '';
      }
      return '';
    }, assistantBaseline);
  }

  /**
   * Sanitize cookies for Puppeteer / DevTools Protocol compatibility
   * Same implementation as apifyToGPTProcessor.js
   */
  /**
   * Normalize cookies from DB (handles both ARRAY and OBJECT formats)
   */
  normalizeCookies(raw) {
    // Format A: array of cookie objects
    if (Array.isArray(raw)) {
      return raw.map(c => ({
        name: c.name || c.key || '',
        value: c.value || c.session || c.sessionToken || '',
        domain: c.domain || '.chatgpt.com',
        path: c.path || '/',
        secure: c.secure !== undefined ? !!c.secure : true,
        httpOnly: c.httpOnly !== undefined ? !!c.httpOnly : true,
        sameSite: c.sameSite,
      })).filter(c => c.name && c.value);
    }

    // Format B: plain object { cookieName: cookieValue }
    if (typeof raw === 'object' && raw !== null) {
      return Object.entries(raw).map(([name, value]) => ({
        name,
        value: String(value),
        domain: '.chatgpt.com',
        path: '/',
        secure: true,
        httpOnly: true,
      })).filter(c => c.name && c.value);
    }

    return [];
  }

  /**
   * Sanitize cookies for Puppeteer / DevTools Protocol compatibility
   * Now uses normalizeCookies to handle both formats
   */
  sanitizeCookies(cookies) {
    const normalized = this.normalizeCookies(cookies);
    if (normalized.length === 0) return [];

    return normalized.map(c => {
      try {
        const out = {
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path || '/',
          secure: c.secure !== undefined ? !!c.secure : true,
          httpOnly: c.httpOnly !== undefined ? !!c.httpOnly : true,
        };
        if (c.sameSite) {
          const s = String(c.sameSite).toLowerCase();
          if (s === 'no_restriction') out.sameSite = 'None';
          else if (s === 'lax') out.sameSite = 'Lax';
          else if (s === 'strict') out.sameSite = 'Strict';
        }
        return out;
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  }

  async verifyChatGPTLoggedIn(page) {
    const raw = await page.evaluate(() => {
      const text = document.body?.innerText || '';

      const isCloudflareChallenge =
        /checking your browser|verify you are human|cloudflare|ray id|just a moment/i.test(`${document.title || ''}\n${text}`) ||
        !!document.querySelector('#challenge-form, .cf-browser-verification, [class*="cf-"]');
      if (isCloudflareChallenge) return 'CLOUDFLARE';

      const composerSelector = [
        'textarea#prompt-textarea',
        '#prompt-textarea',
        '[data-testid="prompt-textarea"]',
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="Ask"]',
        '[role="textbox"][contenteditable="true"]',
        'div[contenteditable="true"]',
        '.ProseMirror'
      ].join(', ');
      const hasComposer = !!document.querySelector(composerSelector);
      const hasLoggedInShell = /new chat|search chats|library|projects|apps/i.test(text)
        && /ask anything|what are you working on|what.?s on your mind/i.test(text);
      const hasAccountProfile = !!document.querySelector(
        '[data-testid="accounts-profile-button"], [data-testid="profile-button"], button[aria-label*="Account" i]'
      );
      const hasLoginPrompt = /log in or sign up|sign up or log in to save chats|continue with google|continue with apple|email address/i.test(text);
      const onAuthRoute = /\/auth\/(login|signup)/.test(window.location.pathname);

      return (hasComposer || hasLoggedInShell) && hasAccountProfile && !hasLoginPrompt && !onAuthRoute;
    });
    if (raw === 'CLOUDFLARE') {
      this.log('', 'warning', '⚠️ Cloudflare challenge detected on chatgpt.com — bot fingerprint detection active');
      return false;
    }
    return raw;
  }

  async hasOpenAIChallenge(page) {
    return page.evaluate(() => {
      const text = `${document.title || ''}\n${document.body?.innerText || ''}`;
      return /checking your browser|verify you are human|cloudflare|ray id|just a moment/i.test(text);
    }).catch(() => false);
  }

  async checkChatGPTLoggedInWithRetry(page) {
    let result = await this.verifyChatGPTLoggedIn(page);
    if (result !== false) return result;
    await new Promise(r => setTimeout(r, 10000));
    return this.verifyChatGPTLoggedIn(page);
  }

  async findLoggedInChatGPTPage(browser) {
    const pages = await browser.pages();
    for (const candidate of pages) {
      try {
        const url = candidate.url();
        if (!/chatgpt\.com/.test(url)) continue;
        if (await this.checkChatGPTLoggedInWithRetry(candidate) === true) {
          await candidate.bringToFront();
          return candidate;
        }
      } catch { }
    }
    return null;
  }

  getChatGPTProfileDir(gptAccountId = 'default') {
    const safeAccountId = String(gptAccountId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    // A GPT account has one browser identity. Campaign-specific profiles caused
    // repeated logins and allowed one campaign to use a guest session.
    const profileDir = path.join(process.cwd(), '.chatgpt-profiles', safeAccountId);
    fs.mkdirSync(profileDir, { recursive: true });
    return profileDir;
  }

  getFallbackChatGPTProfileDir(gptAccountId = 'default') {
    return getFallbackChatGPTProfileDir(gptAccountId);
  }

  async launchChatGPTBrowser(gptAccountId, campaignId = '') {
    const profileDir = this.getChatGPTProfileDir(gptAccountId, campaignId);
    const fallbackProfileDir = this.getFallbackChatGPTProfileDir(gptAccountId);
    const launchOptions = {
      protocolTimeout: 300000,
      timeout: 60000,
      headless: false,
      executablePath: installedChromePath,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--window-position=0,0',
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: { width: 1920, height: 1080 }
    };
    const launched = await launchPuppeteerWithProfileFallback(
      puppeteer,
      launchOptions,
      profileDir,
      fallbackProfileDir,
      (msg) => console.warn(`[ChatGPT Browser] ${msg}`)
    );
    const browser = launched.browser;

    const page = await browser.newPage();
    return { browser, page, profileDir: launched.profileDir };
  }

  async ensureChatGPTSession(page, campaignId, gptAccountId, timeoutMs = 600000) {
    if (await this.checkChatGPTLoggedInWithRetry(page) === true) {
      await this.persistChatGPTCookies(page, gptAccountId, campaignId);
      return page;
    }

    if (await this.hasOpenAIChallenge(page)) {
      throw new Error('ChatGPT is waiting on a Cloudflare/OpenAI challenge. Complete the challenge in a normal browser session before retrying.');
    }

    const creds = await this._getAccountForAutoLogin(gptAccountId);
    if (creds && creds.email && creds.password) {
      this.log(campaignId, 'info', '🔑 Attempting automated ChatGPT login...');
      const ok = await autoLoginChatGPT(page, creds.email, creds.password, (msg) => this.log(campaignId, 'info', msg));
      if (ok) {
        this.clearInvalidGptAccount(gptAccountId);
        await this.persistChatGPTCookies(page, gptAccountId, campaignId);
        this.log(campaignId, 'success', '✅ Automated ChatGPT login succeeded.');
        return page;
      }
      this.log(campaignId, 'warning', 'Automated login failed — falling back to manual login window.');
    }

    // Navigate to chatgpt.com/auth/login so the user sees the login form, not a stale error page
    await page.goto('https://chatgpt.com/auth/login', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const profileDir = this.getChatGPTProfileDir(gptAccountId);
    this.log(campaignId, 'warning', 'ChatGPT is not logged in. A browser window is open for manual login.');
    this.log(campaignId, 'info', `Log in to ChatGPT in the opened browser, then wait here. Profile: ${profileDir}`);

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      try {
        const loggedInPage = await this.findLoggedInChatGPTPage(page.browser());
        if (loggedInPage) {
          this.clearInvalidGptAccount(gptAccountId);
          await this.persistChatGPTCookies(loggedInPage, gptAccountId, campaignId);
          this.log(campaignId, 'success', 'ChatGPT login detected. Continuing automation.');
          return loggedInPage;
        }

        if (await this.checkChatGPTLoggedInWithRetry(page) === true) {
          this.clearInvalidGptAccount(gptAccountId);
          await this.persistChatGPTCookies(page, gptAccountId, campaignId);
          this.log(campaignId, 'success', 'ChatGPT login detected. Continuing automation.');
          return page;
        }
      } catch { }
    }

    if (gptAccountId) this.markGptAccountInvalid(gptAccountId);
    throw new Error('Not logged in to ChatGPT after waiting for manual login.');
  }

  async _getAccountForAutoLogin(gptAccountId) {
    try {
      const account = await storage.getGPTAccount(gptAccountId);
      if (!account || !account.name) return null;
      return getChatGPTCredentials(account.name);
    } catch {
      return null;
    }
  }

  async _refreshCookiesViaAutoLogin(campaignId, gptAccountId) {
    const profileDir = this.getChatGPTProfileDir(gptAccountId);
    const fallbackProfileDir = this.getFallbackChatGPTProfileDir(gptAccountId);

    const launched = await launchPuppeteerWithProfileFallback(puppeteer, {
      protocolTimeout: 60000,
      headless: false,
      executablePath: installedChromePath,
      defaultViewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      args: ['--no-first-run', '--no-default-browser-check', '--disable-blink-features=AutomationControlled'],
    }, profileDir, fallbackProfileDir, (msg) => this.log(campaignId, 'warning', msg));

    const browser = launched.browser;
    try {
      const page = await browser.newPage();

      const creds = await this._getAccountForAutoLogin(gptAccountId);
      if (!creds || !creds.email || !creds.password) throw new Error('No credentials configured for auto-login');

      const ok = await autoLoginChatGPT(page, creds.email, creds.password, (msg) => this.log(campaignId, 'info', msg));
      if (!ok) throw new Error('Auto-login failed');

      await this.persistChatGPTCookies(page, gptAccountId, campaignId);
      this.log(campaignId, 'success', 'GPT session refreshed via auto-login.');
    } finally {
      await browser.close().catch(() => { });
    }
  }

  async persistChatGPTCookies(page, gptAccountId, campaignId) {
    if (!gptAccountId) return;

    try {
      if (await this.checkChatGPTLoggedInWithRetry(page) !== true) {
        this.log(campaignId, 'warning', 'ChatGPT page is not authenticated; refreshed cookies were not saved.');
        return;
      }

      const freshCookies = await page.cookies('https://chatgpt.com');
      if (freshCookies.length === 0) return;

      await storage.updateGPTAccount(gptAccountId, { cookies: freshCookies, status: 'active' });
      this.log(campaignId, 'info', `Saved refreshed GPT session (${freshCookies.length} cookies).`);
    } catch (error) {
      // The browser profile still retains the login if database persistence fails.
      this.log(campaignId, 'warning', `Could not save refreshed GPT session: ${error.message}`);
    }
  }

  /**
   * Exclusive browser mutex — ensures only 1 Puppeteer session runs at a time
   * Prevents profile lock contention when multiple jobs arrive concurrently via Bridge API
   */
  async _withExclusiveBrowser(key, fn) {
    if (!this._browserLocks[key]) {
      this._browserLocks[key] = null;
    }
    while (this._browserLocks[key]) {
      try { await this._browserLocks[key]; } catch { /* ignore */ }
    }
    const promise = (async () => {
      try {
        return await fn();
      } finally {
        this._browserLocks[key] = null;
      }
    })();
    this._browserLocks[key] = promise;
    return promise;
  }

  async filterJobWithGPT(jobDetails, cookies, campaignId, gptAccountId, existingPage = null, existingBrowser = null) {
    this.log(campaignId, 'info', `🤖 Filtering job: ${jobDetails.title}`);

    if (existingPage && existingBrowser) {
      return this._filterJobWithGPTInternal(jobDetails, cookies, campaignId, gptAccountId, existingPage, existingBrowser);
    }

    return this.retryWithBackoff(
      async () => this._filterJobWithGPTInternal(jobDetails, cookies, campaignId, gptAccountId),
      {
        maxRetries: 1,
        baseDelay: 3000,
        shouldRetry: (err) => !this.isChatGPTAuthError(err),
        onRetry: (attempt, delay, err) => {
          this.log(campaignId, 'warning', `🔄 filterJobWithGPT retry ${attempt}/1 after ${delay}ms — ${err.message}`);
        }
      }
    );
  }

  async _filterJobWithGPTInternal(jobDetails, cookies, campaignId, gptAccountId, existingPage = null, existingBrowser = null) {
    let browser;
    let ownsBrowser = false;

    try {
      // Build the full prompt with placeholder replacement
      const jobDescription = upworkJobService.buildJobDescription(jobDetails);
      const skills = jobDetails.skills
        ? (Array.isArray(jobDetails.skills) ? jobDetails.skills.join(', ') : jobDetails.skills)
        : 'Not specified';
      const budget = jobDetails.budget || 'Not specified';
      const fullPrompt = this.prompts.filter
        .replaceAll('{{JOB_TITLE}}', jobDetails.title || '')
        .replaceAll('{{JOB_DESCRIPTION}}', jobDescription)
        .replaceAll('{{JOB_BUDGET}}', budget)
        .replaceAll('{{JOB_SKILLS}}', skills);

      this.log(campaignId, 'info', 'Sending job to GPT for viability check...');

      let page;
      if (existingPage && existingBrowser) {
        browser = existingBrowser;
        page = existingPage;
        ownsBrowser = false;
        this.log(campaignId, 'info', 'Reusing existing ChatGPT browser session for filter.');
      } else {
        const launched = await this.launchChatGPTBrowser(gptAccountId, campaignId);
        browser = launched.browser;
        page = launched.page;
        ownsBrowser = true;

        // Load cookies with sanitization (handles both ARRAY and OBJECT formats)
        // Load the persistent profile before applying database cookies. A profile
        // session is generally newer than an exported cookie array.
        await this.navigateToChatGPT(page, campaignId);
        const profileHasSession = await this.checkChatGPTLoggedInWithRetry(page);
        const sanitizedCookies = profileHasSession ? [] : this.sanitizeCookies(cookies);
        if (profileHasSession) {
          this.log(campaignId, 'info', 'Using the saved ChatGPT browser session.');
        }
        if (sanitizedCookies.length > 0) {
          console.log(`🍪 Setting ${sanitizedCookies.length} cookies for account`);
          await page.setCookie(...sanitizedCookies);
          await this.navigateToChatGPT(page, campaignId);
        } else if (!profileHasSession) {
          this.log(campaignId, 'warning', '⚠️ No valid cookies to set — GPT session may fail');
        }

        page = await this.ensureChatGPTSession(page, campaignId, gptAccountId);
      }

      // Register active browser for force-stop support
      this.activeBrowsers.set(campaignId, browser);

      await this.waitForChatGPTComposer(page);
      let assistantBaseline = await page.evaluate(() => (
        document.querySelectorAll('[data-message-author-role="assistant"]').length
      ));

      // Send prompt and wait for response — with retry on context destroyed
      let responseText = '';
      const MAX_PROMPT_RETRIES = 2;
      for (let attempt = 1; attempt <= MAX_PROMPT_RETRIES; attempt++) {
        try {
          await this.sendPromptToGPT(page, fullPrompt, (msg) => this.log(campaignId, 'info', msg));

          await this.waitForGPTResponse(page, (msg) => this.log(campaignId, 'info', msg), {
            maxStableChecks: 5,
            checkInterval: 2000,
            minLength: 50,
            overallTimeoutMs: 90000,
            assistantBaseline,
          });

          responseText = await this.extractGPTResponse(page, assistantBaseline);

          if (responseText) break;

          throw new Error('No response received from GPT');
        } catch (promptError) {
          const isNavError = /execution context was destroyed|navigation|redirected to login/i.test(promptError?.message || '');
          if (isNavError && attempt < MAX_PROMPT_RETRIES) {
            this.log(campaignId, 'warning', `🔄 Prompt retry ${attempt}/${MAX_PROMPT_RETRIES - 1} after navigation error: ${promptError.message}`);
            await this.navigateToChatGPT(page, campaignId);
            page = await this.ensureChatGPTSession(page, campaignId, gptAccountId);
            await this.waitForChatGPTComposer(page);
            assistantBaseline = await page.evaluate(() => (
              document.querySelectorAll('[data-message-author-role="assistant"]').length
            ));
            continue;
          }
          throw promptError;
        }
      }

      this.log(campaignId, 'info', `GPT Response (first 200 chars): ${responseText.substring(0, 200)}...`);

      // Parse JSON response with auto-repair
      this.log(campaignId, 'info', '🔧 Parsing and repairing JSON response...');

      let result;
      try {
        const parsed = extractAndRepairJSON(
          responseText,
          `[${campaignId}] `
        );

        // Normalize the response structure for new prompt format
        result = normalizeJobFilterResponse(parsed);

        this.log(campaignId, 'success', `✅ JSON parsed successfully`);
        this.log(campaignId, 'info', `   Open Source Viable: ${result.open_source_viable}`);
        this.log(campaignId, 'info', `   Niche: ${result.niche}`);
        this.log(campaignId, 'info', `   Platform: ${result.platform}`);
        this.log(campaignId, 'info', `   Platform Domain: ${result.platformDomain || 'None'}`);
        this.log(campaignId, 'info', `   Tool: ${result.tool}`);

      } catch (jsonError) {
        this.log(campaignId, 'error', `JSON parsing failed: ${jsonError.message}`);

        // Fallback: check if response is plain Yes/No
        const cleanText = responseText.toLowerCase().trim();
        if (cleanText === 'yes' || cleanText.startsWith('yes')) {
          this.log(campaignId, 'warning', 'GPT returned plain "Yes" — accepting job with unknown platform/tool');
          return {
            viable: true,
            niche: 'Other',
            platform: 'None',
            platformDomain: 'None',
            tool: 'None',
            reason: 'GPT returned plain Yes (JSON parse failed)'
          };
        } else if (cleanText === 'no' || cleanText.startsWith('no')) {
          this.log(campaignId, 'warning', 'GPT returned plain "No" — rejecting job');
          return {
            viable: false,
            niche: 'None',
            platform: 'None',
            platformDomain: 'None',
            tool: 'None',
            reason: 'GPT returned plain No (JSON parse failed)'
          };
        }

        this.log(campaignId, 'warning', 'Treating job as non-viable due to parse error');

        // Return safe default
        return {
          viable: false,
          niche: 'None',
          platform: 'None',
          platformDomain: 'None',
          tool: 'None'
        };
      }

      // PRIMARY RULE: Trust GPT completely — no secondary platform filter
      // normalizeJobFilterResponse maps GPT's response to open_source_viable ('Yes'/'No')
      const isViable = result.open_source_viable === 'Yes';

      return {
        viable: isViable,
        niche: result.niche,
        platform: result.platform,
        platformDomain: result.platformDomain || 'None',
        tool: result.tool,
        reason: result.reason || (isViable ? 'Viability check passed' : 'Viability check failed')
      };

    } catch (error) {
      this.log(campaignId, 'error', `Failed to filter job: ${error.message}`);
      throw error; // Let retryWithBackoff handle retries
    } finally {
      if (ownsBrowser && browser) {
        await browser.close();
      }
      this.activeBrowsers.delete(campaignId);
    }
  }

  /**
   * Generate README using appropriate prompt based on niche
   * @param {Object} jobDetails - Detailed job information
   * @param {string} niche - 'Automation' or 'Scraping'
   * @param {string} platform - Platform name from filter
   * @param {string} tool - Tool name from filter
   * @param {string} cookies - GPT account cookies
   * @returns {Promise<Object>} Parsed README data
   */
  async generateReadmeForJob(jobDetails, niche, platform, tool, cookies, campaignId, gptAccountId = 'default') {
    this.log(campaignId, 'info', `📝 Generating ${niche} README for: ${jobDetails.title}`);

    let browser;

    try {
      // Choose appropriate prompt
      const promptTemplate = niche === 'Scraping'
        ? this.prompts.scraperReadme
        : this.prompts.automationReadme;

      // Build job data with metadata for prompt
      const jobDescription = upworkJobService.buildJobDescription(jobDetails);

      // Create metadata block
      const metadata = JSON.stringify({
        platform: platform,
        tool: tool
      }, null, 2);

      const fullPrompt = `${promptTemplate}\n\n====================================================\n\nUpwork Job Post:\n\nJob Title: ${jobDetails.title}\n\nJob Description: ${jobDescription}\n\nMetaData:\n${metadata}`;

      this.log(campaignId, 'info', 'Sending to GPT for README generation...');
      this.log(campaignId, 'info', `   Platform: ${platform}`);
      this.log(campaignId, 'info', `   Tool: ${tool}`);

      const launched = await this.launchChatGPTBrowser(gptAccountId, campaignId);
      browser = launched.browser;
      let page = launched.page;

      // Register active browser for force-stop support
      this.activeBrowsers.set(campaignId, browser);

      // Load cookies with sanitization (handles both ARRAY and OBJECT formats)
      await this.navigateToChatGPT(page, campaignId);
      const profileHasSession = await this.checkChatGPTLoggedInWithRetry(page);
      const sanitizedCookies = profileHasSession ? [] : this.sanitizeCookies(cookies);
      if (profileHasSession) {
        this.log(campaignId, 'info', 'Using the saved ChatGPT browser session.');
      }
      if (sanitizedCookies.length > 0) {
        console.log(`🍪 Setting ${sanitizedCookies.length} cookies for account`);
        await page.setCookie(...sanitizedCookies);
      } else if (!profileHasSession) {
        this.log(campaignId, 'warning', '⚠️ No valid cookies to set — GPT session may fail');
      }

      await this.navigateToChatGPT(page, campaignId);

      page = await this.ensureChatGPTSession(page, campaignId, gptAccountId);

      await this.waitForChatGPTComposer(page);
      const assistantBaseline = await page.evaluate(() => (
        document.querySelectorAll('[data-message-author-role="assistant"]').length
      ));

      // Send prompt using helper method (same as apifyToGPTProcessor)
      await this.sendPromptToGPT(page, fullPrompt, (msg) => this.log(campaignId, 'info', msg));

      // Wait for response to complete (longer wait for README generation)
      await this.waitForGPTResponse(page, (msg) => this.log(campaignId, 'info', msg), {
        maxStableChecks: 8,
        checkInterval: 3000,
        minLength: 500,
        overallTimeoutMs: 300000,
        assistantBaseline,
      });

      // Extract response
      const responseText = await this.extractGPTResponse(page, assistantBaseline);

      if (!responseText) {
        throw new Error('No response received from GPT');
      }

      this.log(campaignId, 'success', 'README generated successfully');

      // Parse the response (similar to apifyToGPTProcessor parseGPTResponse)
      return this.parseReadmeResponse(responseText, jobDetails);

    } catch (error) {
      this.log(campaignId, 'error', `Failed to generate README: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
      this.activeBrowsers.delete(campaignId);
    }
  }

  /**
   * Parse README response from GPT
   */
  parseReadmeResponse(responseText, jobDetails) {
    console.log('🔍 Parsing README response from GPT...');

    // Extract metadata block (pgsql code fence)
    const metadataMatch = responseText.match(/```pgsql\s*\n([\s\S]*?)```/);

    let repoName = '';
    let description = '';
    let topics = [];

    if (metadataMatch) {
      const metadata = metadataMatch[1];
      console.log('✅ Found metadata block');

      const repoNameMatch = metadata.match(/Repo Name:\s*(.+)/);
      const descMatch = metadata.match(/Description:\s*(.+)/);

      // Use comprehensive topic extraction
      topics = this.extractTopicsFromMetadata(metadata);

      if (repoNameMatch) {
        repoName = repoNameMatch[1].trim();
        console.log(`  📦 Repo Name: "${repoName}"`);
      }

      if (descMatch) {
        description = descMatch[1].trim();
        console.log(`  📝 Description: ${description}`);
      }

      if (topics.length > 0) {
        console.log(`  🏷️  Topics extracted (${topics.length}): ${topics.join(', ')}`);
      } else {
        console.log(`  ⚠️  No topics found in metadata block`);
      }
    } else {
      console.log('⚠️  No metadata block found');
    }

    // Extract README markdown (second code fence)
    const readmeMatch = responseText.match(/```markdown\s*\n([\s\S]*?)```/);
    const readme = readmeMatch ? readmeMatch[1].trim() : '';
    console.log(`📄 README extracted (${readme.length} chars)`);

    // Fallback values
    if (!repoName) {
      repoName = jobDetails.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      console.log(`⚠️  Using fallback repo name: ${repoName}`);
    }

    if (!description) {
      description = jobDetails.title;
      console.log(`⚠️  Using fallback description`);
    }

    console.log(`✅ Parse complete - ${topics.length} topics ready`);

    return {
      repo_name: repoName,
      description,
      topics,
      readme
    };
  }

  /**
   * Get GPT account cookies
   */
  async getGPTCookies(gptAccountId, campaignId) {
    try {
      // A browser profile may have recovered a session since the previous failure.
      // Do not lock the account out before we can verify it again.
      if (this.invalidGptAccounts.has(gptAccountId)) {
        this.log(campaignId, 'warning', 'Previous GPT session failed. Retrying with the saved browser profile and stored cookies.');
        this.clearInvalidGptAccount(gptAccountId);
      }

      let account = await storage.getGPTAccount(gptAccountId);

      // Fallback 1: if specified account not found, try default account
      if (!account) {
        this.log(campaignId, 'warning', `⚠️ GPT account ${gptAccountId} not found — looking for default account`);
        const accounts = await storage.getGPTAccounts();
        account = accounts.find(a => a.is_default) || accounts[0];
        if (account) {
          this.log(campaignId, 'info', `   Using fallback account: ${account.name} (${account.id})`);
        }
      }

      if (!account) {
        throw new Error('GPT account not found');
      }

      // Parse cookies if they're a string
      let cookies = account.cookies;
      if (cookies && typeof cookies === 'string') {
        try {
          cookies = JSON.parse(cookies);
        } catch (e) {
          this.log(campaignId, 'warning', `Invalid cookies format for ${account.name}, starting with empty session.`);
          cookies = {};
        }
      }

      // Normalize: handle both ARRAY and OBJECT formats
      const normalized = cookies ? this.normalizeCookies(cookies) : [];
      if (normalized.length === 0) {
        this.log(campaignId, 'info', `No stored cookies for ${account.name} — auto-login will be used.`);
        return [];
      }

      // C: Check if the session token cookie is expired
      const sessionCookie = normalized.find(c => c.name === '__Secure-next-auth.session-token');
      if (sessionCookie && sessionCookie.expires) {
        const expiresSec = Number(sessionCookie.expires);
        const nowSec = Date.now() / 1000;
        if (expiresSec < nowSec) {
          this.log(campaignId, 'warning', `Session token for ${account.name} expired ${Math.round((nowSec - expiresSec) / 60)}m ago — will refresh.`);
          throw new Error('GPT session token has expired');
        }
        const remainingMin = Math.round((expiresSec - nowSec) / 60);
        this.log(campaignId, 'info', `Session token expires in ~${remainingMin} minutes.`);
      }

      this.log(campaignId, 'info', `🍪 Loaded ${normalized.length} cookies for account: ${account.name}`);
      return normalized;
    } catch (error) {
      this.log(campaignId, 'error', `Failed to get GPT cookies: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark a GPT account as having invalid cookies
   */
  markGptAccountInvalid(gptAccountId) {
    this.invalidGptAccounts.add(gptAccountId);
    console.log(`🚫 GPT account ${gptAccountId} marked invalid`);
  }

  /**
   * Clear invalid GPT account status (call when cookies are refreshed)
   */
  clearInvalidGptAccount(gptAccountId) {
    this.invalidGptAccounts.delete(gptAccountId);
    console.log(`✅ GPT account ${gptAccountId} cleared from invalid list`);
  }

  /**
   * Main campaign loop - REAL-TIME job detection with deduplication
   */
  async startCampaign(id) {
    console.log('\n===== STARTING UPWORK CAMPAIGN (REAL-TIME MODE) =====');
    console.log('Campaign ID:', id);

    if (this.running.get(id)) {
      console.log('Campaign already running');
      return;
    }

    this.running.set(id, true);
    this.setStatus(id, 'Running');

    // Initialize seen jobs set for this campaign
    if (!this.seenJobIds.has(id)) {
      this.seenJobIds.set(id, new Set());
    }

    const campaign = await storage.getUpworkCampaign(id);

    if (!campaign) {
      console.log('Campaign not found');
      this.running.delete(id);
      return;
    }

    console.log('Campaign found:', campaign.name);
    console.log('Search input:', campaign.upworkSearchInput);

    try {
      this.log(id, 'info', `🚀 Starting REAL-TIME Upwork campaign: ${campaign.name}`);
      this.log(id, 'info', `🔍 Search query: ${campaign.upworkSearchInput}`);
      this.log(id, 'info', `⏱️ Mode: Real-time (fetching jobs posted within 15 minutes)`);
      this.log(id, 'info', `🛡️ Duplicate detection: ENABLED`);

      // Get GPT cookies
      let cookies;
      try {
        cookies = await this.getGPTCookies(campaign.gptAccountId, id);
      } catch (cookieError) {
        this.log(id, 'warning', `❌ Stored cookies expired — proactively refreshing...`);
        try {
          await this._refreshCookiesViaAutoLogin(id, campaign.gptAccountId);
          cookies = await this.getGPTCookies(campaign.gptAccountId, id);
        } catch (refreshError) {
          this.log(id, 'error', `❌ Cannot start campaign: cookie refresh failed — ${refreshError.message}`);
          await this.setStatus(id, 'Failed');
          this.running.delete(id);
          return;
        }
      }

      // A: Proactive cookie health check — verify session freshness before processing jobs
      try {
        const nowSec = Date.now() / 1000;
        const sessionCookie = cookies.find(c => c.name === '__Secure-next-auth.session-token');
        const isStale = !sessionCookie ||
          !sessionCookie.value ||
          sessionCookie.value.length <= 20 ||
          (sessionCookie.expires && sessionCookie.expires < nowSec + 300); // expiring within 5 min
        if (isStale) {
          this.log(id, 'warning', 'GPT session token expiring soon — proactively refreshing...');
          await this._refreshCookiesViaAutoLogin(id, campaign.gptAccountId);
          cookies = await this.getGPTCookies(campaign.gptAccountId, id);
        }
      } catch (proactiveError) {
        // Non-fatal: the campaign will try auto-login when needed
        this.log(id, 'warning', `Proactive cookie refresh failed (will retry on demand): ${proactiveError.message}`);
      }

      let processed = 0;
      let viable = 0;
      let nonViable = 0;
      let duplicatesSkipped = 0; // NEW: Track duplicates
      let successfulRepos = [];

      const seenJobs = this.seenJobIds.get(id);
      let isFirstScan = true;
      let loopErrorCount = 0;

      // Infinite loop - continuously polls for NEW jobs
      while (this.running.get(id)) {
        // Circuit breaker check
        if (this.isCircuitOpen(id)) {
          this.log(id, 'error', `🛑 Circuit breaker OPEN after ${this.circuitBreakerThreshold} consecutive failures. Pausing campaign.`);
          await this.setStatus(id, 'Paused');
          this.running.delete(id);
          break;
        }

        try {
          const lookbackMinutes = isFirstScan ? 1440 : 15;
          this.log(id, 'info', `🔍 Scanning for new jobs posted within ${lookbackMinutes === 1440 ? '24 hours' : '15 minutes'}...`);

          // Fetch recent jobs (limit 10 to catch new posts quickly)
          const jobs = await upworkJobService.fetchJobs(campaign.upworkSearchInput, 10);

          // Reset loop error count on success
          loopErrorCount = 0;
          this.recordSuccess(id);

          if (!jobs || jobs.length === 0) {
            this.log(id, 'info', 'No jobs found in this scan. Waiting 30 seconds...');
            isFirstScan = false;
            await this.delay(30000);
            continue;
          }

          console.log(`📦 Fetched ${jobs.length} jobs from Upwork`);

          // Filter for NEW jobs (not seen before AND posted within time window)
          const newJobs = [];
          for (const job of jobs) {
            const jobId = job.id || job.ciphertext;

            if (!jobId) {
              continue;
            }

            // Skip if already processed
            if (seenJobs.has(jobId)) {
              continue;
            }

            // Check if posted within time window (24 hours on first scan, 15 minutes on subsequent scans)
            if (!this.isJobPostedWithinMinutes(job.createdDateTime, lookbackMinutes)) {
              continue;
            }

            // Mark as seen immediately to prevent duplicates
            seenJobs.add(jobId);
            newJobs.push(job);
            this.log(id, 'success', `🆕 New job: "${job.title.substring(0, 50)}..."`);
          }

          if (newJobs.length === 0) {
            this.log(id, 'info', `No new jobs posted within ${lookbackMinutes === 1440 ? '24 hours' : '15 minutes'}. Waiting 30 seconds...`);
            isFirstScan = false;
            await this.delay(30000);
            continue;
          }

          this.log(id, 'success', `✅ Found ${newJobs.length} NEW jobs to process!`);

          // Process each NEW job
          for (const job of newJobs) {
            // Check if campaign was stopped
            if (!this.running.get(id)) {
              this.log(id, 'info', 'Campaign stopped by user');
              break;
            }

            try {
              processed++;
              this.updateProgress(id, processed, processed, viable, nonViable);

              this.log(id, 'info', `\n📋 Processing job ${processed}: ${job.title}`);

              // Use simple job data (no full details fetch needed)
              this.log(id, 'info', '🤖 Filtering job with GPT (using simple data)...');
              const filterResult = await this.filterJobWithGPT(job, cookies, id, campaign.gptAccountId);

              if (!filterResult.viable) {
                nonViable++;
                this.updateProgress(id, processed, processed, viable, nonViable);
                this.log(id, 'warning', `❌ Job rejected by GPT filter`);
                this.log(id, 'warning', `   Platform: ${filterResult.platform}`);
                this.log(id, 'warning', `   Tool: ${filterResult.tool}`);
                this.log(id, 'warning', `   Reason: ${filterResult.reason || 'Not specified'}`);
                continue;
              }

              // ====== DUPLICATE DETECTION CHECK ======
              this.log(id, 'info', '🔍 Checking for duplicate jobs in database...');

              // First check by Upwork job ID (exact, global, cross-campaign)
              const jobId = job.id || job.ciphertext;
              if (jobId) {
                const idDuplicate = await storage.checkDuplicateByJobId(jobId);
                if (idDuplicate) {
                  duplicatesSkipped++;
                  nonViable++;
                  this.updateProgress(id, processed, processed, viable, nonViable);
                  this.log(id, 'warning', `⚠️ DUPLICATE BY JOB ID - Skipping job`);
                  this.log(id, 'warning', `   Job ID: ${jobId}`);
                  this.log(id, 'info', `   Total duplicates skipped so far: ${duplicatesSkipped}`);
                  continue;
                }
              }

              // Fallback: check by title similarity
              const isDuplicate = await storage.checkJobDuplicate(
                job.title,
                job.description,
                0.85
              );

              if (isDuplicate) {
                duplicatesSkipped++;
                nonViable++;
                this.updateProgress(id, processed, processed, viable, nonViable);

                this.log(id, 'warning', `⚠️ DUPLICATE BY TITLE - Skipping job`);
                this.log(id, 'warning', `   Original job: "${isDuplicate.title}"`);
                this.log(id, 'warning', `   Processed on: ${new Date(isDuplicate.createdAt).toLocaleString()}`);
                this.log(id, 'warning', `   Campaign: ${isDuplicate.campaignId}`);
                if (isDuplicate.repoUrl) {
                  this.log(id, 'warning', `   Repo: ${isDuplicate.repoUrl}`);
                }
                this.log(id, 'info', `   Total duplicates skipped so far: ${duplicatesSkipped}`);

                continue;
              }

              this.log(id, 'success', `✅ No duplicate found - proceeding with job`);
              // ====== END DUPLICATE CHECK ======

              viable++;
              this.updateProgress(id, processed, processed, viable, nonViable);
              this.log(id, 'success', `\n✅ VIABLE JOB: "${job.title}"`);
              this.log(id, 'success', `   Platform: ${filterResult.platform}`);
              this.log(id, 'success', `   Tool: ${filterResult.tool}`);

              // ====== GENERATE CONTENT (Product, Blog, Service) ======
              this.log(id, 'info', `🚀 Triggering content generation...`);
              this.log(id, 'info', `[CONTENT] Starting for: "${job.title}"`);

              const jobDescription = upworkJobService.buildJobDescription(job);
              let sharedBrowser = null;

              try {
                // Launch shared browser for all 3 prompts (avoids 2 redundant navigations)
                const launched = await this.launchChatGPTBrowser(
                  campaign.gptAccountId,
                  id
                );
                sharedBrowser = launched.browser;
                const sharedPage = launched.page;
                this.activeBrowsers.set(id, sharedBrowser);

                // Navigate and set up session once
                await this.navigateToChatGPT(sharedPage, id);
                const profileHasSession = await this.checkChatGPTLoggedInWithRetry(sharedPage);
                const sanitizedCookies = profileHasSession ? [] : this.sanitizeCookies(cookies);
                if (sanitizedCookies.length > 0) {
                  await sharedPage.setCookie(...sanitizedCookies);
                }
                await this.navigateToChatGPT(sharedPage, id);
                await this.ensureChatGPTSession(sharedPage, id, campaign.gptAccountId);

                const contentResult = await generateForJob({
                  jobTitle: job.title,
                  jobDescription,
                  cookies,
                  campaignId: id,
                  gptAccountId: campaign.gptAccountId,
                  logFn: (msg) => this.log(id, 'info', msg),
                  shouldAbort: () => !this.running.get(id),
                  jobSkills: job.skills ? (Array.isArray(job.skills) ? job.skills.join(', ') : job.skills) : 'Not specified',
                  jobBudget: job.budget || 'Not specified',
                  existingBrowser: sharedBrowser,
                  existingPage: sharedPage,
                  sendPrompt: (prompt) => this.sendPromptAndReadGPTResponse(sharedPage, prompt, id),
                });

                this.log(id, 'success', `✅ Content generated successfully`);
                if (contentResult.productParsed) this.log(id, 'success', `   Product: ${contentResult.productParsed.title}`);
                if (contentResult.blogParsed) this.log(id, 'success', `   Blog: ${contentResult.blogParsed.title}`);
                if (contentResult.serviceParsed) this.log(id, 'success', `   Service: ${contentResult.serviceParsed.title}`);

                // Also store in jobs_selected
                try {
                  await storage.createJobsSelected({
                    campaignId: id,
                    title: job.title,
                    description: jobDescription,
                    niche: filterResult.niche,
                    platform: filterResult.platform,
                    tool: filterResult.tool,
                    upworkJobUrl: job.url || `https://www.upwork.com/jobs/${job.id || job.ciphertext}`
                  });
                } catch (jsError) {
                  this.log(id, 'warning', `⚠️ Failed to store in jobs_selected: ${jsError.message}`);
                }
              } catch (contentError) {
                this.log(id, 'error', `❌ Content generation failed: ${contentError.message}`);
                this.log(id, 'info', 'Continuing to next job...');
              } finally {
                if (sharedBrowser) {
                  await sharedBrowser.close().catch(() => { });
                  this.activeBrowsers.delete(id);
                }
              }

              // ====== STORE PROCESSED JOB TO PREVENT FUTURE DUPLICATES ======
              try {
                await storage.storeProcessedJob({
                  id: job.id || job.ciphertext,
                  title: job.title,
                  description: job.description,
                  campaignId: id,
                  niche: filterResult.niche,
                  platform: filterResult.platform,
                  tool: filterResult.tool,
                  repoUrl: '',
                  upworkJobUrl: job.url || `https://www.upwork.com/jobs/${job.id || job.ciphertext}`,
                  viable: true,
                  rejectionReason: null
                });

                this.log(id, 'success', `💾 Job stored in database to prevent future duplicates`);
              } catch (storeError) {
                this.log(id, 'warning', `⚠️ Failed to store job in duplicate database: ${storeError.message}`);
              }

              // Record result
              successfulRepos.push({
                jobId: job.id,
                jobTitle: job.title,
                niche: filterResult.niche,
                platform: filterResult.platform,
                tool: filterResult.tool,
                timestamp: new Date().toISOString()
              });

              // Save results
              await storage.updateUpworkCampaign(id, {
                results: successfulRepos
              });

            } catch (error) {
              this.log(id, 'error', `Failed to process job: ${error.message}`);
              if (this.isChatGPTAuthError(error)) {
                this.log(id, 'warning', 'GPT session expired — attempting auto re-login to refresh cookies...');
                try {
                  await this._refreshCookiesViaAutoLogin(id, campaign.gptAccountId);
                  cookies = await this.getGPTCookies(campaign.gptAccountId, id);
                  this.log(id, 'info', 'Cookies refreshed — continuing to next job with fresh session.');
                } catch (refreshError) {
                  this.log(id, 'error', `Auto-login failed: ${refreshError.message}`);
                  this.log(id, 'error', 'Stopping campaign because the selected GPT account is not logged in.');
                  await this.setStatus(id, 'Failed');
                  this.running.delete(id);
                  break;
                }
              }
              // Continue with next job for non-auth failures
            }
          }

          if (!this.running.get(id)) {
            break;
          }

          // After processing batch, wait 30 seconds before next poll
          this.log(id, 'info', '✅ Batch processed. Waiting 30 seconds before next scan...');
          if (duplicatesSkipped > 0) {
            this.log(id, 'info', `   📊 Total duplicates skipped: ${duplicatesSkipped}`);
          }
          isFirstScan = false;
          await this.delay(30000);

        } catch (error) {
          isFirstScan = false;
          loopErrorCount++;
          const failureCount = this.recordFailure(id, error);

          // Exponential backoff: 5s, 10s, 20s, 40s, max 60s
          const backoffDelay = Math.min(5000 * Math.pow(2, loopErrorCount - 1), 60000);

          this.log(id, 'error', `❌ Error in campaign loop (${loopErrorCount} consecutive): ${error.message}`);
          this.log(id, 'warning', `⚠️ Failure count: ${failureCount}/${this.circuitBreakerThreshold}`);
          this.log(id, 'info', `⏱️ Retrying in ${Math.round(backoffDelay / 1000)}s...`);
          await this.delay(backoffDelay);
        }
      }

      // After the while loop: distinguish user stop from natural completion
      if (this.stoppedByUser.has(id)) {
        this.log(id, 'info', 'Campaign stopped by user');
        this.stoppedByUser.delete(id);
      } else {
        const latestCampaign = await storage.getUpworkCampaign(id);
        if (latestCampaign?.status === 'Failed') {
          this.log(id, 'error', 'Campaign ended with Failed status');
        } else {
          this.log(id, 'success', `Campaign completed - Total duplicates prevented: ${duplicatesSkipped}`);
          await this.setStatus(id, 'Completed');
        }
      }

    } catch (error) {
      this.log(id, 'error', `Campaign failed: ${error.message}`);
      await this.setStatus(id, 'Failed');
    } finally {
      this.running.delete(id);
      this.stoppedByUser.delete(id);
      // Clear seen jobs for this campaign
      this.seenJobIds.delete(id);
    }
  }

  async stopCampaign(id) {
    console.log(`Stopping Upwork campaign: ${id}`);

    if (!this.running.get(id)) {
      console.log('Campaign is not running in memory');
      // Even if not running in memory, the DB status may still be 'Running'
      // after an app restart. Ensure it is reset to 'Stopped'.
      const campaign = await storage.getUpworkCampaign(id);
      if (campaign && campaign.status === 'Running') {
        await this.setStatus(id, 'Stopped');
        console.log('Reset stale DB status from Running to Stopped');
      }
      return;
    }

    this.log(id, 'info', 'Stopping campaign...');
    this.stoppedByUser.add(id);
    this.running.delete(id);

    // Force-close any active browser to interrupt long-running GPT operations
    const activeBrowser = this.activeBrowsers.get(id);
    if (activeBrowser) {
      try {
        console.log(`Force-closing active browser for campaign ${id}`);
        await activeBrowser.close();
      } catch (err) {
        console.error(`Error closing browser for campaign ${id}:`, err.message);
      }
      this.activeBrowsers.delete(id);
    }

    // Clear seen jobs for this campaign to allow fresh start
    if (this.seenJobIds.has(id)) {
      this.seenJobIds.delete(id);
      console.log('Cleared seen jobs cache for campaign');
    }

    await this.setStatus(id, 'Stopped');
    console.log('Campaign stopped');
  }

  /**
   * Reset all campaigns that have status 'Running' in the database back to 'Stopped'.
   * Call this once on app startup to recover from a previous crash or restart.
   */
  async resetRunningCampaigns() {
    try {
      const upworkCampaigns = await storage.getUpworkCampaigns();
      const scrapeCampaigns = await storage.getScrapeJobsCampaigns();

      let resetCount = 0;

      for (const campaign of upworkCampaigns) {
        if (campaign.status === 'Running') {
          await storage.updateUpworkCampaign(campaign.id, { status: 'Stopped' });
          console.log(`[Startup] Reset Upwork campaign ${campaign.id} from Running to Stopped`);
          resetCount++;
        }
      }

      for (const campaign of scrapeCampaigns) {
        if (campaign.status === 'Running') {
          await storage.updateScrapeJobsCampaign(campaign.id, { status: 'Stopped' });
          console.log(`[Startup] Reset scrape-jobs campaign ${campaign.id} from Running to Stopped`);
          resetCount++;
        }
      }

      if (resetCount > 0) {
        console.log(`[Startup] Reset ${resetCount} stale campaign(s) from Running to Stopped`);
      }
    } catch (error) {
      console.error('[Startup] Failed to reset running campaigns:', error);
    }
  }

  /**
   * Extract job ID from Upwork job URL
   * @param {string} url - Upwork job URL
   * @returns {string|null} Job ID or null if invalid
   */
  extractJobIdFromUrl(url) {
    try {
      // Handle different Upwork URL formats:
      // 1. https://www.upwork.com/jobs/~01234567890abcdef
      // 2. https://www.upwork.com/ab/proposals/job/~01234567890abcdef
      // 3. Job ID might be in URL params or path

      const urlObj = new URL(url);
      const pathname = urlObj.pathname || '';

      // 1) Prefer explicit ~id patterns anywhere in the pathname (returns without the ~)
      let match = pathname.match(/~([a-zA-Z0-9]+)/);
      if (match && match[1]) return match[1];

      // 2) Handle slug_~id patterns (e.g. "...slug_~0219918.../")
      match = pathname.match(/_~([a-zA-Z0-9]+)/);
      if (match && match[1]) return match[1];

      // 3) Check common query params that might contain an id
      const params = urlObj.searchParams;
      if (params.has('id')) return params.get('id');
      if (params.has('jobId')) return params.get('jobId');

      // 4) Fallback: inspect last path segment and try to extract trailing alphanumeric id
      const parts = pathname.split('/').filter(p => p.length > 0);
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        // If last part contains a ~ anywhere, return the alphanumeric after it
        match = lastPart.match(/~?([a-zA-Z0-9]+)$/);
        if (match && match[1]) return match[1];
      }

      return null;
    } catch (error) {
      console.error('Failed to extract job ID from URL:', error);
      return null;
    }
  }

  /**
   * Start a scrape-jobs campaign - processes specific job URLs
   * @param {string} id - Campaign ID
   */
  parseManualJobEntry(jobText) {
    const lines = jobText.split('\n').map(l => l.trim()).filter(l => l);

    const job = {
      title: '',
      description: '',
      skills: '',
      budget: '',
      duration: '',
      fullText: jobText
    };

    for (const line of lines) {
      const lower = line.toLowerCase();

      if (lower.startsWith('job title:') || lower.startsWith('title:')) {
        job.title = line.split(':').slice(1).join(':').trim();
      } else if (lower.startsWith('description:')) {
        job.description = line.split(':').slice(1).join(':').trim();
      } else if (lower.startsWith('skills:') || lower.startsWith('required skills:')) {
        job.skills = line.split(':').slice(1).join(':').trim();
      } else if (lower.startsWith('budget:')) {
        job.budget = line.split(':').slice(1).join(':').trim();
      } else if (lower.startsWith('duration:')) {
        job.duration = line.split(':').slice(1).join(':').trim();
      } else if (!job.description && job.title) {
        // If we have a title but no description yet, treat remaining lines as description
        job.description += (job.description ? ' ' : '') + line;
      }
    }

    // Fallback: if no structured data found, use first line as title and rest as description
    if (!job.title && lines.length > 0) {
      job.title = lines[0];
      job.description = lines.slice(1).join(' ');
    }

    return job;
  }

  /**
   * Build job description for GPT from manual entry
   * @param {Object} jobEntry - Parsed job object
   * @returns {string} Formatted job description
   */
  buildManualJobDescription(jobEntry) {
    const sections = [];

    if (jobEntry.title) {
      sections.push(`Job Title: ${jobEntry.title}`);
    }

    if (jobEntry.description) {
      sections.push(`\nJob Description:\n${jobEntry.description}`);
    }

    if (jobEntry.skills) {
      sections.push(`\nRequired Skills: ${jobEntry.skills}`);
    }

    if (jobEntry.budget) {
      sections.push(`\nBudget: ${jobEntry.budget}`);
    }

    if (jobEntry.duration) {
      sections.push(`\nDuration: ${jobEntry.duration}`);
    }

    return sections.join('\n');
  }

  /**
   * Start a scrape-jobs campaign with manual job entries
   * @param {string} id - Campaign ID
   */
  async startScrapeJobsCampaign(id) {
    console.log('\n===== STARTING MANUAL JOBS CAMPAIGN =====');
    console.log('Campaign ID:', id);

    if (this.running.get(id)) {
      console.log('Campaign already running');
      return;
    }

    this.running.set(id, true);
    this.setStatus(id, 'Running');

    const campaign = await storage.getScrapeJobsCampaign(id);

    if (!campaign) {
      console.log('Campaign not found');
      this.running.delete(id);
      return;
    }

    console.log('Campaign found:', campaign.name);
    console.log('Manual jobs to process:', campaign.scrapeJobUrls.length);
    console.log('Selected niche:', campaign.scrapeJobNiche);

    try {
      this.log(id, 'info', `🚀 Starting Manual Jobs campaign: ${campaign.name}`);
      this.log(id, 'info', `📋 Total jobs to process: ${campaign.scrapeJobUrls.length}`);
      this.log(id, 'info', `🎯 Niche: ${campaign.scrapeJobNiche}`);
      this.log(id, 'info', `🛡️ Duplicate detection: ENABLED`);

      // Get GPT cookies
      const cookies = await this.getGPTCookies(campaign.gptAccountId, id);

      let processed = 0;
      let successfulRepos = 0;
      let duplicates = 0;
      let errors = 0;
      let results = [];

      // Process each manual job entry
      for (let i = 0; i < campaign.scrapeJobUrls.length; i++) {
        // Check if campaign was stopped
        if (!this.running.get(id)) {
          this.log(id, 'info', 'Campaign stopped by user');
          break;
        }

        const jobText = campaign.scrapeJobUrls[i];

        try {
          processed++;
          const progress = {
            processed,
            total: campaign.scrapeJobUrls.length,
            successfulRepos,
            duplicates,
            errors
          };
          await storage.updateScrapeJobsCampaign(id, { progress });
          this.emit('progress', { campaignId: id, ...progress });

          this.log(id, 'info', `\n📋 Processing job ${processed}/${campaign.scrapeJobUrls.length}`);

          // Parse manual job entry
          this.log(id, 'info', '📝 Parsing manual job entry...');
          const jobEntry = this.parseManualJobEntry(jobText);

          if (!jobEntry.title) {
            this.log(id, 'error', `❌ Could not parse job entry (no title found)`);
            errors++;

            // Update progress for parse error
            const parseErrorProgress = {
              processed,
              total: campaign.scrapeJobUrls.length,
              successfulRepos,
              duplicates,
              errors
            };
            await storage.updateScrapeJobsCampaign(id, { progress: parseErrorProgress });
            this.emit('progress', { campaignId: id, ...parseErrorProgress });

            continue;
          }

          this.log(id, 'success', `✅ Job parsed: ${jobEntry.title}`);

          // Check for duplicates
          this.log(id, 'info', '🔍 Checking for duplicate jobs in database...');

          const isDuplicate = await storage.checkJobDuplicate(
            jobEntry.title,
            jobEntry.description,
            0.85
          );

          if (isDuplicate) {
            duplicates++;
            const newProgress = {
              processed,
              total: campaign.scrapeJobUrls.length,
              successfulRepos,
              duplicates,
              errors
            };
            await storage.updateScrapeJobsCampaign(id, { progress: newProgress });
            this.emit('progress', { campaignId: id, ...newProgress });

            this.log(id, 'warning', `⚠️ DUPLICATE DETECTED - Skipping job`);
            this.log(id, 'warning', `   Original job: "${isDuplicate.title}"`);
            this.log(id, 'warning', `   Processed on: ${new Date(isDuplicate.createdAt).toLocaleString()}`);
            if (isDuplicate.repoUrl) {
              this.log(id, 'warning', `   Repo: ${isDuplicate.repoUrl}`);
            }
            this.log(id, 'info', `   Total duplicates skipped: ${duplicates}`);

            // Wait before next job
            if (i < campaign.scrapeJobUrls.length - 1) {
              this.log(id, 'info', `⏸️ Waiting ${Math.round(campaign.delayBetweenRepos / 1000)}s before next job...`);
              await this.delay(campaign.delayBetweenRepos);
            }
            continue;
          }

          this.log(id, 'success', `✅ No duplicate found - proceeding with job`);

          // Use user-selected niche (no GPT filtering needed)
          const niche = campaign.scrapeJobNiche;
          this.log(id, 'info', `🎯 Using selected niche: ${niche}`);

          // ====== GENERATE CONTENT (Product, Blog, Service) ======
          this.log(id, 'info', '🚀 Generating product, blog, and service pages...');

          const jobDescription = this.buildManualJobDescription(jobEntry);

          try {
            const contentResult = await generateForJob({
              jobTitle: jobEntry.title,
              jobDescription,
              cookies,
              campaignId: id,
              gptAccountId: campaign.gptAccountId,
              logFn: (msg) => this.log(id, 'info', msg),
              shouldAbort: () => !this.running.get(id),
              jobSkills: jobEntry.skills || 'Not specified',
              jobBudget: jobEntry.budget || 'Not specified'
            });

            this.log(id, 'success', `✅ Content generated successfully`);
            if (contentResult.productParsed) this.log(id, 'success', `   Product: ${contentResult.productParsed.title}`);
            if (contentResult.blogParsed) this.log(id, 'success', `   Blog: ${contentResult.blogParsed.title}`);
            if (contentResult.serviceParsed) this.log(id, 'success', `   Service: ${contentResult.serviceParsed.title}`);

            try {
              await storage.createJobsSelected({
                campaignId: id,
                title: jobEntry.title,
                description: jobDescription,
                niche: niche,
                platform: 'None',
                tool: 'None',
                upworkJobUrl: 'manual-entry'
              });
            } catch (jsError) {
              this.log(id, 'warning', `⚠️ Failed to store in jobs_selected: ${jsError.message}`);
            }
          } catch (contentError) {
            this.log(id, 'error', `❌ Content generation failed: ${contentError.message}`);
            this.log(id, 'info', 'Continuing to next job...');
          }

          successfulRepos++;

          // Store processed job to prevent duplicates
          try {
            await storage.storeProcessedJob({
              id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              title: jobEntry.title,
              description: jobEntry.description,
              campaignId: id,
              niche: niche,
              platform: 'None',
              tool: 'None',
              repoUrl: '',
              upworkJobUrl: 'manual-entry'
            });

            this.log(id, 'success', `💾 Job stored in database to prevent future duplicates`);
          } catch (storeError) {
            this.log(id, 'warning', `⚠️ Failed to store job in duplicate database: ${storeError.message}`);
          }

          // Record result
          results.push({
            jobTitle: jobEntry.title,
            niche: niche,
            timestamp: new Date().toISOString(),
            status: 'success'
          });

          // Update progress with successful repo count
          const updatedProgress = {
            processed,
            total: campaign.scrapeJobUrls.length,
            successfulRepos,
            duplicates,
            errors
          };

          // Save results and updated progress
          await storage.updateScrapeJobsCampaign(id, {
            results: results,
            progress: updatedProgress
          });
          this.emit('progress', { campaignId: id, ...updatedProgress });

          this.log(id, 'success', `📊 Progress: ${successfulRepos} repos / ${duplicates} duplicates / ${errors} errors`);

        } catch (error) {
          this.log(id, 'error', `❌ Failed to process job: ${error.message}`);
          errors++;

          // Record failed result
          results.push({
            jobText: jobText.substring(0, 100) + '...',
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
          });

          // Update progress with error count
          const errorProgress = {
            processed,
            total: campaign.scrapeJobUrls.length,
            successfulRepos,
            duplicates,
            errors
          };

          await storage.updateScrapeJobsCampaign(id, {
            results: results,
            progress: errorProgress
          });
          this.emit('progress', { campaignId: id, ...errorProgress });
        }

        // Wait before next job (unless it's the last one)
        if (i < campaign.scrapeJobUrls.length - 1 && this.running.get(id)) {
          this.log(id, 'info', `⏸️ Waiting ${Math.round(campaign.delayBetweenRepos / 1000)}s before next job...`);
          await this.delay(campaign.delayBetweenRepos);
        }
      }

      this.log(id, 'success', `\n✅ Campaign completed!`);
      this.log(id, 'success', `   📊 Final stats:`);
      this.log(id, 'success', `   - Total processed: ${processed}`);
      this.log(id, 'success', `   - Repos created: ${successfulRepos}`);
      this.log(id, 'success', `   - Duplicates skipped: ${duplicates}`);
      this.log(id, 'success', `   - Errors: ${errors}`);

      // Distinguish user stop from natural completion
      if (this.stoppedByUser.has(id)) {
        this.log(id, 'info', 'Campaign stopped by user');
        this.stoppedByUser.delete(id);
      } else {
        await this.setStatus(id, 'Completed');
      }

    } catch (error) {
      this.log(id, 'error', `Campaign failed: ${error.message}`);
      await this.setStatus(id, 'Failed');
    } finally {
      this.running.delete(id);
      this.stoppedByUser.delete(id);
    }
  }


  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCampaignLogs(id) {
    console.log(`Getting logs for Upwork campaign: ${id}`);
    return storage.getLogs(id);
  }
}

export const upworkCampaignManager = new UpworkCampaignManager();



