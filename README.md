# 🎤 IntervAI — Practice the Interview. Become the Candidate.

> **Old-school preparation, new-school intelligence.**
> IntervAI is an AI-powered mock interview platform that doesn't just ask questions — it *thinks with you*, adapts to you, and pushes you one level higher every round.

---

## 📸 Screenshots

### Setup — Pick your provider, domain & difficulty

![Setup](screenshots/01_setup.png)

### Interview — AI Presence Zone + full-width layout

![Interview Ready](screenshots/02_interview_empty.png)

### Interview — Question from NVIDIA Llama 3.3 70B

![Interview Question](screenshots/03_interview_question.png)

### Interview — Feedback with score, tip, and sidebar stats

![Interview Feedback](screenshots/04_interview_feedback.png)

### Analysis Summary — XP, badges, communication stats, 7-day growth plan

![Summary](screenshots/05_summary.png)

### Dashboard — Score history and performance trend

![Dashboard](screenshots/06_dashboard.png)

---

## 🧭 What is IntervAI?

**IntervAI** is a **realistic mock interview simulator** designed to feel like a tough-but-fair human interviewer.

Not flashy. Not gimmicky. Just sharp questions, honest feedback, and pressure that makes you better.

Think of IntervAI as:

* 🧠 a **practice room** before the real room
* 🎯 a **coach** that adjusts difficulty as you grow
* ⏱️ a **stress trainer** when you want realism
* 📊 a **mirror** that shows where you truly stand

Built for engineers, students, and serious candidates.

---

## ✨ Feature Set (Phase 1 + Phase 2)

### Core Interview Engine
* 📈 **Adaptive soul engine** — tracks confidence, topic depth, and adjusts difficulty round-by-round
* 🧩 **Diverse question types**: Conceptual · Practical · Scenario-based · Coding · Behavioral · Case Study
* 🔁 **Smart follow-ups** triggered when score < 7 — drills weak spots automatically
* 🧮 **Answer evaluation** with score 0–10, short verdict, improvement tip, and topic tag
* 📄 **Document upload** — attach your PDF/DOCX resume or study notes, AI generates questions from it

### Voice System
* 🎙️ **Real Whisper STT** (OpenAI · Groq) — speak your answers, get text transcription
* 🔊 **OpenAI TTS** — AI reads questions aloud with a natural voice (`nova`)
* 🌐 **Browser speech fallback** — works on every provider, no API keys needed for TTS
* 🔇 **Voice toggle** in header — mute/unmute in one click

### Anti-Cheat System
* 🔍 **Tab-switch detection** — flags every time you leave the interview window
* 📋 **Copy/paste monitoring** — detects suspicious large pastes
* 🖱️ **Right-click blocked** — prevents "inspect element" shortcuts
* 🚦 **Risk level indicator** — yellow/orange/red badge in header showing violation count

### Interview UI
* 🖥️ **Full-width immersive layout** — 95% viewport, up to 1400px, minimal chrome
* 🤖 **AI Presence Zone** — pulsing avatar with live status: *Composing question / Speaking / Evaluating*
* 📷 **Camera preview** — 180px tall, `object-cover` for clean framing
* ⏱️ **Per-question countdown timer** with optional **stress mode** (audio beeps last 10s)
* 📱 **Responsive** — single-column below 900px, 2-column (1fr + 320px sidebar) above

### Gamification
* 🏆 **XP system** — earn XP per answer, bonus for STAR answers and zero filler words
* 🥇 **Achievement badges** — "First Step", "Streak", and more
* 📊 **Communication stats** — filler word rate, confidence score, clarity score, avg word count
* 🌱 **Growth plan** — personalized improvement roadmap generated at interview end

### Session & History
* 💾 **Dashboard history** — every completed interview is saved to localStorage
* 📈 **Score trends** — track improvement across sessions
* 🔄 **Session restore** — resume an in-progress interview on page reload

---

## 🔌 AI Providers Supported

| Provider | Questions | Whisper STT | Premium TTS |
|----------|-----------|-------------|-------------|
| **OpenAI** | ✅ | ✅ | ✅ `tts-1` |
| **NVIDIA NIM** | ✅ | — | — (browser TTS) |
| **Anthropic** | ✅ | — | — (browser TTS) |
| **Google Gemini** | ✅ | — | — (browser TTS) |
| **Groq** | ✅ | ✅ | — (browser TTS) |
| **Together AI** | ✅ | — | — (browser TTS) |
| **Perplexity** | ✅ | — | — (browser TTS) |
| **Demo / Offline** | ✅ local bank | — | — (browser TTS) |

