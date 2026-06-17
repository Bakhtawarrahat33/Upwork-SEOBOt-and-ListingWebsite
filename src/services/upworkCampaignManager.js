import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './storage.js';
import { upworkJobService } from './upworkJobService.js';
import { extractAndRepairJSON, normalizeJobFilterResponse } from '../utils/jsonRepairUtil.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function launchBrowser(cookies, gptAccountId = 'default') {
  console.log('   🔧 Launching Puppeteer browser...');
  const puppeteer = (await import('puppeteer')).default;
  const browser = await puppeteer.launch({
    protocolTimeout: 120000,
    headless: false,
    userDataDir: getStandaloneChatGPTProfileDir(gptAccountId),
    defaultViewport: { width: 1280, height: 800 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  if (cookies) {
    const cookieArray = normalizeCookiesForContentGen(cookies);
    if (cookieArray.length > 0) {
      console.log(`🍪 Setting ${cookieArray.length} cookies for GPT session`);
      await page.setCookie(...cookieArray);
    } else {
      console.warn('⚠️ No valid cookies to set after normalization');
    }
  }
  return { browser, page };
}

async function isStandaloneChatGPTLoggedIn(page) {
  return await page.evaluate(() => {
    const text = document.body?.innerText || '';
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
    const hasLoginPrompt = /log in or sign up|continue with google|continue with apple|email address/i.test(text);
    const onAuthRoute = /\/auth\/(login|signup)/.test(window.location.pathname);

    return (hasComposer || hasLoggedInShell) && !hasLoginPrompt && !onAuthRoute;
  });
}

async function waitForStandaloneChatGPTLogin(page, logFn, timeoutMs = 600000) {
  if (await isStandaloneChatGPTLoggedIn(page)) return;

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

async function sendPromptToChatGPT(page, prompt, logFn) {
  logFn('   🌐 Navigating to ChatGPT...');
  await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(10000);
  await waitForStandaloneChatGPTLogin(page, logFn);

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

  const streamedResponseText = await waitForResponseComplete(page, 120000, logFn, assistantCountBefore);

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
      const stopButton = document.querySelector(
        '[data-testid="stop-button"], ' +
        'button[aria-label*="Stop" i]'
      );

      const assistantMessages = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
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
    });

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

  logFn('⚠️ Timeout waiting for response — proceeding with extraction');
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
    const title       = result.title       || result.PRODUCT_TITLE || 'Untitled Product'
    const description = result.description || result.TAGLINE       || ''
    const content     = result.content     || result.OVERVIEW      || ''
    const topics      = Array.isArray(result.topics) ? result.topics : []
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
    const title           = result.title            || result.BLOG_TITLE       || 'Untitled Blog Post'
    const content         = result.content          || result.BLOG_CONTENT     || ''
    const metaDescription = result.meta_description || result.META_DESCRIPTION || ''
    const category        = result.category         || 'General'
    const tags            = Array.isArray(result.tags)   ? result.tags   : []
    const topics          = Array.isArray(result.topics) ? result.topics : []
    const blogSlug        = result.slug             || result.BLOG_SLUG        || ''
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
    const title       = result.title       || result.SERVICE_TITLE || 'Untitled Service'
    const description = result.description || result.TAGLINE       || ''
    const content     = result.content     || result.OVERVIEW      || ''
    const topics      = Array.isArray(result.topics) ? result.topics : []
    const serviceSlug = result.slug        || result.SERVICE_SLUG  || ''
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

async function generateForJob({ jobTitle, jobDescription, cookies, campaignId, gptAccountId, logFn, shouldAbort, jobSkills, jobBudget }) {
  logFn(`\n${'='.repeat(60)}`);
  logFn(`🔄 PIPELINE START: ${jobTitle}`);
  logFn(`${'='.repeat(60)}`);

  const { browser, page } = await launchBrowser(cookies, gptAccountId);

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
            () => sendPromptToChatGPT(page, productPrompt, logFn),
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
            () => sendPromptToChatGPT(page, blogPrompt, logFn),
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
            () => sendPromptToChatGPT(page, servicePrompt, logFn),
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
    await browser.close();
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
    this.loadPrompts();
    console.log('UpworkCampaignManager initialized');
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
    const onRetry = options.onRetry || (() => {});
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
        onRetry(attempt + 1, delay, error);
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
    return /not logged in to chatgpt|update gpt account cookies|cookies marked invalid/i.test(error?.message || '');
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

  async navigateToChatGPT(page, campaignId) {
    try {
      await page.goto('https://chatgpt.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 90000
      });
    } catch (error) {
      if (!/timeout/i.test(error.message || '')) throw error;
      this.log(campaignId, 'warning', 'ChatGPT navigation was slow, continuing with the loaded page.');
    }

    await page.waitForFunction(() => document.body && document.readyState !== 'loading', { timeout: 30000 }).catch(() => {});
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

  /**
   * Send prompt using clipboard paste method (most reliable)
   */
  async sendPromptToGPT(page, prompt, logFn) {
    logFn(`📤 Preparing to send prompt...`);
    
    try {
      // Method 1: Use clipboard paste (most reliable for long text)
      logFn(`⌨️ Using clipboard paste method...`);
      
      // Copy prompt to clipboard
      await page.evaluate((text) => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }, prompt);
      
      const textareaSelector = await this.waitForChatGPTComposer(page);
      await this.focusChatGPTComposer(page, textareaSelector);
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Paste using keyboard shortcut
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyV');
      await page.keyboard.up('Control');
      
      logFn(`✅ Prompt pasted successfully`);
      
      // Wait for the text to appear
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify the text was pasted
      const textContent = await page.evaluate((selector) => {
        const textarea = Array.from(document.querySelectorAll(selector)).find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          const style = window.getComputedStyle(candidate);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        });
        return textarea ? (textarea.value || textarea.textContent || textarea.innerText) : '';
      }, textareaSelector);
      
      if (textContent.length < prompt.length * 0.9) {
        logFn(`⚠️ Clipboard paste may have failed, trying direct DOM method...`);
        await this.sendPromptDirectDOM(page, prompt, textareaSelector);
      }
      
    } catch (error) {
      logFn(`⚠️ Clipboard method failed: ${error.message}, trying direct DOM method...`);
      const textareaSelector = await this.waitForChatGPTComposer(page);
      await this.sendPromptDirectDOM(page, prompt, textareaSelector);
    }
    
    // Wait a moment for the text to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Find and click send button
    logFn(`📤 Sending message...`);
    const sendButtonSelector = 'button[data-testid="send-button"], button[aria-label*="Send"]';
    
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
      await this.focusChatGPTComposer(page).catch(() => {});
      await page.keyboard.press('Enter');
    }
    
    logFn(`✅ Message sent`);
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
      ? { maxStableChecks: 5, checkInterval: 2000, minLength: 50, overallTimeoutMs: 120000, resendOnIdleMs: 15000, ...a }
      : { maxStableChecks: a, checkInterval: b, minLength: c, overallTimeoutMs: 120000, resendOnIdleMs: 15000 };

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
        logFn(`⏱️ Timeout waiting for response (~${Math.round(opts.overallTimeoutMs/1000)}s). Proceeding with current content.`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, opts.checkInterval));

      const state = await page.evaluate(() => {
        const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
        const last = messages.length > 0 ? messages[messages.length - 1] : null;
        const length = last ? (last.textContent?.length || 0) : 0;
        const isGenerating = !!(
          document.querySelector('[data-testid="stop-button"]') ||
          document.querySelector('button[aria-label*="Stop" i]')
        );
        const hasRegenerate = !!document.querySelector('[data-testid="regenerate-button"], button:has(svg[aria-label*="Regenerate"])');
        return { length, isGenerating, hasRegenerate };
      });

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

      // If idle for too long and nothing seems to be generating, try a gentle nudge (press Enter once)
      if (!state.isGenerating && state.length <= opts.minLength && (Date.now() - lastChangeTs) > opts.resendOnIdleMs && !resentOnce) {
        try {
          logFn('⚠️ No output detected after sending. Taking screenshot...');
          try {
            await page.screenshot({ path: `gpt-timeout-${Date.now()}.png` });
            logFn('📸 Screenshot saved for debugging');
          } catch (e) {}
          logFn('⚠️ Nudging with Enter once...');
          await page.keyboard.press('Enter');
          resentOnce = true;
          lastChangeTs = Date.now();
          continue;
        } catch {}
      }

      // Keep page scrolled to bottom to avoid lazy rendering issues
      try {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      } catch {}
    }
  }

  /**
   * Extract response from ChatGPT DOM
   * FIXED: Preserves code fences for metadata extraction
   */
  async extractGPTResponse(page) {
    return await page.evaluate(() => {
      const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        
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
    });
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
          domain: c.domain || '.chatgpt.com',
          path: c.path || '/',
          secure: c.secure !== undefined ? c.secure : true,
          httpOnly: c.httpOnly !== undefined ? c.httpOnly : true,
        };
        return out;
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  }

  async verifyChatGPTLoggedIn(page) {
    return await page.evaluate(() => {
      const text = document.body?.innerText || '';
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
      const hasLoginPrompt = /log in or sign up|continue with google|continue with apple|email address/i.test(text);
      const onAuthRoute = /\/auth\/(login|signup)/.test(window.location.pathname);

      return (hasComposer || hasLoggedInShell) && !hasLoginPrompt && !onAuthRoute;
    });
  }

  async findLoggedInChatGPTPage(browser) {
    const pages = await browser.pages();
    for (const candidate of pages) {
      try {
        const url = candidate.url();
        if (!/chatgpt\.com/.test(url)) continue;
        if (await this.verifyChatGPTLoggedIn(candidate)) {
          await candidate.bringToFront();
          return candidate;
        }
      } catch {}
    }
    return null;
  }

  getChatGPTProfileDir(gptAccountId = 'default') {
    const safeId = String(gptAccountId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    const profileDir = path.join(process.cwd(), '.chatgpt-profiles', safeId);
    fs.mkdirSync(profileDir, { recursive: true });
    return profileDir;
  }

  async launchChatGPTBrowser(puppeteer, gptAccountId) {
    const profileDir = this.getChatGPTProfileDir(gptAccountId);
    const browser = await puppeteer.launch({
      protocolTimeout: 120000,
      headless: false,
      userDataDir: profileDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    return { browser, page, profileDir };
  }

  async ensureChatGPTSession(page, campaignId, gptAccountId, timeoutMs = 600000) {
    if (await this.verifyChatGPTLoggedIn(page)) {
      return page;
    }

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
          this.log(campaignId, 'success', 'ChatGPT login detected. Continuing automation.');
          return loggedInPage;
        }

        if (await this.verifyChatGPTLoggedIn(page)) {
          this.clearInvalidGptAccount(gptAccountId);
          this.log(campaignId, 'success', 'ChatGPT login detected. Continuing automation.');
          return page;
        }
      } catch {}
    }

    if (gptAccountId) this.markGptAccountInvalid(gptAccountId);
    throw new Error('Not logged in to ChatGPT after waiting for manual login.');
  }

  async filterJobWithGPT(jobDetails, cookies, campaignId, gptAccountId) {
    this.log(campaignId, 'info', `🤖 Filtering job: ${jobDetails.title}`);

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

  async _filterJobWithGPTInternal(jobDetails, cookies, campaignId, gptAccountId) {
    const puppeteer = (await import('puppeteer')).default;
    let browser;

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

      const launched = await this.launchChatGPTBrowser(puppeteer, gptAccountId);
      browser = launched.browser;
      let page = launched.page;

      // Register active browser for force-stop support
      this.activeBrowsers.set(campaignId, browser);

      // Load cookies with sanitization (handles both ARRAY and OBJECT formats)
      const sanitizedCookies = this.sanitizeCookies(cookies);
      if (sanitizedCookies.length > 0) {
        console.log(`🍪 Setting ${sanitizedCookies.length} cookies for account`);
        await page.setCookie(...sanitizedCookies);
      } else {
        this.log(campaignId, 'warning', '⚠️ No valid cookies to set — GPT session may fail');
      }

      await this.navigateToChatGPT(page, campaignId);

      page = await this.ensureChatGPTSession(page, campaignId, gptAccountId);

      await this.waitForChatGPTComposer(page);

      // Send prompt using helper method (same as apifyToGPTProcessor)
      await this.sendPromptToGPT(page, fullPrompt, (msg) => this.log(campaignId, 'info', msg));

      // Wait for response to complete
      await this.waitForGPTResponse(page, (msg) => this.log(campaignId, 'info', msg), 5, 2000, 50);

      // Extract response
      const responseText = await this.extractGPTResponse(page);

      if (!responseText) {
        throw new Error('No response received from GPT');
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
      if (browser) {
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
    
    const puppeteer = (await import('puppeteer')).default;
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
      
      const launched = await this.launchChatGPTBrowser(puppeteer, gptAccountId);
      browser = launched.browser;
      let page = launched.page;

      // Register active browser for force-stop support
      this.activeBrowsers.set(campaignId, browser);

      // Load cookies with sanitization (handles both ARRAY and OBJECT formats)
      const sanitizedCookies = this.sanitizeCookies(cookies);
      if (sanitizedCookies.length > 0) {
        console.log(`🍪 Setting ${sanitizedCookies.length} cookies for account`);
        await page.setCookie(...sanitizedCookies);
      } else {
        this.log(campaignId, 'warning', '⚠️ No valid cookies to set — GPT session may fail');
      }

      await this.navigateToChatGPT(page, campaignId);

      page = await this.ensureChatGPTSession(page, campaignId, gptAccountId);

      await this.waitForChatGPTComposer(page);

      // Send prompt using helper method (same as apifyToGPTProcessor)
      await this.sendPromptToGPT(page, fullPrompt, (msg) => this.log(campaignId, 'info', msg));

      // Wait for response to complete (longer wait for README generation)
      await this.waitForGPTResponse(page, (msg) => this.log(campaignId, 'info', msg), 8, 3000, 500);

      // Extract response
      const responseText = await this.extractGPTResponse(page);

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
      // Check if this account is already known to have invalid cookies
      if (this.invalidGptAccounts.has(gptAccountId)) {
        throw new Error('GPT account cookies marked invalid. Please refresh cookies in Settings.');
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

      if (!account || !account.cookies) {
        throw new Error('GPT account cookies not found');
      }

      // Parse cookies if they're a string
      let cookies = account.cookies;
      if (typeof cookies === 'string') {
        try {
          cookies = JSON.parse(cookies);
        } catch (e) {
          throw new Error('Invalid cookies format');
        }
      }

      // Normalize: handle both ARRAY and OBJECT formats
      const normalized = this.normalizeCookies(cookies);
      if (normalized.length === 0) {
        throw new Error('No valid cookies found after normalization');
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
      this.log(id, 'error', `❌ Cannot start campaign: ${cookieError.message}`);
      await this.setStatus(id, 'Failed');
      this.running.delete(id);
      return;
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
            
            // ====== NEW: DUPLICATE DETECTION CHECK ======
            this.log(id, 'info', '🔍 Checking for duplicate jobs in database...');
            
            const isDuplicate = await storage.checkJobDuplicate(
              job.title,
              job.description,
              0.85 // 85% similarity threshold
            );
            
            if (isDuplicate) {
              duplicatesSkipped++;
              nonViable++; // Count as non-viable for stats
              this.updateProgress(id, processed, processed, viable, nonViable);
              
              this.log(id, 'warning', `⚠️ DUPLICATE DETECTED - Skipping job`);
              this.log(id, 'warning', `   Original job: "${isDuplicate.title}"`);
              this.log(id, 'warning', `   Processed on: ${new Date(isDuplicate.createdAt).toLocaleString()}`);
              this.log(id, 'warning', `   Campaign: ${isDuplicate.campaignId}`);
              if (isDuplicate.repoUrl) {
                this.log(id, 'warning', `   Repo: ${isDuplicate.repoUrl}`);
              }
              this.log(id, 'info', `   Total duplicates skipped so far: ${duplicatesSkipped}`);
              
              continue; // Skip to next job
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
            
            try {
              const contentResult = await generateForJob({
                jobTitle: job.title,
                jobDescription,
                cookies,
                campaignId: id,
                gptAccountId: campaign.gptAccountId,
                logFn: (msg) => this.log(id, 'info', msg),
                shouldAbort: () => !this.running.get(id),
                jobSkills: job.skills ? (Array.isArray(job.skills) ? job.skills.join(', ') : job.skills) : 'Not specified',
                jobBudget: job.budget || 'Not specified'
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
              this.log(id, 'error', 'Stopping campaign because the selected GPT account is not logged in.');
              await this.setStatus(id, 'Failed');
              this.running.delete(id);
              break;
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
