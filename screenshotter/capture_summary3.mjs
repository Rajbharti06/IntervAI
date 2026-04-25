import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'screenshots');
const UI  = 'http://localhost:5174';
const API = 'http://localhost:8000';
const KEY = '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';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  // Start fresh session via API — UI will do everything else
  const fd = new FormData();
  fd.append('domain', 'Software Engineering');
  fd.append('provider', 'nvidia');
  fd.append('api_key', KEY);
  fd.append('track_id', 'google');
  fd.append('difficulty', 'medium');
  const session = await fetch(`${API}/interview/start`, { method: 'POST', body: fd }).then(r => r.json());
  console.log('session_id:', session.session_id);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();

  // Override confirm before any navigation
  await page.evaluateOnNewDocument(() => { window.confirm = () => true; });

  // Auto-accept any remaining dialogs
  page.on('dialog', async d => { console.log('dialog:', d.type()); await d.accept(); });

  // Inject session and navigate to /interview
  await page.goto(UI, { waitUntil: 'networkidle2' });
  await page.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('intervai_active_session', JSON.stringify({
      session_id: s.session_id, provider: s.provider,
      domain: s.domain, difficulty: s.difficulty,
    }));
  }, session);

  await page.goto(`${UI}/interview`, { waitUntil: 'networkidle2' });
  await sleep(1200);

  // Generate question
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button'))
      if (/generate question/i.test(btn.textContent)) { btn.click(); return; }
  });
  console.log('waiting for question stream...');
  await sleep(10000);
  await page.screenshot({ path: path.join(OUT, '03_interview_question.png') });
  console.log('saved 03_interview_question.png');

  // Type answer
  const ta = await page.$('textarea');
  if (ta) {
    await ta.click();
    await ta.type(
      'I would use horizontal auto-scaling with load balancer, stateless app tier with Redis sessions, read replicas for DB, CDN + Redis caching. For CAP theorem I favor AP for feeds and strong consistency for transactions. Circuit breakers prevent cascades.',
      { delay: 5 }
    );
  }
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, '03b_interview_answer_typed.png') });
  console.log('saved 03b_interview_answer_typed.png');

  // Send answer
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button'))
      if (btn.textContent.trim() === 'Send') { btn.click(); return; }
  });
  console.log('waiting for feedback...');
  await sleep(12000);
  await page.screenshot({ path: path.join(OUT, '04_interview_feedback.png') });
  console.log('saved 04_interview_feedback.png');

  // End interview — window.confirm already returns true via evaluateOnNewDocument
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button'))
      if (/end interview/i.test(btn.textContent)) { btn.click(); return; }
  });
  console.log('clicked End Interview, waiting for /summary...');

  await page.waitForFunction(() => window.location.pathname.includes('summary'), { timeout: 30000 })
    .catch(() => console.warn('still not on /summary, url:', page.url()));
  await sleep(3000);
  console.log('final url:', page.url());

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
