import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

const chromePath = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find(p => fs.existsSync(p));

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('🔍 Testing stealth + cookies + prompt...');
  console.log('   Chrome:', chromePath || 'auto-detect');

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--window-position=100,50',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  );

  // Step 1: Load cookies from cookies.json
  console.log('\n🍪 Loading cookies from cookies.json...');
  const cookiesRaw = JSON.parse(fs.readFileSync('./cookies.json', 'utf-8'));
  const validCookies = cookiesRaw.filter(c => c.name && c.value).map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain || '.chatgpt.com',
    path: c.path || '/',
    secure: c.secure !== undefined ? c.secure : true,
    httpOnly: c.httpOnly !== undefined ? c.httpOnly : true,
    ...(c.expirationDate ? { expires: c.expirationDate } : {}),
  }));
  console.log(`   Loaded ${validCookies.length} cookies`);

  // Step 2: First navigate to ChatGPT domain so cookies can be set
  await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.setCookie(...validCookies);
  console.log('   Cookies set!');

  // Step 3: Reload with cookies
  await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await sleep(4000);

  // Step 4: Check if logged in
  const text = await page.evaluate(() => document.body?.innerText || '');
  const title = await page.title();
  console.log('\n=== LOGIN CHECK ===');
  console.log('Title:', title);

  const cloudflare = /checking your browser|verify you are human|cloudflare|ray id|just a moment/i;
  if (cloudflare.test(title + '\n' + text)) {
    console.log('❌ BLOCKED by Cloudflare');
    await sleep(3000);
    await browser.close();
    process.exit(1);
  }

  const loginPrompt = /log in|sign in|email address|continue with google/i;
  const hasComposer = await page.evaluate(() => {
    const s = 'textarea#prompt-textarea, #prompt-textarea, [data-testid="prompt-textarea"], textarea[placeholder*="Message"], [role="textbox"][contenteditable="true"]';
    return !!document.querySelector(s);
  });
  const hasNewChat = /new chat|ask anything|what are you working on/i.test(text);
  const isLoggedIn = (hasComposer || hasNewChat) && !loginPrompt.test(text);

  if (isLoggedIn) {
    console.log('✅ LOGGED IN! ChatGPT is ready.');
  } else if (loginPrompt.test(text)) {
    console.log('⚠️  Cookies expired — login page shown. You need fresh cookies.');
    console.log('   Open https://chatgpt.com in your normal browser,');
    console.log('   export cookies, and replace cookies.json');
    await sleep(5000);
    await browser.close();
    process.exit(0);
  }

  // Step 5: Send a test prompt
  if (isLoggedIn) {
    console.log('\n📝 Sending test prompt: "Say hello in 5 words"');
    const prompt = 'Say hello in 5 words';

    // Try clicking the textarea and typing
    const typed = await page.evaluate((p) => {
      const ta = document.querySelector('textarea#prompt-textarea, #prompt-textarea, [data-testid="prompt-textarea"], textarea[placeholder*="Message"], [role="textbox"][contenteditable="true"]');
      if (!ta) return false;
      ta.focus();
      if (ta.tagName === 'TEXTAREA' || ta.tagName === 'INPUT') {
        ta.value = p;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (ta.isContentEditable) {
        ta.textContent = p;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    }, prompt);

    if (!typed) {
      console.log('❌ Could not find input field');
      await sleep(3000);
    } else {
      console.log('   Typed prompt. Waiting 2s...');
      await sleep(2000);

      // Click send button or press Enter
      await page.evaluate(() => {
        const btn = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]');
        if (btn) { btn.click(); return; }
        // Try pressing Enter
        const ta = document.querySelector('textarea, [role="textbox"][contenteditable="true"]');
        if (ta) {
          ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        }
      });

      console.log('   Waiting for response (30s)...');
      const start = Date.now();
      let responseText = '';
      while (Date.now() - start < 30000) {
        await sleep(1000);
        responseText = await page.evaluate(() => {
          const articles = document.querySelectorAll('[data-message-author-role="assistant"]');
          if (!articles.length) return '';
          const last = articles[articles.length - 1];
          return last.textContent || '';
        }).catch(() => '');
        if (responseText && responseText.length > 5) {
          // Check if still streaming (has stop button)
          const stopBtn = await page.evaluate(() => {
            return !!document.querySelector('button[data-testid="stop-button"], button[aria-label*="Stop"]');
          }).catch(() => false);
          if (!stopBtn) break;
        }
      }

      if (responseText) {
        console.log('\n✅ CHATGPT RESPONDED:');
        console.log('   "' + responseText.trim() + '"');
      } else {
        console.log('\n⚠️  No response received within timeout.');
        console.log('   Check the browser window to see if ChatGPT needs attention.');
      }
    }
  }

  console.log('\n⏳ Browser stays open for 20s so you can inspect...');
  await sleep(20000);
  await browser.close();
  console.log('Done.');
})();
