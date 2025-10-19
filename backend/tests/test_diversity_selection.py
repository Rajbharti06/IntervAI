import random

from app.routes import (
    _select_question_type,
    QUESTION_TYPES,
)


def test_select_question_type_balances_underrepresented_types():
    # Simulate a session with heavy bias toward 'conceptual'
    session = {
        'type_counts': {
            'conceptual': 10,
            'practical': 0,
            'scenario': 0,
            'coding': 0,
            'behavioral': 0,
        }
    }
    random.seed(42)
    counts = {t: 0 for t in QUESTION_TYPES}
    for _ in range(1000):
        t = _select_question_type('basic', None, session)
        counts[t] += 1
    # Expect a strong preference for underrepresented types vs the overrepresented 'conceptual'
    assert counts['conceptual'] < counts['practical']
    assert counts['conceptual'] < counts['scenario']
    assert counts['conceptual'] < counts['coding']
    assert counts['conceptual'] < counts['behavioral']