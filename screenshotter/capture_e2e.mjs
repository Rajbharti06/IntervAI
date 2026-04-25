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
    defaultViewport: { width: 1440, height: 900 }
  });
  const page = await browser.newPage();

  // ── 1. Setup page ─────────────────────────────────────────────────────────
  console.log('[1] Setup page...');
  await page.goto(UI, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.screenshot({ path: path.join(OUT, '01_setup.png') });
  console.log('    saved 01_setup.png');

  // ── 2. Fill in the form ───────────────────────────────────────────────────
  // Click NVIDIA provider card
  console.log('[2] Selecting NVIDIA provider...');
  await page.evaluate(() => {
    // Find and click the NVIDIA card
    const cards = document.querySelectorAll('[class*="cursor-pointer"]');
    for (const c of cards) {
      if (c.textContent.includes('NVIDIA')) { c.click(); return 'clicked'; }
    }
    return 'not found';
  });
  await sleep(500);

  // Type API key
  const apiKeyInput = await page.$('input[type="password"], input[placeholder*="API"], input[placeholder*="key"], input[name="api_key"]');
  if (apiKeyInput) {
    await apiKeyInput.click({ clickCount: 3 });
    await apiKeyInput.type(NVIDIA_KEY, { delay: 5 });
  } else {
    // Try generic text input that's visible
    await page.evaluate((key) => {
      const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
      for (const inp of inputs) {
        if (!inp.value || inp.value.length < 10) {
          inp.value = key;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
    }, NVIDIA_KEY);
  }
  await sleep(300);

  // Select domain — type in domain input
  const domainInput = await page.$('input[placeholder*="domain"], input[placeholder*="Domain"], input[name="domain"]');
  if (domainInput) {
    await domainInput.click({ clickCount: 3 });
    await domainInput.type('Software Engineering', { delay: 5 });
  }

  // Screenshot setup filled
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, '01b_setup_filled.png') });
  console.log('    saved 01b_setup_filled.png');

  // Click Start Interview button
  console.log('[3] Starting interview...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      const t = b.textContent.trim();
      if (t.includes('Start') && (t.includes('Interview') || t.includes('interview'))) {
        b.click(); return;
      }
    }
    // fallback: click any primary submit button
    const primary = document.querySelector('button[type="submit"], button.btn-primary');
    if (primary) primary.click();
  });

  // Wait for navigation to /interview
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await sleep(2000);

  const url = page.url();
  console.log('    current url:', url);
  await page.screenshot({ path: path.join(OUT, '02_interview_empty.png') });
  console.log('    saved 02_interview_empty.png');

  // ── 3. Generate a question ────────────────────────────────────────────────
  console.log('[4] Generating question...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent.includes('Generate Question') || b.textContent.includes('New Question')) {
        b.click(); return;
      }
    }
  });

  // Wait for question to appear (stream)
  await sleep(8000);
  await page.screenshot({ path: path.join(OUT, '03_interview_question.png') });
  console.log('    saved 03_interview_question.png');

  // ── 4. Type an answer ─────────────────────────────────────────────────────
  console.log('[5] Typing answer...');
  const textarea = await page.$('textarea');
  if (textarea) {
    await textarea.click();
    await textarea.type(
      'I would use horizontal auto-scaling with a load balancer, stateless app tier with Redis sessions, read replicas for the database, and CDN plus Redis caching. For CAP theorem, I favor AP over strict consistency for feeds while using strong consistency for critical transactions. Circuit breakers prevent cascade failures.',
      { delay: 8 }
    );
  }
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, '03b_interview_answer_typed.png') });
  console.log('    saved 03b_interview_answer_typed.png');

  // Submit answer
  console.log('[6] Submitting answer...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent.trim() === 'Send') { b.click(); return; }
    }
  });

  // Wait for feedback
  await sleep(10000);
  await page.screenshot({ path: path.join(OUT, '04_interview_feedback.png') });
  console.log('    saved 04_interview_feedback.png');

  // ── 5. End interview ──────────────────────────────────────────────────────
  console.log('[7] Ending interview...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent.includes('End Interview')) { b.click(); return; }
    }
  });

  // Handle confirmation dialog
  page.on('dialog', async dialog => {
    console.log('    dialog:', dialog.message().slice(0, 60));
    await dialog.accept();
  });
  await sleep(500);

  // Wait for navigation to summary
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
  await sleep(3000);

  const summaryUrl = page.url();
  console.log('    url after end:', summaryUrl);
  await page.screenshot({ path: path.join(OUT, '05_summary.png') });
  console.log('    saved 05_summary.png');

  // ── 6. Dashboard ─────────────────────────────────────────────────────────
  console.log('[8] Navigating to Dashboard...');
  await page.goto(`${UI}/dashboard`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, '06_dashboard.png') });
  console.log('    saved 06_dashboard.png');

  await browser.close();
  console.log('\nDone! All screenshots in ./screenshots/');
})();
