# IntervAI — Devpost Submission

## Elevator Pitch
IntervAI is an AI-powered mock interview platform that adapts to your performance, asks diverse question types, and gives actionable feedback. It supports multiple AI providers and includes an offline/demo mode so anyone can practice instantly.

## Inspiration
Preparing for interviews is stressful and time-consuming. We wanted a tool that feels like a real partner: tailored questions, adaptive difficulty, and constructive feedback, without requiring expensive API keys or complicated setup.

## What It Does
- Guides you through realistic interview sessions across domains (tech, business, design, etc.).
- Adapts difficulty based on your previous answers and scores.
- Mixes question types (conceptual, practical, scenario, coding, behavioral) to simulate real interviews.
- Provides quick scoring and feedback, plus optional follow-ups that target weak areas.
- Offers per-question timers and optional stress mode (audio cues) to simulate pressure.
- Works in offline/demo mode using a rich local question bank (no external APIs needed).

## How We Built It
- Frontend: React + Vite + Tailwind for fast, modern UI.
- Backend: FastAPI + Uvicorn serving `/interview/*` endpoints.
- Provider support: OpenAI, Anthropic, Google (Gemini), Perplexity, Groq, Together AI.
- Offline/demo mode: Select any provider and set `api_key = demo` to use local questions.
- Adaptive engine: Tracks last score and adjusts difficulty and question type distribution.

## Challenges We Ran Into
- Provider key validation vs. user flexibility: we added robust inference and safe fallbacks.
- Handling API failures cleanly: implemented local question generation and error masking.
- Ensuring frontend-backend alignment: unified config and clear error messages to reduce user confusion.

## Accomplishments We’re Proud Of
- A polished, resilient interview flow with adaptive difficulty.
- A helpful offline/demo mode enabling instant practice.
- Clean UI, better icons, and thoughtful UX details (badges, timers, follow-ups).

## What We Learned
- Small UX touches (like badges and stress-mode beeps) make practice feel realistic.
- Clear configuration and helpful error messages significantly reduce setup friction.
- Building robust fallbacks is essential when relying on third-party APIs.

## What’s Next
- Rich analytics dashboard with topic-level strengths and areas to improve.
- More domains, deeper question banks, and coding execution sandboxes.
- Multi-turn conversations with context memory and richer rubric-based evaluation.
- One-click cloud deploy and shareable session summaries.

## Built With
- FastAPI, Uvicorn, Python
- React, Vite, Tailwind
- Requests, Axios
- Docker, Docker Compose

## Try It Locally
- Backend:
  - `cd IntervAI/backend`
  - `./venv311/Scripts/python -m pip install -r requirements.txt`
  - `./venv311/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- Frontend:
  - `cd IntervAI/frontend`
  - `npm install`
  - `npm run dev`
- Open `http://localhost:5173/`. On the Setup page, set `api_key = demo` to start immediately.

## Demo Links
- Video: add link here
- Screenshots: add links (or embed) here

## Repo
- GitHub/Source: add link here