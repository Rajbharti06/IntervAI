from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import database
from app.utils import resume_parser, audio_utils
from app.routes import active_sessions, API_URLS, get_default_model, mask_secret, extract_error_message
from fastapi.responses import StreamingResponse
import io
import requests
import uuid

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/start_interview")
async def start_interview(domain: str = Form(...), resume: UploadFile = File(...), provider: str = Form(...), api_key: str = Form(...), db: Session = Depends(get_db)):
    if not api_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    if provider not in API_URLS:
        raise HTTPException(status_code=400, detail=f"Invalid API provider: {provider}")

    resume_content = await resume.read()
    resume_text = resume_parser.parse_resume(resume_content)
    
    session = database.InterviewSession(domain=domain, resume_text=resume_text)
    db.add(session)
    db.commit()
    db.refresh(session)

    # Store session details in active_sessions for API interaction
    active_sessions[str(session.id)] = {
        "provider": provider,
        "api_key": api_key,
        "domain": domain,
        "questions_asked": [],
        "answers_given": [],
        "feedback_received": []
    }
    
    return {"session_id": session.id}

@router.post("/generate_question/{session_id}")
def generate_question(session_id: int, db: Session = Depends(get_db)):
    session_db = db.query(database.InterviewSession).filter(database.InterviewSession.id == session_id).first()
    if not session_db:
        raise HTTPException(status_code=404, detail="Session not found in database")

    session_api = active_sessions.get(str(session_id))
    if not session_api:
        raise HTTPException(status_code=404, detail="Session not found in active sessions")

    api_url = API_URLS.get(session_api['provider'])
    if not api_url:
        raise HTTPException(status_code=500, detail="API URL not configured for this provider")

    model = get_default_model(session_api['provider'])
    headers = {"Authorization": f"Bearer {session_api['api_key']}"}
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": f"Ask me one advanced interview question about {session_api['domain']} based on this resume: {session_db.resume_text}"}]
    }
    try:
        res = requests.post(api_url, headers=headers, json=payload, timeout=30)
        try:
            response_data = res.json()
        except Exception:
            response_data = {"message": res.text}
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Upstream request failed: {str(e)}")

    if not res.ok or 'choices' not in response_data or not response_data['choices']:
        error_msg = mask_secret(extract_error_message(response_data))
        print(f"{session_api['provider']} API Error (question): {error_msg}")
        raise HTTPException(status_code=res.status_code, detail=error_msg or f"Failed to get question from {session_api['provider']} API")
    
    question = response_data['choices'][0]['message']['content']
    session_api['questions_asked'].append(question)
    return {"question": question}