> **NVIDIA NIM** — uses `meta/llama-3.3-70b-instruct` via `https://integrate.api.nvidia.com/v1`. Fully compatible with the OpenAI SDK.

### Demo / Offline Mode

No API keys? No problem. Set `api_key = demo` on the Setup page — IntervAI falls back to the built-in question bank automatically.

---

## 🏗️ Architecture

```
IntervAI/
├── frontend/          React + Vite + Tailwind
│   └── src/
│       ├── pages/     Interview.jsx · Setup.jsx · Summary.jsx · Dashboard.jsx
│       ├── components/ MessageBubble · MicButton · GamificationBar · StarMethodHelper
│       └── hooks/     useVoice.js · useAntiCheat.js
└── backend/           FastAPI + Uvicorn
    └── app/
        ├── routes.py       all /interview/* endpoints (~1400 lines)
        ├── soul_engine.py  adaptive question/evaluation prompt builder
        └── llm_client.py   unified LLM abstraction (streaming + non-streaming)
```

### Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/interview/start` | Start session (provider, domain, difficulty, api_key) |
| POST | `/interview/question` | Get next question (non-streaming) |
| GET | `/interview/question/stream` | Get next question (SSE streaming) |
| POST | `/interview/answer` | Submit answer — returns score, feedback, analysis |
| GET | `/interview/answer/stream` | Submit answer (SSE streaming) |
| POST | `/interview/followup` | Request follow-up question |
| POST | `/interview/end` | End session — returns full summary + gamification |
| POST | `/interview/transcribe` | Whisper STT (OpenAI or Groq) |
| GET | `/interview/speak` | OpenAI TTS — returns audio/mpeg stream |
| POST | `/interview/upload_document` | Upload PDF/DOCX/TXT for question generation |
| POST | `/interview/growth_plan` | Generate personalized improvement plan |
| GET | `/tracks` | Available company interview tracks |

---

## ⚡ Quick Start

### Option A: Docker

```bash
docker-compose up --build
# Frontend: http://localhost:5173
# Backend:  http://localhost:8000
# API docs: http://localhost:8000/docs
```

### Option B: Local Dev

**Requirements**: Node.js ≥ 18, Python ≥ 3.11

```bash
# Backend
cd IntervAI/backend
./venv311/Scripts/python -m pip install -r requirements.txt
./venv311/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (new terminal)
cd IntervAI/frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## 🎯 Recommended Usage

1. **Pick a real provider** (NVIDIA NIM is free to start — grab a key at `build.nvidia.com`)
2. **Choose your domain** — Software Engineering, System Design, Behavioral, etc.
3. **Set difficulty** to `medium` — the soul engine will adapt up/down from there
4. **Enable camera** for a real interview feel
5. **Enable voice** — hear questions read aloud, answer by mic or keyboard
6. **After 3–5 questions**, end and review the Summary page — it shows exactly what to improve
7. **Keep your sessions** — Dashboard tracks score trends across all interviews

---

## 🧪 Troubleshooting

| Issue | Fix |
|-------|-----|
| `ERR_CONNECTION_REFUSED` | Backend must run on `http://localhost:8000` |
| Whisper STT fails | Falls back to browser speech automatically |
| NVIDIA 401 | Check your `nvapi-...` key is valid |
| Port conflict | `5173` or `8000` already in use — Vite will auto-try `5174` |
| CORS error | CORS is open for all origins in dev — restart backend |

---

## 🛣️ Roadmap

- [x] Phase 1: Full interview engine, soul engine, streaming, gamification, stress mode
- [x] Phase 2: Voice I/O (Whisper + TTS), anti-cheat, session history, universal MicButton
- [ ] Phase 3: AI Avatar (animated D-ID or NVIDIA ACE face)
- [ ] Phase 4: Face detection (multiple faces), eye tracking, attention scoring
- [ ] Phase 5: Enterprise — ATS integration, multi-tenant, team analytics

---

## 🤍 Who This Is For

* Students preparing for placements
* Engineers grinding system design
* Candidates tired of vague prep advice
* Anyone who wants **honest interview practice**

---

## 📜 License

MIT — add your preferred license.

---

> Practice here — perform out there.
