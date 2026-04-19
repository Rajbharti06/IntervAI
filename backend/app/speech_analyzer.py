"""
Speech & Text Analyzer — what Yoodli charges $10/month for, built in.

Analyzes written/transcribed answers for:
- Filler words (um, uh, like, basically, you know...)
- Words per minute estimate
- STAR method detection (Situation, Task, Action, Result)
- Answer structure quality
- Confidence language indicators
- Sentence clarity score
- Answer length appropriateness
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field

FILLER_WORDS = {
    "um", "uh", "uhh", "umm", "er", "err", "ah", "ahh",
    "like", "basically", "literally", "actually", "honestly",
    "you know", "you know what i mean", "i mean", "i guess",
    "kind of", "sort of", "kinda", "sorta",
    "right", "okay", "ok", "so", "well",
    "just", "very", "really", "quite", "totally",
    "obviously", "clearly", "essentially", "fundamentally",
    "at the end of the day", "to be honest", "to be fair",
    "the thing is", "the fact is", "tbh", "idk", "idk tbh",
}

WEAK_LANGUAGE = {
    "i think", "i believe", "i feel like", "i suppose",
    "maybe", "perhaps", "possibly", "probably", "might",
    "could be", "not sure", "not certain", "i'm not sure",
    "i'm not certain", "i don't know exactly",
}

STRONG_LANGUAGE = {
    "specifically", "for example", "for instance", "in practice",
    "the key insight", "the core idea", "in my experience",
    "this means", "this ensures", "this guarantees",
    "the trade-off is", "the advantage is", "the disadvantage is",
    "compared to", "as opposed to", "unlike",
}

STAR_KEYWORDS = {
    "situation": ["situation", "context", "background", "scenario", "when", "working at", "at my", "in my previous"],
    "task": ["task", "responsible for", "my job was", "needed to", "had to", "was asked to", "my role", "challenge was"],
    "action": ["action", "i did", "i implemented", "i built", "i created", "i designed", "i led", "i developed",
               "i decided", "i approached", "i used", "i applied", "i worked"],
    "result": ["result", "outcome", "impact", "achieved", "increased", "decreased", "reduced", "improved",
               "saved", "resulted in", "led to", "this caused", "as a result", "ultimately", "in the end",
               "metrics", "percent", "%", "users", "revenue", "performance"],
}


@dataclass
class AnswerAnalysis:
    word_count: int = 0
    filler_words_found: list[str] = field(default_factory=list)
    filler_word_count: int = 0
    filler_rate: float = 0.0          # percentage of words that are fillers
    weak_language_found: list[str] = field(default_factory=list)
    strong_language_found: list[str] = field(default_factory=list)
    star_components: dict = field(default_factory=dict)    # {"situation": True, "task": False, ...}
    star_score: int = 0                # 0-4 how many STAR components found
    is_star_answer: bool = False
    structure_score: int = 0           # 0-10
    confidence_score: int = 0          # 0-10
    clarity_score: int = 0             # 0-10
    overall_communication_score: int = 0  # 0-10
    estimated_wpm: int = 0
    answer_length_verdict: str = ""    # "too short" | "good" | "too long"
    tips: list[str] = field(default_factory=list)


def analyze(text: str, question_type: str = "general", time_taken_sec: int = 0) -> AnswerAnalysis:
    """Full analysis of a text answer."""
    if not text or not text.strip():
        return AnswerAnalysis(tips=["Your answer was empty. Please provide a response."])

    result = AnswerAnalysis()
    lower = text.lower()
    words = _tokenize(lower)
    result.word_count = len(words)

    # Words per minute
    if time_taken_sec > 10:
        result.estimated_wpm = round((result.word_count / time_taken_sec) * 60)

    # Answer length verdict
    if result.word_count < 30:
        result.answer_length_verdict = "too short"
    elif result.word_count > 500:
        result.answer_length_verdict = "too long"
    else:
        result.answer_length_verdict = "good"

    # Filler word detection
    filler_hits: list[str] = []
    for filler in FILLER_WORDS:
        pattern = r'\b' + re.escape(filler) + r'\b'
        matches = re.findall(pattern, lower)
        filler_hits.extend(matches)
    result.filler_words_found = sorted(set(filler_hits))
    result.filler_word_count = len(filler_hits)
    result.filler_rate = round((result.filler_word_count / max(result.word_count, 1)) * 100, 1)

    # Weak language
    weak = []
    for phrase in WEAK_LANGUAGE:
        if phrase in lower:
            weak.append(phrase)
    result.weak_language_found = weak

    # Strong language
    strong = []
    for phrase in STRONG_LANGUAGE:
        if phrase in lower:
            strong.append(phrase)
    result.strong_language_found = strong

    # STAR detection
    star = {}
    for component, keywords in STAR_KEYWORDS.items():
        found = any(kw in lower for kw in keywords)
        star[component] = found
    result.star_components = star
    result.star_score = sum(1 for v in star.values() if v)
    result.is_star_answer = result.star_score >= 3

    # Structure score (0-10)
    s = 5
    if result.word_count >= 50:
        s += 1
    if result.word_count >= 100:
        s += 1
    if result.strong_language_found:
        s += min(2, len(result.strong_language_found))
    if result.filler_rate > 10:
        s -= 2
    elif result.filler_rate > 5:
        s -= 1
    if result.answer_length_verdict == "too short":
        s -= 2
    result.structure_score = max(0, min(10, s))

    # Confidence score (0-10)
    c = 7
    c -= min(3, len(result.weak_language_found))
    c += min(2, len(result.strong_language_found))
    if result.filler_rate > 15:
        c -= 2
    elif result.filler_rate > 8:
        c -= 1
    result.confidence_score = max(0, min(10, c))

    # Clarity score (0-10)
    sentences = re.split(r'[.!?]+', text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]
    avg_sentence_len = result.word_count / max(len(sentences), 1)
    cl = 7
    if 10 <= avg_sentence_len <= 25:
        cl += 1
    elif avg_sentence_len > 40:
        cl -= 2
    elif avg_sentence_len < 5:
        cl -= 1
    if result.filler_rate > 10:
        cl -= 2
    result.clarity_score = max(0, min(10, cl))

    # Overall communication score
    result.overall_communication_score = round(
        (result.structure_score * 0.4 + result.confidence_score * 0.35 + result.clarity_score * 0.25)
    )

    # Generate tips
    tips = []
    if result.answer_length_verdict == "too short":
        tips.append("Your answer is quite short. Aim for at least 3-4 sentences with a concrete example.")
    if result.answer_length_verdict == "too long":
        tips.append("Your answer is quite long. Practice being concise — aim for 1-2 minutes when speaking.")
    if result.filler_rate > 8:
        top_fillers = result.filler_words_found[:3]
        tips.append(f"High filler word usage ({result.filler_rate}%). Common ones: {', '.join(top_fillers)}. Practice pausing instead of saying these.")
    if result.weak_language_found:
        tips.append(f"Replace weak phrases like '{result.weak_language_found[0]}' with confident statements. Own your answers.")
    if not result.strong_language_found:
        tips.append("Add specific examples, metrics, or trade-off comparisons to strengthen your answer.")
    if question_type == "behavioral" and result.star_score < 3:
        missing = [k for k, v in result.star_components.items() if not v]
        tips.append(f"For behavioral questions, use the STAR method. Missing components: {', '.join(missing).upper()}.")
    if result.confidence_score < 5:
        tips.append("Use more confident language. Instead of 'I think', say 'In my experience' or 'The key point is'.")

    result.tips = tips[:4]  # max 4 tips per answer
    return result


def _tokenize(text: str) -> list[str]:
    return re.findall(r'\b[a-z]+\b', text.lower())


def to_dict(a: AnswerAnalysis) -> dict:
    return {
        "word_count": a.word_count,
        "filler_words": a.filler_words_found,
        "filler_word_count": a.filler_word_count,
        "filler_rate_pct": a.filler_rate,
        "weak_language": a.weak_language_found,
        "strong_language": a.strong_language_found,
        "star_components": a.star_components,
        "star_score": a.star_score,
        "is_star_answer": a.is_star_answer,
        "structure_score": a.structure_score,
        "confidence_score": a.confidence_score,
        "clarity_score": a.clarity_score,
        "overall_communication_score": a.overall_communication_score,
        "estimated_wpm": a.estimated_wpm,
        "answer_length_verdict": a.answer_length_verdict,
        "tips": a.tips,
    }
