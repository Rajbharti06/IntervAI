"""
Gamification Engine — streaks, XP, levels, badges.

Inspired by Duolingo (streaks, XP, levels) and InterviewBit (leaderboard, achievements).
All state is per-session in memory; the frontend persists to localStorage for cross-session.
"""

from __future__ import annotations

LEVELS = [
    {"name": "Rookie",      "min_xp": 0,    "icon": "🌱"},
    {"name": "Learner",     "min_xp": 100,  "icon": "📚"},
    {"name": "Practitioner","min_xp": 300,  "icon": "⚡"},
    {"name": "Skilled",     "min_xp": 600,  "icon": "🎯"},
    {"name": "Advanced",    "min_xp": 1000, "icon": "🔥"},
    {"name": "Expert",      "min_xp": 1500, "icon": "💎"},
    {"name": "Master",      "min_xp": 2200, "icon": "👑"},
    {"name": "Elite",       "min_xp": 3000, "icon": "🚀"},
]

BADGES = {
    "first_answer":     {"name": "First Step",      "icon": "👣", "desc": "Answered your first question"},
    "perfect_10":       {"name": "Perfect!",        "icon": "💯", "desc": "Got a score of 10/10"},
    "five_correct":     {"name": "On Fire",         "icon": "🔥", "desc": "5 correct answers in a row"},
    "star_master":      {"name": "STAR Master",     "icon": "⭐", "desc": "Used STAR method perfectly"},
    "no_fillers":       {"name": "Crystal Clear",  "icon": "💎", "desc": "Answer with zero filler words"},
    "comeback":         {"name": "Comeback Kid",    "icon": "💪", "desc": "Scored 8+ after scoring below 4"},
    "speed_demon":      {"name": "Quick Thinker",   "icon": "⚡", "desc": "Answered in under 30 seconds"},
    "deep_diver":       {"name": "Deep Diver",      "icon": "🤿", "desc": "Answer with 200+ words"},
    "consistent":       {"name": "Consistent",      "icon": "📈", "desc": "5 answers all scored 7+"},
    "doc_uploader":     {"name": "Prepared",        "icon": "📄", "desc": "Uploaded a study document"},
    "session_complete":  {"name": "Finisher",        "icon": "🏁", "desc": "Completed a full interview session"},
    "ten_questions":    {"name": "Endurance",       "icon": "🏋️", "desc": "Answered 10 questions in one session"},
}


def score_to_xp(score_10: int, bonus_factors: dict | None = None) -> int:
    """Convert a 0-10 score to XP with bonuses."""
    base = max(0, score_10) * 10
    bonus = 0
    if bonus_factors:
        if bonus_factors.get("no_fillers"):
            bonus += 15
        if bonus_factors.get("star_answer"):
            bonus += 20
        if bonus_factors.get("perfect"):
            bonus += 30
        if bonus_factors.get("streak_3"):
            bonus += 25
        if bonus_factors.get("streak_5"):
            bonus += 50
    return base + bonus


def get_level(total_xp: int) -> dict:
    level = LEVELS[0]
    for lvl in LEVELS:
        if total_xp >= lvl["min_xp"]:
            level = lvl
    return level


def get_next_level(total_xp: int) -> dict | None:
    for i, lvl in enumerate(LEVELS):
        if total_xp < lvl["min_xp"]:
            return lvl
    return None


def compute_session_badges(
    scores: list[int],
    analysis_list: list[dict],
    question_count: int,
    doc_uploaded: bool = False,
    time_taken_list: list[int] | None = None,
) -> list[str]:
    """Return list of badge keys earned this session."""
    earned = set()

    if question_count >= 1:
        earned.add("first_answer")

    if any(s == 10 for s in scores):
        earned.add("perfect_10")

    # 5 correct in a row (score >= 7)
    streak = 0
    for s in scores:
        if s >= 7:
            streak += 1
            if streak >= 5:
                earned.add("five_correct")
                break
        else:
            streak = 0

    # Consistent: all last 5 scored >= 7
    if len(scores) >= 5 and all(s >= 7 for s in scores[-5:]):
        earned.add("consistent")

    # Comeback
    for i in range(1, len(scores)):
        if scores[i - 1] <= 4 and scores[i] >= 8:
            earned.add("comeback")
            break

    # STAR master
    for a in analysis_list:
        if a.get("is_star_answer") and (a.get("star_score", 0) >= 4):
            earned.add("star_master")
            break

    # No fillers
    for a in analysis_list:
        if a.get("filler_word_count", 1) == 0 and a.get("word_count", 0) >= 30:
            earned.add("no_fillers")
            break

    # Speed demon
    if time_taken_list:
        for t in time_taken_list:
            if 0 < t <= 30:
                earned.add("speed_demon")
                break

    # Deep diver
    for a in analysis_list:
        if a.get("word_count", 0) >= 200:
            earned.add("deep_diver")
            break

    # Doc uploaded
    if doc_uploaded:
        earned.add("doc_uploader")

    # Completed session
    if question_count >= 3:
        earned.add("session_complete")

    # Endurance
    if question_count >= 10:
        earned.add("ten_questions")

    return list(earned)


def build_session_summary(
    session: dict,
    analysis_list: list[dict],
) -> dict:
    """Build the full gamification summary for the end-of-session report."""
    scores = session.get("scores_10", [])
    qa_count = len(session.get("qa_pairs", []))
    doc_uploaded = bool(session.get("soul_profile", {}).get("document_context", ""))

    total_xp = sum(
        score_to_xp(
            s,
            {
                "no_fillers": (analysis_list[i].get("filler_word_count", 1) == 0) if i < len(analysis_list) else False,
                "star_answer": analysis_list[i].get("is_star_answer", False) if i < len(analysis_list) else False,
                "perfect": s == 10,
                "streak_3": i >= 2 and all(scores[max(0, i - 2):i + 1][j] >= 7 for j in range(min(3, i + 1))),
            }
        )
        for i, s in enumerate(scores)
    )

    badges = compute_session_badges(scores, analysis_list, qa_count, doc_uploaded)

    avg_score = round(sum(scores) / max(len(scores), 1), 1) if scores else 0
    level = get_level(total_xp)
    next_level = get_next_level(total_xp)

    return {
        "total_xp": total_xp,
        "level": level,
        "next_level": next_level,
        "badges_earned": [
            {**BADGES[b], "key": b}
            for b in badges
            if b in BADGES
        ],
        "average_score": avg_score,
        "questions_answered": qa_count,
        "xp_to_next": (next_level["min_xp"] - total_xp) if next_level else 0,
    }
