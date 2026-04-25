import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'screenshots');
const UI  = 'http://localhost:5174';
const API = 'http://localhost:8000';
const KEY = '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';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function apiPost(path, fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(`${API}${path}`, { method: 'POST', body: fd });
  return r.json();
}

(async () => {
  // ── API: start session + generate Q + submit A + end ──────────────────────
  console.log('Starting NVIDIA session via API...');
  const session = await apiPost('/interview/start', {
    domain: 'Software Engineering', provider: 'nvidia',
    api_key: KEY, track_id: 'google', difficulty: 'medium',
  });
  const sid = session.session_id;
  console.log('session_id:', sid);

  const qData = await apiPost('/interview/question', { session_id: sid });
  console.log('Q:', qData.question?.slice(0, 80) + '...');

  const ANSWER = 'I would design the system with horizontal auto-scaling behind a load balancer, stateless app servers with Redis for sessions, a primary-replica database setup with read replicas, and CDN plus Redis caching. For CAP theorem trade-offs, I favor availability and partition tolerance for content feeds using eventual consistency, while enforcing strong consistency for financial transactions. I would also add circuit breakers to prevent cascade failures, and health checks for automated failover.';

  const aData = await apiPost('/interview/answer', { session_id: sid, answer: ANSWER });
  console.log('Score:', aData.score, '| Verdict:', aData.short_verdict?.slice(0, 60));

  const endData = await apiPost('/interview/end', { session_id: sid });
  const summary = endData.summary;
  console.log('Summary overall_score:', summary?.overall_score);

  // ── Puppeteer ─────────────────────────────────────────────────────────────
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  page.on('dialog', async d => { await d.accept(); });

  // ── Load app, inject session into localStorage, go to /interview ──────────
  await page.goto(UI, { waitUntil: 'networkidle2' });
  await page.evaluate((s) => {
    localStorage.setItem('intervai_active_session', JSON.stringify({
      session_id: s.session_id, provider: s.provider,
      domain: s.domain, difficulty: s.difficulty,
    }));
  }, session);

  await page.goto(`${UI}/interview`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  // Inject messages into React state via a custom event (or just screenshot the empty state)
  // Instead: override window.confirm so End Interview goes through without blocking
  await page.evaluate(() => { window.confirm = () => true; });

  // ── Generate question ─────────────────────────────────────────────────────
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button'))
      if (/generate question/i.test(btn.textContent)) { btn.click(); return; }
  });
  await sleep(9000);

  await page.screenshot({ path: path.join(OUT, '03_interview_question.png') });
  console.log('saved 03_interview_question.png');

  // ── Type + send answer ────────────────────────────────────────────────────
  const ta = await page.$('textarea');
  if (ta) {
    await ta.click();
    await ta.type(ANSWER.slice(0, 200), { delay: 4 });
  }
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, '03b_interview_answer_typed.png') });
  console.log('saved 03b_interview_answer_typed.png');

  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button'))
      if (btn.textContent.trim() === 'Send') { btn.click(); return; }
  });
  await sleep(11000);

  await page.screenshot({ path: path.join(OUT, '04_interview_feedback.png') });
  console.log('saved 04_interview_feedback.png');

  // ── End interview (confirm already overridden) ────────────────────────────
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button'))
      if (/end interview/i.test(btn.textContent)) { btn.click(); return; }
  });

  // Wait for /summary
  await page.waitForFunction(() => window.location.pathname.includes('summary'), { timeout: 25000 })
    .catch(() => console.log('timeout waiting for /summary, url:', page.url()));
  await sleep(3000);
  console.log('URL:', page.url());

  await page.screenshot({ path: path.join(OUT, '05_summary.png') });
  console.log('saved 05_summary.png');

  // ── Dashboard ─────────────────────────────────────────────────────────────
  await page.evaluate((s, sm) => {
    const hist = [{
      id: Date.now().toString(), at: Date.now(),
      subject: s.domain, provider: s.provider,
      score: Math.round(sm.overall_score * 10),
      summary: sm, messages: [],
    }];
    localStorage.setItem('intervai_history', JSON.stringify(hist));
  }, session, summary);
  await page.goto(`${UI}/dashboard`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, '06_dashboard.png') });
  console.log('saved 06_dashboard.png');

  await browser.close();
  console.log('Done.');
})();
