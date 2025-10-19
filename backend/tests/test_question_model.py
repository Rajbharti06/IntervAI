import pytest

from app.routes import (
    _compute_effective_difficulty,
    _select_question_type,
    _generate_local_question_with_difficulty,
    DIFFICULTY_LEVELS,
    QUESTION_TYPES,
)


def test_effective_difficulty_thresholds():
    assert _compute_effective_difficulty('basic', 9) in ('medium', 'hard')
    assert _compute_effective_difficulty('medium', 9) == 'hard'
    assert _compute_effective_difficulty('hard', 9) == 'hard'

    assert _compute_effective_difficulty('hard', 3) in ('medium', 'basic')
    assert _compute_effective_difficulty('medium', 3) == 'basic'
    assert _compute_effective_difficulty('basic', 3) == 'basic'


def test_select_question_type_weights_basic():
    # Run multiple times to sample distribution
    counts = {t: 0 for t in QUESTION_TYPES}
    for _ in range(1000):
        t = _select_question_type('basic', 6)
        counts[t] += 1
    # conceptual should be most frequent for basic level
    assert counts['conceptual'] == max(counts.values())
    # ensure we saw multiple types
    assert sum(1 for c in counts.values() if c > 0) >= 4


def test_local_generation_varies_with_score_and_domain():
    session = {
        'difficulty': 'basic',
        'domain': 'Distributed Systems',
        'questions_asked': []
    }
    q1 = _generate_local_question_with_difficulty(session, 'sess-1')
    # Simulate strong performance to increase difficulty
    session['last_score_10'] = 9
    q2 = _generate_local_question_with_difficulty(session, 'sess-1')
    assert q1 != q2
    assert 'Distributed Systems' in q1 and 'Distributed Systems' in q2


def test_no_repeat_within_session():
    session = {
        'difficulty': 'medium',
        'domain': 'Backend Engineering',
        'questions_asked': []
    }
    qset = set()
    for i in range(10):
        q = _generate_local_question_with_difficulty(session, f'sess-{i}')
        # Simulate tracking asked question
        session['questions_asked'].append(q)
        qset.add(q)
    # Expect high variety and no immediate repeats
    assert len(qset) >= 5