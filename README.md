# IntervAI

An AI-powered mock interview platform with adaptive difficulty, offline/demo mode, and rich feedback. Frontend is React (Vite), backend is FastAPI. Supports multiple AI providers (OpenAI, Anthropic, Google, Perplexity, Groq, Together AI) and falls back to a local question bank when running demo mode.

## Highlights
- Adaptive difficulty: foundational → intermediate → advanced based on performance.
- Diverse question types: conceptual, practical, scenario, coding, behavioral.
- Follow-ups and scoring: evaluates answers and optionally asks tailored follow-ups.
- Per-question timer with optional stress mode (audio cues).
- Offline/demo mode: no external APIs or keys required; uses local questions.
- Resilient API: graceful fallbacks and helpful error messages.

## Architecture
- Frontend: React + Vite + Tailwind (`IntervAI/frontend`).
- Backend: FastAPI + Uvicorn (`IntervAI/backend`).
- Router: `app/main.py` registers `app/routes.py` and exposes `/interview/*` endpoints.
- Local question bank and dynamic selection logic in `backend/app/routes.py`.

## Quick Start
### Option A: Docker Compose
- Requirements: Docker and Docker Compose.
- From repo root:
  - `docker-compose up --build`
  - Frontend: `http://localhost:5173/`
  - Backend: `http://localhost:8000/` and docs at `/docs`

### Option B: Local Dev
- Requirements: Node.js ≥ 18, Python ≥ 3.11.
- Backend:
  - `cd IntervAI/backend`
  - `./venv311/Scripts/python -m pip install -r requirements.txt`
  - `./venv311/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Frontend:
  - `cd IntervAI/frontend`
  - `npm install`
  - `npm run dev`
  - Open `http://localhost:5173/`

## Configuration
- Frontend API base: `IntervAI/frontend/src/config.js`
  - Uses `import.meta.env.VITE_API_BASE_URL` if set, else defaults to `http://localhost:8000`.
- To override, create `.env` in `IntervAI/frontend`:
  - `VITE_API_BASE_URL=http://localhost:8000`
- Demo/Offline Mode:
  - On the Setup page, enter `api_key` = `demo` (or `test`).
  - Backend detects demo keys and uses the local question bank.

## API Endpoints (POST)
- `/interview/start` — Form: `provider`, `api_key`, `domain`, `model?`, `difficulty`.
- `/interview/question` — Form: `session_id`.
- `/interview/answer` — Form: `session_id`, `answer`.
- `/interview/followup` — Form: `session_id`.
- `/interview/end` — Form: `session_id`.
- `/interview/transcribe` — Form: `file`, `session_id`.
- `/interview/restore` — Form: `session_id` (restore session state).

## Usage Tips
- Start in demo mode to explore features without provider API keys.
- Set a reasonable per-question time (e.g., 120s) and optionally enable stress mode.
- Difficulty and per-question limit are shown in the interview header badges.

## Troubleshooting
- Connection refused (`ERR_CONNECTION_REFUSED`):
  - Ensure backend is running: `http://localhost:8000/` must load.
  - Confirm `VITE_API_BASE_URL` points to the correct host/port.
- CORS: Enabled for all origins in backend (`app/main.py`).
- Provider mismatch: If using non-demo keys, ensure the provider selection matches the key type.
- Port conflicts: Make sure ports `5173` (frontend) and `8000` (backend) are free.

## Tests
- Backend tests in `IntervAI/backend/tests` for question diversity and models.

## License
- Add your preferred license here.

## Acknowledgements
- Built with FastAPI, React, Vite, Tailwind, and love for better interviews.
