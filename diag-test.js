import puppeteer from 'puppeteer';
import pg from 'pg';

const pool = new pg.Pool({
  host: 'localhost', port: 5432, user: 'postgres',
  password: '1234', database: 'upwork_jobs',
});

async function run() {
  const { rows } = await pool.query(`SELECT cookies FROM gpt_accounts WHERE id = 'IEq4HLbdUdDdZt1aBj-4E'`);
  let cookieData = rows[0].cookies;
  if (typeof cookieData === 'string') cookieData = JSON.parse(cookieData);

  const browser = await puppeteer.launch({ headless: false, timeout: 60000, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const formatted = cookieData.map(c => ({
    name: c.name, value: c.value, domain: c.domain,
    path: c.path || '/', secure: c.secure !== false, httpOnly: c.httpOnly || false,
  }));
  await page.setCookie(...formatted);

  await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));

  const checks = await page.evaluate(() => {
    const composerSelector = ['textarea#prompt-textarea','#prompt-textarea','[data-testid="prompt-textarea"]','div[contenteditable="true"]','.ProseMirror'].join(', ');
    const hasComposer = !!document.querySelector(composerSelector);
    const hasAccountProfile = !!document.querySelector('[data-testid="accounts-profile-button"], [data-testid="profile-button"], button[aria-label*="Account" i]');
    const text = document.body?.innerText || '';
    const hasLoginPrompt = /log in or sign up|sign up or log in to save chats|continue with google|continue with apple|email address/i.test(text);
    return { hasComposer, hasAccountProfile, hasLoginPrompt, bodyPreview: text.substring(0, 300) };
  });

  console.log('hasComposer:', checks.hasComposer);
  console.log('hasAccountProfile:', checks.hasAccountProfile);
  console.log('hasLoginPrompt:', checks.hasLoginPrompt);
  console.log('Body preview:', checks.bodyPreview);

  await page.screenshot({ path: 'D:/One-Week-work-with-CEO/diag-login-check.png' });
  console.log('Screenshot saved');

  await browser.close();
  await pool.end();
}
run().catch(e => console.error('FAILED:', e.message));
