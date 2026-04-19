"""
Soul Engine — the adaptive brain of IntervAI.

Responsibilities:
- Maintain a per-session user profile (skills, weaknesses, confidence).
- Choose the next best question strategy based on performance history.
- Generate personalized growth plans after the interview ends.
- Build AI prompts that feel like a real, empathetic human mentor.
"""

from __future__ import annotations
import json
import re
from typing import Any

# ─── User Profile ────────────────────────────────────────────────────────────

def default_profile(domain: str, topics: list[str] | None = None) -> dict:
    return {
        "domain": domain,
        "topics": topics or [domain],
        "skill_level": "unknown",   # unknown → beginner / intermediate / advanced
        "confidence": 5,            # 1-10
        "scores": [],               # list of ints (0-10) per question
        "weakness_areas": [],       # topics where score < 5
        "strength_areas": [],       # topics where score >= 8
        "question_count": 0,
        "document_context": "",     # extracted text from uploaded files
        "topic_scores": {},         # {"Python": [7,4,9], "DSA": [3,6]}
        "current_difficulty": "basic",
        "consecutive_correct": 0,
        "consecutive_wrong": 0,
    }

def update_profile(profile: dict, score_10: int, topic: str | None = None) -> dict:
    """Update profile after each answered question."""
    profile["scores"].append(score_10)
    profile["question_count"] += 1

    t = topic or profile["domain"]
    profile["topic_scores"].setdefault(t, []).append(score_10)

    # Track streaks
    if score_10 >= 7:
        profile["consecutive_correct"] += 1
        profile["consecutive_wrong"] = 0
    elif score_10 <= 4:
        profile["consecutive_wrong"] += 1
        profile["consecutive_correct"] = 0
    else:
        profile["consecutive_correct"] = 0
        profile["consecutive_wrong"] = 0

    # Update difficulty
    profile["current_difficulty"] = _next_difficulty(profile)

    # Update skill level estimate
    if len(profile["scores"]) >= 3:
        avg = sum(profile["scores"][-5:]) / min(5, len(profile["scores"]))
        if avg >= 8:
            profile["skill_level"] = "advanced"
        elif avg >= 5.5:
            profile["skill_level"] = "intermediate"
        else:
            profile["skill_level"] = "beginner"

    # Rebuild weakness / strength areas
    profile["weakness_areas"] = [
        t for t, s in profile["topic_scores"].items()
        if len(s) >= 2 and (sum(s) / len(s)) < 5
    ]
    profile["strength_areas"] = [
        t for t, s in profile["topic_scores"].items()
        if len(s) >= 2 and (sum(s) / len(s)) >= 7.5
    ]

    # Update confidence (rolling average of last 3)
    recent = profile["scores"][-3:]
    profile["confidence"] = round(sum(recent) / len(recent), 1)

    return profile


def _next_difficulty(profile: dict) -> str:
    cur = profile["current_difficulty"]
    levels = ("basic", "medium", "hard")
    idx = levels.index(cur) if cur in levels else 0

    # Promote after 3 consecutive correct, demote after 3 wrong
    if profile["consecutive_correct"] >= 3 and idx < 2:
        return levels[idx + 1]
    if profile["consecutive_wrong"] >= 2 and idx > 0:
        return levels[idx - 1]
    return cur


# ─── Prompt Builders ──────────────────────────────────────────────────────────

def build_question_prompt(profile: dict, question_number: int, last_score: int | None = None) -> str:
    """Build a mentor-style prompt that generates the next adaptive question."""
    skill = profile.get("skill_level", "unknown")
    difficulty = profile.get("current_difficulty", "basic")
    domain = profile.get("domain", "General")
    topics = profile.get("topics", [domain])
    doc_ctx = profile.get("document_context", "")
    weaknesses = profile.get("weakness_areas", [])
    strengths = profile.get("strength_areas", [])
    confidence = profile.get("confidence", 5)

    tone_instruction = _tone_for_confidence(confidence)

    doc_section = ""
    if doc_ctx.strip():
        snippet = doc_ctx[:1500].strip()
        doc_section = f"""
The candidate has provided the following reference material. Use it to craft relevant,
context-specific questions (do NOT reveal or quote the document verbatim):
---DOCUMENT---
{snippet}
---END DOCUMENT---
"""

    weakness_hint = ""
    if weaknesses:
        weakness_hint = f"The candidate is struggling with: {', '.join(weaknesses)}. Probe these gently."

    strength_hint = ""
    if strengths and len(strengths) > 0:
        strength_hint = f"They are strong in: {', '.join(strengths)}. Push deeper on these."

    return f"""You are a world-class, empathetic interview mentor. Your job is to help the candidate grow,
not to trip them up. You adapt to their level and make them feel respected.

Current candidate profile:
- Domain: {domain}
- Topics to cover: {', '.join(topics)}
- Skill level: {skill}
- Difficulty level for this question: {difficulty}
- Question number: {question_number}
- Last score: {last_score if last_score is not None else "N/A"} / 10
- Confidence score: {confidence} / 10
{weakness_hint}
{strength_hint}
{doc_section}

Tone instruction: {tone_instruction}

Generate exactly ONE interview question. Rules:
1. It must match the {difficulty} difficulty and the {domain} domain.
2. If the candidate is weak, ask a foundational clarifying question — do NOT embarrass them.
3. If they are strong, challenge them with edge cases, trade-offs, or design scenarios.
4. Vary question types across the interview: conceptual, practical, scenario-based, behavioral.
5. Make it sound natural, like a real interviewer would ask — NOT a textbook.
6. Do NOT add any explanation or answer. Output ONLY the question text.
"""