@router.post("/evaluate_answer/{session_id}")
async def evaluate_answer(session_id: int, question: str = Form(...), answer_audio: UploadFile = File(...), db: Session = Depends(get_db)):
    session_db = db.query(database.InterviewSession).filter(database.InterviewSession.id == session_id).first()
    if not session_db:
        raise HTTPException(status_code=404, detail="Session not found in database")

    session_api = active_sessions.get(str(session_id))
    if not session_api:
        raise HTTPException(status_code=404, detail="Session not found in active sessions")

    audio_bytes = await answer_audio.read()
    answer_text = audio_utils.transcribe_audio(audio_bytes)

    if answer_text == "Could not understand audio":
        smarter_feedback = "I could not understand your audio. Could you please repeat your answer?"
        feedback_speech = audio_utils.text_to_speech(smarter_feedback)
        return StreamingResponse(io.BytesIO(feedback_speech), media_type="audio/mpeg")
    
    api_url = API_URLS.get(session_api['provider'])
    if not api_url:
        raise HTTPException(status_code=500, detail="API URL not configured for this provider")

    model = get_default_model(session_api['provider'])
    headers = {"Authorization": f"Bearer {session_api['api_key']}"}
    prompt = f"Evaluate this interview answer:\\nQuestion: {question}\\nAnswer: {answer_text}\\nGive detailed feedback and a score out of 100. Format: Feedback: [feedback text] Score: [score number]"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}]
    }
    try:
        res = requests.post(api_url, headers=headers, json=payload, timeout=30)
        try:
            response_data = res.json()
        except Exception:
            response_data = {"message": res.text}
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Upstream request failed: {str(e)}")

    if not res.ok or 'choices' not in response_data or not response_data['choices']:
        error_msg = mask_secret(extract_error_message(response_data))
        print(f"{session_api['provider']} API Error (answer): {error_msg}")
        raise HTTPException(status_code=res.status_code, detail=error_msg or f"Failed to get feedback from {session_api['provider']} API")
    
    evaluation_content = response_data['choices'][0]['message']['content']
    
    feedback_text = "No feedback provided."
    score = 0.0

    # Attempt to parse feedback and score
    feedback_match = re.search(r"Feedback: (.*?)(?=Score:|$)", evaluation_content, re.DOTALL)
    score_match = re.search(r"Score: (\d+\.?\d*)", evaluation_content)

    if feedback_match:
        feedback_text = feedback_match.group(1).strip()
    if score_match:
        score = float(score_match.group(1))

    # Determine feedback type and generate appropriate response
    if score >= 80:
        follow_up_prompt = f"The user's answer to '{question}' was correct. Say 'Good, let's move forward' and ask a new advanced interview question about {session_api['domain']} based on the resume: {session_db.resume_text}."
    elif score >= 50:
        follow_up_prompt = f"The user's answer to '{question}' was partially correct. Give hints and ask a follow-up question to guide them towards the full answer. Also, provide the detailed feedback: {feedback_text}."
    else:
        follow_up_prompt = f"The user's answer to '{question}' was wrong. Explain the right answer clearly and then ask a new advanced interview question about {session_api['domain']} based on the resume: {session_db.resume_text}. Also, provide the detailed feedback: {feedback_text}."

    follow_up_payload = {
        "model": model,
        "messages": [{"role": "user", "content": follow_up_prompt}]
    }
    try:
        follow_up_res = requests.post(api_url, headers=headers, json=follow_up_payload, timeout=30)
        try:
            follow_up_response_data = follow_up_res.json()
        except Exception:
            follow_up_response_data = {"message": follow_up_res.text}
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Upstream request failed for follow-up: {str(e)}")

    if not follow_up_res.ok or 'choices' not in follow_up_response_data or not follow_up_response_data['choices']:
        error_msg = mask_secret(extract_error_message(follow_up_response_data))
        print(f"{session_api['provider']} API Error (follow-up): {error_msg}")
        raise HTTPException(status_code=follow_up_res.status_code, detail=error_msg or f"Failed to get follow-up from {session_api['provider']} API")

    smarter_feedback = follow_up_response_data['choices'][0]['message']['content']

    qa_pair = database.QAPair(session_id=session_id, question=question, answer=answer_text, feedback=smarter_feedback, score=score)
    db.add(qa_pair)
    db.commit()
    
    feedback_speech = audio_utils.text_to_speech(smarter_feedback)
    
    session_api['answers_given'].append(answer_text)
    session_api['feedback_received'].append(smarter_feedback)

    return StreamingResponse(io.BytesIO(feedback_speech), media_type="audio/mpeg")

@router.get("/end_interview/{session_id}")
def end_interview(session_id: int, db: Session = Depends(get_db)):
    session_db = db.query(database.InterviewSession).filter(database.InterviewSession.id == session_id).first()
    if not session_db:
        raise HTTPException(status_code=404, detail="Session not found in database")

    session_api = active_sessions.pop(str(session_id), None) # Remove from active sessions
    if not session_api:
        raise HTTPException(status_code=404, detail="Session not found in active sessions")

    # Calculate overall score and weak areas
    total_score = sum([qa.score for qa in session_db.qa_pairs])
    average_score = total_score / len(session_db.qa_pairs) if session_db.qa_pairs else 0

    weak_areas = {}
    for qa in session_db.qa_pairs:
        if qa.score < 60:  # Threshold for weak area
            if session_api['domain'] not in weak_areas:
                weak_areas[session_api['domain']] = []
            weak_areas[session_api['domain']].append({"question": qa.question, "score": qa.score, "correct_answer": qa.correct_answer, "improvement_tips": qa.improvement_tips})

    return {
        "session_id": session_id,
        "qa_pairs": [{
            "question": qa.question,
            "user_answer": qa.user_answer,
            "score": qa.score,
            "feedback": qa.feedback,
            "correct_answer": qa.correct_answer,
            "improvement_tips": qa.improvement_tips
        } for qa in session_db.qa_pairs],
        "summary": {
            "subject": session_api['domain'],
            "overall_score": average_score,
            "weak_areas": weak_areas,
        }
    }