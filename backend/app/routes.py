from fastapi import FastAPI, Form, HTTPException, APIRouter, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
import uuid
import re
import json
import random

app = FastAPI()

# Enable CORS for this sub-app (mounted in main)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()

# In-memory store for active interview sessions
# In a real application, this would be a database or a more robust session management system
active_sessions = {}

# Define API configurations for different providers
API_CONFIGS = {
    "openai": {
        "api_key": None,
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-3.5-turbo",
    },
    "anthropic": {
        "api_key": None,
        "base_url": "https://api.anthropic.com/v1",
        "default_model": "claude-3-opus-20240229",
    },
    "google": {
        "api_key": None,
        "base_url": "https://generativelanguage.googleapis.com/v1beta",
        "default_model": "gemini-pro",
    },
    "perplexity": {
        "api_key": None,
        "base_url": "https://api.perplexity.ai",
        # Use a current, officially supported Sonar model name
        "default_model": "sonar-pro",
    },
    "grok": {
        "api_key": None,
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "grok-4",
    },
    "together_ai": {
        "api_key": None,
        "base_url": "https://api.together.xyz/v1",
        "default_model": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    },
}


def get_default_model(provider: str) -> str:
    return API_CONFIGS.get(provider, {}).get("default_model", API_CONFIGS["openai"]["default_model"])  # fallback to openai default

def extract_error_message(response_data):
    try:
        err = response_data.get("error")
        if isinstance(err, dict):
            return err.get("message") or err.get("code") or str(err)
        if isinstance(err, str):
            return err
    except Exception:
        pass
    # Some providers return errors differently
    try:
        return response_data.get("message") or response_data.get("detail") or str(response_data)
    except Exception:
        return "Unknown error"

def infer_provider_from_key(api_key: str) -> str:
    if not api_key:
        return "unknown"
    # Allow offline/demo keys to bypass provider mismatch checks
    low = api_key.lower()
    if low in {"demo", "test"} or low.startswith("sk-test") or low.startswith("demo-"):
        return "unknown"
    if api_key.startswith("sk-"):
        return "openai"
    if api_key.startswith("pplx-"):
        return "perplexity"
    if api_key.startswith("gsk_"):
        return "grok"
    # For other keys, return unknown to avoid validation errors
    return "unknown"

def mask_secret(text: str) -> str:
    if not text:
        return text
    try:
        text = text.replace("sk-", "sk-***")
        text = text.replace("pplx-", "pplx-***")
        text = re.sub(r"([A-Za-z0-9]{10,})", lambda m: m.group(0)[:3] + "***" + m.group(0)[-3:], text)
        return text
    except Exception:
        return text

def _is_offline_demo(session: dict) -> bool:
    try:
        key = session.get("api_key", "")
        if not key:
            return False
        return key.lower() in {"demo", "test"} or key.startswith("sk-test") or key.startswith("demo-")
    except Exception:
        return False

# Local fallback question generator to ensure resilience when upstream APIs fail
def _generate_local_question(session: dict, session_id: str) -> str:
    domain = session.get('domain') or 'your field'
    samples = [
        f"In {domain}, explain the concept of polymorphism and provide a concise example.",
        f"What are common trade-offs when designing scalable systems related to {domain}?",
        f"Describe a challenging problem in {domain} you've solved and the approach taken.",
        f"How would you optimize performance for a typical workload in {domain}?",
        f"What are the key security considerations when working in {domain}?"
    ]
    try:
        idx = abs(hash(session_id)) % len(samples)
    except Exception:
        idx = 0
    return samples[idx]

