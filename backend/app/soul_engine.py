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

def build_question_prompt(
    profile: dict,
    question_number: int,
    last_score: int | None = None,
    user_memory: dict | None = None,
    last_answer_word_count: int | None = None,
    company_track: dict | None = None,
    pressure_level: str = "none",
) -> str:
    """Build a sharp, personality-driven prompt that generates the next adaptive question."""
    skill = profile.get("skill_level", "unknown")
    difficulty = profile.get("current_difficulty", "basic")
    domain = profile.get("domain", "General")
    topics = profile.get("topics", [domain])
    doc_ctx = profile.get("document_context", "")
    weaknesses = profile.get("weakness_areas", [])
    strengths = profile.get("strength_areas", [])
    confidence = profile.get("confidence", 5)

    # ── Emotional intelligence: detect hesitation or rambling ────────────────
    emotional_note = ""
    if last_answer_word_count is not None:
        if last_answer_word_count < 15:
            emotional_note = (
                "\nEMOTIONAL CUE — the candidate's last answer was very short (possibly nervous or stuck). "
                "Open your next question with a brief, warm acknowledgment: "
                "'Take your time — let's break this down step by step.' or "
                "'No worries — walk me through your initial thinking.' "
                "Then ask a simpler, more focused question."
            )
        elif last_answer_word_count > 280 and last_score is not None and last_score < 6:
            emotional_note = (
                "\nEMOTIONAL CUE — the candidate rambled (long answer, low score). "
                "Gently redirect: acknowledge the effort, then ask them to be more concise. "
                "Tone: 'I can see you're thinking through it — let's focus on the core concept.' "
                "Ask a narrower, more structured question this time."
            )

    # ── Personality shift based on last answer quality ────────────────────────
    if last_score is not None and last_score >= 8:
        reaction = (
            "The candidate just gave an excellent answer. Acknowledge it in one short phrase, "
            "then immediately raise the stakes — push into edge cases, failure modes, or a harder variant. "
            "Tone: 'Good. Now let's push this — what happens when…' or 'Solid. One more layer —'"
        )
    elif last_score is not None and last_score >= 6:
        reaction = (
            "Decent answer but gaps remain. Move forward without dwelling. "
            "Ask something that probes the specific weak spot. Be direct, not harsh."
        )
    elif last_score is not None and last_score < 6:
        reaction = (
            "The candidate struggled. Shift to a foundational question — rebuild their confidence. "
            "Be patient and empathetic. Tone: 'Let me approach this differently — start with the basics.'"
        )
    else:
        reaction = "Opening question. Set a professional but approachable tone."

    # ── Pressure mode ─────────────────────────────────────────────────────────
    pressure_note = ""
    if pressure_level == "high":
        pressure_note = (
            "\nPRESSURE MODE: HIGH — simulate a tough interviewer. Ask follow-up immediately "
            "after the question. Add time urgency: 'You have 60 seconds — go.' "
            "Be demanding but fair. Don't soften the question."
        )
    elif pressure_level == "moderate":
        pressure_note = (
            "\nPRESSURE MODE: MODERATE — keep a brisk pace. Don't wait long. "
            "Occasionally add a constraint: 'Answer in under 3 sentences.' or 'No Googling — what do you know right now?'"
        )

    # ── Company track personality ─────────────────────────────────────────────
    company_note = ""
    if company_track:
        style = company_track.get("style", "")
        name = company_track.get("name", "")
        focus = ", ".join(company_track.get("focus", [])[:4])
        company_note = (
            f"\nCOMPANY MODE — {name}: {style} "
            f"Focus areas: {focus}. "
            f"Shape your question to match how {name} actually interviews. "
            f"{'For Amazon: every question should subtly connect to a Leadership Principle.' if name == 'Amazon' else ''}"
            f"{'For Google: always probe time/space complexity and scalability.' if name == 'Google' else ''}"
            f"{'For Startup track: value speed, practicality, and full-stack ownership over theoretical perfection.' if 'Startup' in name else ''}"
        )

    doc_section = ""
    if doc_ctx.strip():
        snippet = doc_ctx[:1500].strip()
        doc_section = f"\nCandidate's reference material (use for context, do not quote verbatim):\n{snippet}\n"

    memory_section = ""
    if user_memory:
        past_weak = user_memory.get("weak_topics", [])
        past_strong = user_memory.get("strong_topics", [])
        sessions = user_memory.get("sessions_completed", 0)
        if past_weak and question_number <= 2:
            memory_section = (
                f"\nCROSS-SESSION MEMORY: This candidate has done {sessions} session(s) before. "
                f"They previously struggled with: {', '.join(past_weak[:3])}. "
                f"Consider revisiting one of these early to track improvement. "
                f"You can reference this naturally: 'Last time we touched on X — let's see where you are now.'"
            )
        elif past_strong:
            memory_section = (
                f"\nThey are historically strong in: {', '.join(past_strong[:3])}. Push harder in these areas."
            )

    weakness_hint = f"\nCurrent weak spots: {', '.join(weaknesses)}." if weaknesses else ""
    strength_hint = f"\nCurrent strengths: {', '.join(strengths)}. Probe deeper." if strengths else ""

    return f"""You are a sharp, experienced technical interviewer — think senior engineer at a top company.
You have a direct but fair personality. You don't pad questions with filler. You adapt to the candidate in real time.

Candidate snapshot:
- Domain: {domain}
- Topics: {', '.join(topics)}
- Skill level: {skill} | Difficulty: {difficulty}
- Question #{question_number} | Last score: {last_score if last_score is not None else 'N/A'}/10
{weakness_hint}{strength_hint}{memory_section}{doc_section}
Interviewer behavior for THIS question:
{reaction}{emotional_note}{pressure_note}{company_note}

Generate exactly ONE interview question. Rules:
1. Match {difficulty} difficulty for {domain}.
2. Sound like a real person talking — natural, direct, no textbook language.
3. Vary types: conceptual → practical → scenario → edge case (don't repeat same type twice in a row).
4. Output ONLY the question text. No preamble, no labels, no explanation.
"""


