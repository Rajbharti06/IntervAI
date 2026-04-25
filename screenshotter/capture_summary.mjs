import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'screenshots');
const UI = 'http://localhost:5174';
const NVIDIA_KEY = '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';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();

  // Auto-accept all dialogs upfront
  page.on('dialog', async d => { console.log('dialog:', d.message().slice(0,60)); await d.accept(); });

  // Navigate to setup
  await page.goto(UI, { waitUntil: 'networkidle2' });
  await sleep(800);

  // Select NVIDIA card
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent.includes('NVIDIA')) {
        el.closest('[role="button"], button, [class*="cursor-pointer"], [class*="card"]')?.click();
        return;
      }
    }
  });
  await sleep(400);

  // Fill API key (first visible text/password input)
  await page.evaluate((key) => {
    const inputs = [...document.querySelectorAll('input')];
    const apiInput = inputs.find(i => i.type === 'password' || i.placeholder?.toLowerCase().includes('key') || i.placeholder?.toLowerCase().includes('api'));
    if (apiInput) {
      apiInput.value = key;
      apiInput.dispatchEvent(new Event('input', { bubbles: true }));
      apiInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, NVIDIA_KEY);
  await sleep(200);

  // Fill domain
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')];
    const domainInput = inputs.find(i => i.placeholder?.toLowerCase().includes('domain') || i.name === 'domain');
    if (domainInput) {
      domainInput.value = 'Software Engineering';
      domainInput.dispatchEvent(new Event('input', { bubbles: true }));
      domainInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await sleep(200);

  // Click Start Interview
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (/start.*(interview|session)/i.test(btn.textContent) || /begin/i.test(btn.textContent)) {
        btn.click(); return;
      }
    }
    // fallback: first submit/primary button
    document.querySelector('button[type="submit"], form button')?.click();
  });

  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 12000 }).catch(() => {});
  await sleep(1500);
  console.log('After start:', page.url());

  // Generate question
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (/generate question/i.test(btn.textContent)) { btn.click(); return; }
    }
  });
  await sleep(9000); // wait for LLM stream

  // Type answer
  const ta = await page.$('textarea');
  if (ta) {
    await ta.click();
    await ta.type('I would use horizontal scaling with a load balancer, stateless app tier with Redis, read replicas, and CDN plus Redis cache. For CAP theorem I favor AP for feeds and strong consistency for transactions. Circuit breakers prevent cascade failures.', { delay: 6 });
  }
  await sleep(300);

  // Send answer
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent.trim() === 'Send') { btn.click(); return; }
    }
  });
  await sleep(10000); // wait for evaluation

  // End Interview — dialog already auto-accepted
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (/end interview/i.test(btn.textContent)) { btn.click(); return; }
    }
  });

  // Wait for summary navigation
  try {
    await page.waitForFunction(() => window.location.pathname === '/summary', { timeout: 20000 });
  } catch {
    console.log('waitForFunction timed out, url:', page.url());
  }
  await sleep(3000);
  console.log('Summary url:', page.url());

  await page.screenshot({ path: path.join(OUT, '05_summary.png') });
  console.log('saved 05_summary.png');

  // Dashboard
  await page.goto(`${UI}/dashboard`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, '06_dashboard.png') });
  console.log('saved 06_dashboard.png');

  await browser.close();
  console.log('Done.');
})();
