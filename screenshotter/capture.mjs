import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const API = 'http://localhost:8000';
const UI  = 'http://localhost:5174';

async function startSession() {
  const fd = new FormData();
  fd.append('domain', 'Software Engineering');
  fd.append('provider', 'nvidia');
  fd.append('api_key', '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');
  fd.append('track_id', 'google');
  fd.append('difficulty', 'medium');
  const r = await fetch(`${API}/interview/start`, { method: 'POST', body: fd });
  return r.json();
}

async function getQuestion(sessionId) {
  const fd = new FormData();
  fd.append('session_id', sessionId);
  const r = await fetch(`${API}/interview/question`, { method: 'POST', body: fd });
  return r.json();
}

async function sendAnswer(sessionId, answer) {
  const fd = new FormData();
  fd.append('session_id', sessionId);
  fd.append('answer', answer);
  const r = await fetch(`${API}/interview/answer`, { method: 'POST', body: fd });
  return r.json();
}

async function endInterview(sessionId) {
  const fd = new FormData();
  fd.append('session_id', sessionId);
  const r = await fetch(`${API}/interview/end`, { method: 'POST', body: fd });
  return r.json();
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });
  const page = await browser.newPage();

  // ── Screenshot 1: Landing / Setup page ──────────────────────────────────────
  console.log('Capturing Setup page...');
  await page.goto(UI, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, '01_setup.png'), fullPage: false });
  console.log('  → 01_setup.png saved');

  // ── Prepare session via API ──────────────────────────────────────────────────
  console.log('Starting NVIDIA session...');
  const session = await startSession();
  console.log('  session_id:', session.session_id);

  const qData = await getQuestion(session.session_id);
  console.log('  question:', qData.question?.slice(0, 60) + '...');

  // ── Inject session into browser localStorage and navigate to /interview ─────
  await page.goto(UI, { waitUntil: 'networkidle2' });
  await page.evaluate((s) => {
    localStorage.setItem('intervai_active_session', JSON.stringify({
      session_id: s.session_id,
      provider: s.provider,
      domain: s.domain,
      difficulty: s.difficulty,
    }));
  }, session);

  await page.goto(`${UI}/interview`, { waitUntil: 'networkidle2' });
  await sleep(2000);

  // ── Screenshot 2: Interview page — empty state ───────────────────────────────
  console.log('Capturing Interview page (empty)...');
  await page.screenshot({ path: path.join(OUT, '02_interview_empty.png') });
  console.log('  → 02_interview_empty.png saved');

  // ── Inject the question message and answer via DOM manipulation ──────────────
  // Navigate to summary directly using the API data
  const answerText = 'For handling sudden traffic surges I would use horizontal auto-scaling with a load balancer, stateless app tier with Redis sessions, read replicas for the database, and Redis plus CDN for caching. For CAP theorem, I favor AP over strict consistency for feeds while using strong consistency for transactions. Circuit breakers prevent cascade failures.';

  const answerData = await sendAnswer(session.session_id, answerText);
  console.log('  answer score:', answerData.score);

  const summaryData = await endInterview(session.session_id);
  console.log('  overall_score:', summaryData.summary?.overall_score);

  // ── Inject messages into the interview page for a screenshot ─────────────────
  await page.evaluate((s, q, a, ad) => {
    const msgs = [
      { id: 1, type: 'question', content: q, timestamp: new Date().toISOString() },
      { id: 2, type: 'answer', content: a, timestamp: new Date().toISOString() },
      { id: 3, type: 'feedback', content: ad.feedback || 'Great answer!', score: ad.score,
        short_verdict: ad.short_verdict, improvement_tip: ad.improvement_tip, topic_tag: ad.topic_tag,
        timestamp: new Date().toISOString() }
    ];
    localStorage.setItem('intervai_active_session', JSON.stringify({
      session_id: s.session_id, provider: s.provider, domain: s.domain, difficulty: s.difficulty,
    }));
    localStorage.setItem('intervai_interview_preview_msgs', JSON.stringify(msgs));
  }, session, qData.question, answerText, answerData);

  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2500);

  // ── Screenshot 3: Interview page with messages ───────────────────────────────
  console.log('Capturing Interview page with messages...');
  await page.screenshot({ path: path.join(OUT, '03_interview_active.png') });
  console.log('  → 03_interview_active.png saved');

  // ── Screenshot 4: Summary page ───────────────────────────────────────────────
  console.log('Navigating to Summary page...');
  await page.evaluate((s, sm) => {
    window.__summaryState = {
      session_id: s.session_id,
      stats: { questionsAsked: 1, averageScore: sm.overall_score, totalTime: 180000, startTime: Date.now() - 180000 },
      messages: [],
      summary: sm,
      domain: s.domain,
      growth_plan: null,
    };
  }, session, summaryData.summary);

  await page.goto(`${UI}/summary`, { waitUntil: 'networkidle2' });

  // Inject state via React router navigation if needed
  await page.evaluate((s, sm) => {
    history.replaceState({
      session_id: s.session_id,
      stats: { questionsAsked: 1, averageScore: sm.overall_score, totalTime: 180000, startTime: Date.now() - 180000 },
      messages: [],
      summary: sm,
      domain: s.domain,
      growth_plan: null,
    }, '', '/summary');
  }, session, summaryData.summary);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2500);

  await page.screenshot({ path: path.join(OUT, '04_summary.png') });
  console.log('  → 04_summary.png saved');

  // ── Screenshot 5: Dashboard ───────────────────────────────────────────────────
  console.log('Navigating to Dashboard...');
  await page.evaluate((s, sm) => {
    const hist = [{
      id: Date.now().toString(), at: Date.now(),
      subject: s.domain, provider: s.provider,
      score: Math.round(sm.overall_score * 10),
      summary: sm, messages: [],
    }];
    localStorage.setItem('intervai_history', JSON.stringify(hist));
  }, session, summaryData.summary);

  await page.goto(`${UI}/dashboard`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: path.join(OUT, '05_dashboard.png') });
  console.log('  → 05_dashboard.png saved');

  await browser.close();
  console.log('\nAll screenshots saved to ./screenshots/');
})();