def build_evaluation_prompt(question: str, answer: str, profile: dict) -> str:
    """Build a prompt that evaluates the answer like a real, kind mentor."""
    skill = profile.get("skill_level", "unknown")
    domain = profile.get("domain", "General")
    confidence = profile.get("confidence", 5)

    tone = _tone_for_confidence(confidence)

    return f"""You are a senior interviewer and mentor evaluating a candidate's answer.
Be direct, specific, and kind — like a mentor who wants them to succeed.

Domain: {domain}
Candidate skill level: {skill}
Confidence level: {confidence}/10

Question: {question}
Candidate's answer: {answer}

{tone}

Respond in this EXACT JSON structure (do not add anything outside the JSON):
{{
  "score": <integer 0-10>,
  "is_correct": <true or false>,
  "short_verdict": "<one sentence: what they got right or wrong>",
  "detailed_feedback": "<2-4 sentences of constructive feedback, polite and encouraging>",
  "correct_answer_hint": "<the key points of the ideal answer — concise, not a lecture>",
  "improvement_tip": "<one specific, actionable thing they should practice next>",
  "topic_tag": "<the specific sub-topic this question tested, e.g. 'Binary Search', 'REST design', 'Leadership'>"
}}

Important:
- Score 0-3 = wrong / very incomplete
- Score 4-6 = partially correct with gaps
- Score 7-8 = good with minor misses
- Score 9-10 = excellent, comprehensive
- Always be encouraging and specific. Never say "wrong" bluntly — instead explain the gap.
- If the answer is in a non-English language, evaluate it fairly and note the language.
"""


def build_growth_plan_prompt(profile: dict, qa_history: list[dict]) -> str:
    """Build a prompt that generates a personalized post-interview growth plan."""
    domain = profile.get("domain", "General")
    topics = profile.get("topics", [domain])
    skill = profile.get("skill_level", "beginner")
    weaknesses = profile.get("weakness_areas", [])
    strengths = profile.get("strength_areas", [])
    scores = profile.get("scores", [])
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0

    history_text = "\n".join([
        f"Q{i+1}: {qa.get('question','')[:80]}... → Score: {qa.get('score',0)}/10"
        for i, qa in enumerate(qa_history[:10])
    ])

    return f"""You are an expert career coach generating a personalized interview improvement plan.

Candidate Profile:
- Domain: {domain}
- Topics covered: {', '.join(topics)}
- Overall skill level: {skill}
- Average score this session: {avg_score}/10
- Weak areas: {', '.join(weaknesses) if weaknesses else 'None identified yet'}
- Strong areas: {', '.join(strengths) if strengths else 'None identified yet'}

Interview history (summary):
{history_text}

Generate a practical, motivating, personalized 7-day growth plan. Format as JSON:
{{
  "overall_assessment": "<2-3 sentence honest but encouraging summary of performance>",
  "top_strengths": ["<strength 1>", "<strength 2>"],
  "top_gaps": ["<gap 1>", "<gap 2>", "<gap 3>"],
  "daily_plan": [
    {{
      "day": 1,
      "focus": "<topic>",
      "tasks": ["<task 1>", "<task 2>"],
      "time_minutes": <number>
    }}
  ],
  "recommended_resources": [
    {{"title": "<resource name>", "type": "book|course|practice|video", "reason": "<why this helps>"}}
  ],
  "motivational_message": "<one powerful, personal sentence to keep them going>"
}}

Make the plan realistic (1-2 hours/day max), specific to their weak areas, and progressively harder.
Day 1 should be the weakest area. Day 7 should be a full mock interview challenge.
"""


def parse_evaluation_json(raw: str) -> dict:
    """Safely parse the AI's JSON evaluation response."""
    try:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass
    return {
        "score": 5,
        "is_correct": True,
        "short_verdict": "Could not parse evaluation.",
        "detailed_feedback": raw[:500] if raw else "No feedback available.",
        "correct_answer_hint": "",
        "improvement_tip": "Review the topic and try again.",
        "topic_tag": "General"
    }


def parse_growth_plan_json(raw: str) -> dict:
    """Safely parse the AI's JSON growth plan response (handles markdown fences)."""
    # Strip markdown code fences
    cleaned = (raw or '').strip()
    if cleaned.startswith('```'):
        cleaned = re.sub(r'^```[a-z]*\n?', '', cleaned)
        cleaned = re.sub(r'\n?```$', '', cleaned).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    try:
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass
    return {
        "overall_assessment": raw[:300] if raw else "Review your performance and keep practicing.",
        "top_strengths": [],
        "top_gaps": [],
        "daily_plan": [],
        "recommended_resources": [],
        "motivational_message": "Every expert was once a beginner. Keep going!"
    }


def _tone_for_confidence(confidence: float) -> str:
    if confidence <= 3:
        return ("The candidate seems to be struggling. Be extra gentle, patient, and encouraging. "
                "If they give a partial answer, guide them with hints rather than harsh critique.")
    if confidence <= 6:
        return ("The candidate is at a moderate level. Be balanced — acknowledge what they got right, "
                "then explain what's missing clearly and kindly.")
    return ("The candidate is performing well. You can be more demanding — push for depth, "
            "edge cases, and trade-offs. Still be respectful and precise.")