def build_evaluation_prompt(question: str, answer: str, profile: dict, company_track: dict | None = None) -> str:
    """Build a sharp, personality-driven evaluation prompt."""
    skill = profile.get("skill_level", "unknown")
    domain = profile.get("domain", "General")
    confidence = profile.get("confidence", 5)
    scores = profile.get("scores", [])
    last_few = scores[-3:] if scores else []

    # Determine evaluator personality based on running performance
    if last_few and (sum(last_few) / len(last_few)) >= 8:
        evaluator_mode = (
            "The candidate is performing well. Be demanding in your feedback — "
            "acknowledge what's correct briefly, then immediately point out what's still missing or could be deeper. "
            "Your short_verdict should feel like: 'Good start, but you missed X.' or 'Correct — now what about edge case Y?' "
            "Never be effusive or over-praise."
        )
    elif last_few and (sum(last_few) / len(last_few)) <= 4:
        evaluator_mode = (
            "The candidate is struggling. Be calm, direct, and constructive — not harsh. "
            "Clearly identify the gap without making them feel stupid. "
            "Your short_verdict should feel like: 'That's not quite right — the key issue is...' "
            "Focus feedback on one fixable thing, not a list of failures."
        )
    else:
        evaluator_mode = (
            "Balanced performance so far. Give honest, specific feedback. "
            "Acknowledge what's right, explain what's missing. "
            "Your short_verdict should feel like a real interviewer's note: precise, not generic."
        )

    word_count = len(answer.split())
    length_note = ""
    if word_count < 20:
        length_note = "Note: Answer is very short — brevity without substance must score lower. Check if it shows real understanding."
    elif word_count > 300:
        length_note = "Note: Answer is long. Reward depth if it's substantive; penalize padding and circular reasoning."

    company_eval_note = ""
    if company_track:
        name = company_track.get("name", "")
        if name == "Amazon":
            company_eval_note = (
                "\nAMAZON EVALUATION: Check if the answer implicitly or explicitly reflects a Leadership Principle "
                "(e.g., Ownership, Bias for Action, Customer Obsession). If absent, note it in improvement_tip."
            )
        elif name == "Google":
            company_eval_note = (
                "\nGOOGLE EVALUATION: Penalize answers that skip time/space complexity analysis. "
                "Reward clean reasoning, scalability thinking, and clarity of solution."
            )
        elif "Startup" in name:
            company_eval_note = (
                "\nSTARTUP EVALUATION: Value practical, shipping-minded answers. "
                "Don't penalize for skipping theoretical depth — reward speed of thinking and ownership mindset."
            )
        elif "Consulting" in name or "Behavioral" in name:
            company_eval_note = (
                "\nCONSULTING/BEHAVIORAL EVALUATION: Score heavily on STAR structure. "
                "Penalize vague or generic answers. Reward concrete metrics and clear narrative."
            )

    return f"""You are a senior technical interviewer with high standards and a direct personality.
You give honest, specific evaluations — not generic praise or boilerplate criticism.

Domain: {domain} | Skill level: {skill} | Confidence: {confidence}/10

Question asked: {question}

Candidate's answer: {answer}

{length_note}{company_eval_note}

Evaluator mode: {evaluator_mode}

Respond in this EXACT JSON structure (nothing outside the JSON):
{{
  "score": <integer 0-10>,
  "is_correct": <true or false>,
  "short_verdict": "<1 sentence in interviewer voice — specific to THIS answer, never generic>",
  "detailed_feedback": "<2-3 sentences: what was right, what was missing, what the ideal answer hits — specific, no filler>",
  "correct_answer_hint": "<key points of the ideal answer — bullet-point style if multiple>",
  "improvement_tip": "<one specific thing to practice — not 'study more', give exact topic/exercise>",
  "topic_tag": "<precise sub-topic tested, e.g. 'Time Complexity', 'CAP Theorem', 'System Design - Caching'>"
}}

Scoring:
- 0-3: Missing the core concept entirely
- 4-6: Partial — correct direction but missing depth, examples, or key points
- 7-8: Good — covers the main points with minor gaps
- 9-10: Excellent — comprehensive, specific, shows real depth
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