@router.post("/interview/start")
def start_interview(provider: str = Form(...), api_key: str = Form(...), domain: str = Form(...), model: str | None = Form(None)):
    if not api_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    if provider not in API_CONFIGS:
        raise HTTPException(status_code=400, detail=f"Invalid API provider: {provider}")

    inferred = infer_provider_from_key(api_key)
    print(f"DEBUG: api_key='{api_key}', provider='{provider}', inferred='{inferred}'")
    if inferred != "unknown" and inferred != provider:
        raise HTTPException(status_code=400, detail=f"The provided API key appears to be for '{inferred}', but provider '{provider}' was selected. Please select the correct provider or use a matching key.")
    
    session_id = str(uuid.uuid4())

    # Decide model: user-provided or provider default
    chosen_model = (model or '').strip() or get_default_model(provider)
    
    active_sessions[session_id] = {
        "provider": provider,
        "api_key": api_key,  # Store the API key in the session
        "domain": domain,
        "model": chosen_model,
        "questions_asked": [],
        "answers_given": [],
        "feedback_received": [],
        "qa_pairs": [],
        "weak_areas": {}
    }
    return {"message": "Interview session started", "session_id": session_id, "provider": provider, "domain": domain, "model": chosen_model}

@router.post("/interview/question")
def get_interview_question(session_id: str = Form(...)):
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Offline/demo mode: return a locally generated question without calling external APIs
    if _is_offline_demo(session):
        domain = session.get('domain') or 'your field'
        # Very small pool of generic questions
        samples = [
            f"In {domain}, explain the concept of polymorphism and provide a concise example.",
            f"What are common trade-offs when designing scalable systems related to {domain}?",
            f"Describe a challenging problem in {domain} you've solved and the approach taken.",
            f"How would you optimize performance for a typical workload in {domain}?"
        ]
        q = samples[hash(session_id) % len(samples)]
        session.setdefault('questions_asked', []).append(q)
        # track last question for naive evaluation
        session['current_question'] = q
        return {"question": q}

    provider = session['provider']
    config = API_CONFIGS.get(provider)
    # If config is missing, gracefully fallback instead of erroring
    if not config:
        question = _generate_local_question(session, session_id)
        session.setdefault('questions_asked', []).append(question)
        session['current_question'] = question
        return {"question": question}

    model = session.get('model') or get_default_model(provider)

    # Branch per provider
    question = None
    try:
        if provider in {"openai", "perplexity", "grok", "together_ai"}:
            api_url = config["base_url"] + "/chat/completions"
            headers = {"Authorization": f"Bearer {session['api_key']}", "Content-Type": "application/json"}
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": f"Ask me one advanced interview question about {session['domain']}."}]
            }
            res = requests.post(api_url, headers=headers, json=payload, timeout=30)
            try:
                response_data = res.json()
            except Exception:
                response_data = {"message": res.text}
            if not res.ok or 'choices' not in response_data or not response_data['choices']:
                error_msg = mask_secret(extract_error_message(response_data))
                print(f"{provider} API Error (question): {error_msg}")
                question = _generate_local_question(session, session_id)
            else:
                question = response_data['choices'][0]['message']['content']
        elif provider == "anthropic":
            api_url = config["base_url"] + "/messages"
            headers = {
                "x-api-key": session['api_key'],
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            }
            payload = {
                "model": model,
                "max_tokens": 256,
                "messages": [
                    {"role": "user", "content": f"Ask me one advanced interview question about {session['domain']}"}
                ]
            }
            res = requests.post(api_url, headers=headers, json=payload, timeout=30)
            try:
                response_data = res.json()
            except Exception:
                response_data = {"message": res.text}
            if not res.ok or 'content' not in response_data or not response_data['content']:
                error_msg = mask_secret(extract_error_message(response_data))
                print(f"{provider} API Error (question): {error_msg}")
                question = _generate_local_question(session, session_id)
            else:
                parts = response_data['content']
                question = "".join([p.get('text', '') for p in parts if isinstance(p, dict)]) or str(parts)
        elif provider == "google":
            # Google Generative Language (Gemini)
            api_url = config["base_url"] + f"/models/{model}:generateContent"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [
                    {"parts": [{"text": f"Ask me one advanced interview question about {session['domain']}"}]}
                ]
            }
            res = requests.post(api_url, headers=headers, params={"key": session['api_key']}, json=payload, timeout=30)
            try:
                response_data = res.json()
            except Exception:
                response_data = {"message": res.text}
            # Extract first candidate text
            try:
                candidates = response_data.get('candidates') or []
                content = (candidates[0] or {}).get('content') or {}
                parts = content.get('parts') or []
                question = (parts[0] or {}).get('text') or ''
            except Exception:
                question = ''
            if not res.ok or not question:
                error_msg = mask_secret(extract_error_message(response_data))
                print(f"{provider} API Error (question): {error_msg}")
                question = _generate_local_question(session, session_id)
        else:
            # Unsupported provider - fallback instead of erroring
            question = _generate_local_question(session, session_id)
    except requests.exceptions.RequestException as e:
        print(f"Upstream request failed (question): {str(e)}")
        question = _generate_local_question(session, session_id)

    # Final guard to always produce a question
    if not question:
        question = _generate_local_question(session, session_id)

    session.setdefault('questions_asked', []).append(question)
    session['current_question'] = question
    return {"question": question}


@router.post("/interview/answer")
def submit_interview_answer(session_id: str = Form(...), answer: str = Form(...)):
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Offline/demo mode: naive local evaluation without external API calls
    if _is_offline_demo(session):
        user_answer = (answer or "").strip()
        question = session.get('current_question') or 'the previous question'
        # Very naive scoring heuristic with invalid short-answer handling
        length = len(user_answer.split())
        is_invalid = length < 3
        if is_invalid:
            score = 0
            verdict = "Incorrect"
        else:
            base = 50
            bonus = min(50, max(0, length - 10) * 3)  # reward >10 words up to ~50 pts
            score = min(100, base + bonus // 2)
            verdict = "Correct" if score >= 75 else ("Partially Correct" if score >= 55 else "Incorrect")
        feedback_lines = []
        if is_invalid:
            feedback_lines.append("Your answer seems too short or incomplete. Please provide more detail and address the question directly.")
        feedback_lines += [
            "Good structure and clarity." if score >= 75 else "Decent attempt—add more detail and examples.",
            "Consider emphasizing trade-offs." if score >= 55 else "Address key concepts explicitly.",
            "Provide real-world examples to strengthen your answer."
        ]
        feedback = " ".join(feedback_lines)
        domain = (session.get('domain') or 'your field')
        correct_answer = (
            f"A strong answer to the question \"{question}\" would typically cover: a clear definition, key concepts, trade-offs, "
            f"a concise real-world example, and best practices related to {domain}."
        )
        session.setdefault('qa_pairs', []).append({
            'question': question,
            'user_answer': user_answer,
            'score': score,
            'verdict': verdict,
            'feedback': feedback,
            'correct_answer': correct_answer
        })
        session.setdefault('answers_given', []).append(user_answer)
        session.setdefault('feedback_received', []).append(feedback)
        # Track weak areas in a very naive way
        weak_map = session.setdefault('weak_areas', {})
        topic = (session.get('domain') or 'General').strip() or 'General'
        if score < 75:
            weak_map.setdefault(topic, [])
            weak_map[topic].append({
                'question': question,
                'improvement_tips': 'Study core concepts; practice with real examples; focus on clarity and completeness.'
            })
        return {
            'score': score,
            'verdict': verdict,
            'feedback': feedback,
            'correct_answer': correct_answer
        }

    provider = session['provider']
    config = API_CONFIGS.get(provider)
    if not config:
        raise HTTPException(status_code=500, detail="API configuration not found for this provider")

    model = session.get('model') or get_default_model(provider)

    try:
        if provider in {"openai", "perplexity", "grok", "together_ai"}:
            api_url = config["base_url"] + "/chat/completions"
            headers = {"Authorization": f"Bearer {session['api_key']}", "Content-Type": "application/json"}
            prompt_user = (
                f"Question: {session.get('current_question', 'Unknown')}\n"
                f"Answer: {answer}\n"
                "Return JSON with fields: score (number), verdict (string), feedback (string), correct_answer (string). "
                "If the answer is empty, too short, or off-topic, set score to 0 and provide a concise, authoritative model answer in correct_answer."
            )
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are an expert interviewer. Score answers 0-100, provide concise feedback and a clear verdict (Correct/Partially Correct/Incorrect)."},
                    {"role": "user", "content": prompt_user}
                ]
            }
            # Only request structured JSON for OpenAI; other OpenAI-compatible providers may reject response_format
            if provider == "openai":
                payload["response_format"] = {"type": "json_object"}

            res = requests.post(api_url, headers=headers, json=payload, timeout=45)
            try:
                response_data = res.json()
            except Exception:
                response_data = {"message": res.text}

            if not res.ok:
                error_msg = mask_secret(extract_error_message(response_data))
                # Retry once without response_format if the provider complains about it
                if res.status_code in (400, 422) and "response_format" in (error_msg or "").lower() and "response_format" in payload:
                    try:
                        retry_payload = {
                            "model": model,
                            "messages": payload["messages"]
                        }
                        res_retry = requests.post(api_url, headers=headers, json=retry_payload, timeout=45)
                        try:
                            response_data = res_retry.json()
                        except Exception:
                            response_data = {"message": res_retry.text}
                        if not res_retry.ok:
                            error_msg = mask_secret(extract_error_message(response_data))
                            print(f"{provider} API Error (answer retry): {error_msg}")
                            raise HTTPException(status_code=res_retry.status_code, detail=error_msg or f"Failed to evaluate answer with {provider} API")
                    except requests.exceptions.RequestException as e:
                        print(f"Upstream request failed (answer retry): {str(e)}")
                        raise HTTPException(status_code=502, detail="Upstream provider error during retry")
                else:
                    print(f"{provider} API Error (answer): {error_msg}")
                    raise HTTPException(status_code=res.status_code, detail=error_msg or f"Failed to evaluate answer with {provider} API")

            # Parse successful response_data
            try:
                choice = response_data['choices'][0]['message']
                content = choice.get('content') if isinstance(choice, dict) else None
                data = json.loads(content) if content else {}
                score = int(data.get('score', 0))
                verdict = data.get('verdict', 'Unknown')
                feedback = data.get('feedback', 'No feedback provided.')
                correct_answer = data.get('correct_answer', '')
            except Exception:
                text = response_data.get('choices', [{}])[0].get('message', {}).get('content', '')
                score = 70
                verdict = 'Partially Correct'
                feedback = text.strip()[:400] or 'Could not parse structured feedback.'
                correct_answer = ''
        elif provider == "anthropic":
            api_url = config["base_url"] + "/messages"
            headers = {
                "x-api-key": session['api_key'],
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            }
            prompt = (
                "You are an expert interviewer. Read the question and answer and return ONLY a JSON object with keys: "
                "score (0-100 number), verdict (Correct/Partially Correct/Incorrect), feedback (concise string), correct_answer (string).\n\n"
                f"Question: {session.get('current_question', 'Unknown')}\nAnswer: {answer}\n"
                "If the answer is empty, too short, or off-topic, set score to 0 and provide a concise, authoritative model answer in correct_answer."
            )
            payload = {
                "model": model,
                "max_tokens": 256,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
            res = requests.post(api_url, headers=headers, json=payload, timeout=45)
            try:
                response_data = res.json()
            except Exception:
                response_data = {"message": res.text}
            if not res.ok:
                error_msg = mask_secret(extract_error_message(response_data))
                print(f"{provider} API Error (answer): {error_msg}")
                raise HTTPException(status_code=res.status_code, detail=error_msg or f"Failed to evaluate answer with {provider} API")
            parts = response_data.get('content') or []
            text = "".join([p.get('text', '') for p in parts if isinstance(p, dict)])
            try:
                data = json.loads(text)
                score = int(data.get('score', 0))
                verdict = data.get('verdict', 'Unknown')
                feedback = data.get('feedback', 'No feedback provided.')
                correct_answer = data.get('correct_answer', '')
            except Exception:
                score = 70
                verdict = 'Partially Correct'
                feedback = text.strip()[:400] or 'Could not parse structured feedback.'
                correct_answer = ''
        elif provider == "google":
            api_url = config["base_url"] + f"/models/{model}:generateContent"
            headers = {"Content-Type": "application/json"}
            prompt = (
                "You are an expert interviewer. Read the question and answer and return ONLY a JSON object with keys: "
                "score (0-100 number), verdict (Correct/Partially Correct/Incorrect), feedback (concise string), correct_answer (string).\n\n"
                f"Question: {session.get('current_question', 'Unknown')}\nAnswer: {answer}\n"
                "If the answer is empty, too short, or off-topic, set score to 0 and provide a concise, authoritative model answer in correct_answer."
            )
            payload = {
                "contents": [
                    {"parts": [{"text": prompt}]}
                ]
            }
            res = requests.post(api_url, headers=headers, params={"key": session['api_key']}, json=payload, timeout=45)
            try:
                response_data = res.json()
            except Exception:
                response_data = {"message": res.text}
            if not res.ok:
                error_msg = mask_secret(extract_error_message(response_data))
                print(f"{provider} API Error (answer): {error_msg}")
                raise HTTPException(status_code=res.status_code, detail=error_msg or f"Failed to evaluate answer with {provider} API")
            try:
                candidates = response_data.get('candidates') or []
                content = (candidates[0] or {}).get('content') or {}
                parts = content.get('parts') or []
                text = (parts[0] or {}).get('text') or ''
            except Exception:
                text = ''
            try:
                data = json.loads(text)
                score = int(data.get('score', 0))
                verdict = data.get('verdict', 'Unknown')
                feedback = data.get('feedback', 'No feedback provided.')
                correct_answer = data.get('correct_answer', '')
            except Exception:
                score = 70
                verdict = 'Partially Correct'
                feedback = text.strip()[:400] or 'Could not parse structured feedback.'
                correct_answer = ''
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Upstream request failed: {str(e)}")

    session.setdefault('qa_pairs', []).append({
        'question': session.get('current_question', ''),
        'user_answer': answer,
        'score': score,
        'verdict': verdict,
        'feedback': feedback,
        'correct_answer': correct_answer
    })
    session.setdefault('answers_given', []).append(answer)
    session.setdefault('feedback_received', []).append(feedback)

    return {
        'score': score,
        'verdict': verdict,
        'feedback': feedback,
        'correct_answer': correct_answer
    }

@router.post("/interview/end")
def end_interview(session_id: str = Form(...)):
    session = active_sessions.pop(session_id, None)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or already ended")

    qa_pairs = session.get('qa_pairs', [])
    if not qa_pairs:
        return {"summary": {
            "overall_score": 0,
            "weak_areas": [],
            "qa_pairs": [],
            "subject": session.get('domain', 'Unknown')
        }}

    scores = [p.get('score', 0) for p in qa_pairs]
    overall = sum(scores) / max(len(scores), 1)
    weak_areas = session.get('weak_areas') or {}

    return {"summary": {
        "overall_score": round(overall, 1),
        "weak_areas": weak_areas if weak_areas else [],
        "qa_pairs": qa_pairs,
        "subject": session.get('domain', 'Unknown')
    }}

@router.post("/interview/transcribe")
async def transcribe_audio(file: UploadFile = File(...), session_id: str = Form(...)):
    # Placeholder: real implementation would call a speech-to-text service
    data = await file.read()
    text = f"[Transcribed {len(data)} bytes of audio]"
    return {"text": text}

@router.post("/interview/restore")
def restore_interview(session_id: str = Form(...)):
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    model = session.get('model') or get_default_model(session['provider'])
    # Return minimal metadata for client-side state restore
    return {
        "session_id": session_id,
        "provider": session['provider'],
        "domain": session.get('domain'),
        "model": model
    }
