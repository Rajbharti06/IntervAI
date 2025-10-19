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
DIFFICULTY_LEVELS = ("basic", "medium", "hard")
LOCAL_QUESTION_POOL = {
    "basic": [
        "Explain the concept of polymorphism with a simple example.",
        "What is a REST API and how does it work?",
        "Define time complexity and why it matters.",
        "Explain the difference between an array and a linked list.",
        "What is normalization in databases?"
    ],
    "medium": [
        "Design a URL shortener: outline key components and trade-offs.",
        "How would you scale a read-heavy service with caching layers?",
        "Compare SQL vs NoSQL for a logging system; justify your choice.",
        "Describe optimistic vs pessimistic locking and when to use each.",
        "Explain CAP theorem and its practical implications."
    ],
    "hard": [
        "Design a globally distributed messaging system with exactly-once semantics.",
        "How would you implement rate limiting at scale across regions?",
        "Analyze bottlenecks in a high-throughput pipeline and propose fixes.",
        "Explain consensus algorithms (e.g., Raft/Paxos) and failure scenarios.",
        "Propose an approach to minimize tail latency in large systems."
    ],
}

def _compute_effective_difficulty(base_diff: str, last_score_10: int | None) -> str:
    base = (base_diff or "basic").strip().lower()
    if base not in DIFFICULTY_LEVELS:
        base = "basic"
    try:
        if isinstance(last_score_10, int):
            if last_score_10 >= 8 and base != "hard":
                return "medium" if base == "basic" else "hard"
            if last_score_10 <= 4 and base != "basic":
                return "medium" if base == "hard" else "basic"
    except Exception:
        pass
    return base

QUESTION_TYPES = ("conceptual", "practical", "scenario", "coding", "behavioral")
QUESTION_TYPE_WEIGHTS = {
    "basic": {"conceptual": 0.40, "practical": 0.25, "scenario": 0.15, "coding": 0.10, "behavioral": 0.10},
    "medium": {"conceptual": 0.25, "practical": 0.30, "scenario": 0.20, "coding": 0.15, "behavioral": 0.10},
    "hard": {"conceptual": 0.15, "practical": 0.30, "scenario": 0.25, "coding": 0.20, "behavioral": 0.10},
}

# Richer local bank organized by difficulty and type
LOCAL_QUESTION_BANK = {
    "basic": {
        "conceptual": [
            "Explain polymorphism with a simple example.",
            "What is a REST API and how does it work?",
            "Define time complexity and why it matters.",
            "Difference between an array and a linked list?",
            "What is normalization in databases?",
        ],
        "practical": [
            "Outline steps to debug a failing API endpoint.",
            "How would you write unit tests for a simple function?",
            "Describe a basic caching strategy for read-heavy data.",
        ],
        "scenario": [
            "A service slows during peak hours—what do you check first?",
            "User reports inconsistent data—how do you investigate?",
        ],
        "coding": [
            "Write a function to reverse a string.",
            "Implement a stack using two queues—explain your approach.",
        ],
        "behavioral": [
            "Tell me about a time you resolved a team conflict.",
            "Describe how you prioritize tasks under tight deadlines.",
        ],
    },
    "medium": {
        "conceptual": [
            "Explain CAP theorem and practical implications.",
            "Compare SQL vs NoSQL for a logging system.",
        ],
        "practical": [
            "Scale a read-heavy service with caching—outline trade-offs.",
            "Design a URL shortener components and storage model.",
        ],
        "scenario": [
            "Service returns sporadic 500s—diagnose and propose fixes.",
            "Cache stampede observed—how do you mitigate it?",
        ],
        "coding": [
            "Implement LRU cache—describe data structures used.",
            "Traverse a binary tree iteratively and explain complexity.",
        ],
        "behavioral": [
            "Discuss a time you influenced a decision without authority.",
            "Describe mentoring a junior engineer through a project.",
        ],
    },
    "hard": {
        "conceptual": [
            "Explain consensus algorithms (Raft/Paxos) and failure scenarios.",
            "Discuss exactly-once semantics and when they are feasible.",
        ],
        "practical": [
            "Implement rate limiting at scale across regions.",
            "Minimize tail latency—describe architectural approaches.",
        ],
        "scenario": [
            "Global outage due to config drift—investigation and prevention plan.",
            "Hot partition causing hotspots—how do you remediate?",
        ],
        "coding": [
            "Implement distributed lock with lease renewal—explain guarantees.",
            "Design a concurrent worker pool—handle backpressure.",
        ],
        "behavioral": [
            "Tell me about leading a cross-functional incident response.",
            "Describe driving architectural change against initial resistance.",
        ],
    },
}

# Global anti-repeat across sessions (best-effort in-memory)
GLOBAL_ASKED_HASHES = set()

def _is_globally_unseen(text: str) -> bool:
    try:
        h = hash(text)
        return h not in GLOBAL_ASKED_HASHES
    except Exception:
        return True

def _note_global_question(text: str):
    try:
        GLOBAL_ASKED_HASHES.add(hash(text))
    except Exception:
        pass

def _normalize_q(text: str) -> str:
    try:
        t = (text or "").strip().lower()
        # collapse whitespace and strip trivial punctuation
        t = re.sub(r"\s+", " ", t)
        t = re.sub(r"[\.;:!]+$", "", t)
        return t
    except Exception:
        return text or ""

def _is_repeat(session: dict, question: str) -> bool:
    norm = _normalize_q(question)
    asked_norm = session.setdefault('asked_norm_set', set())
    if norm in asked_norm:
        return True
    try:
        return hash(norm) in GLOBAL_ASKED_HASHES
    except Exception:
        return False

def _note_session_question(session: dict, question: str):
    norm = _normalize_q(question)
    session.setdefault('asked_norm_set', set()).add(norm)
    _note_global_question(norm)

def _select_question_type(prep_level: str, last_score_10: int | None, session: dict | None = None) -> str:
    level = _compute_effective_difficulty(prep_level, last_score_10)
    base_weights = QUESTION_TYPE_WEIGHTS.get(level, QUESTION_TYPE_WEIGHTS["basic"]) 
    # Diversity boost: prefer underrepresented types within the session
    adjusted = {}
    counts = (session or {}).get('type_counts', {}) if session else {}
    max_c = max(counts.values()) if counts else 0
    for t in base_weights.keys():
        adjusted[t] = float(base_weights.get(t, 0)) + (max_c - int(counts.get(t, 0)) + 1) * 0.2
    # Recency penalty: avoid repeating recently used types
    last_types = (session or {}).get('last_types', []) if session else []
    for lt in last_types[-2:]:  # look back 2
        if lt in adjusted:
            adjusted[lt] = max(0.01, adjusted[lt] * 0.5)
    # Build cumulative distribution
    types = list(adjusted.keys())
    cumulative = 0.0
    probs = []
    for t in types:
        cumulative += adjusted[t]
        probs.append(cumulative)
    r = random.random() * cumulative
    for i, p in enumerate(probs):
        if r <= p:
            return types[i]
    return types[-1]

def _generate_domain_specific_question(domain: str, difficulty: str, qtype: str) -> str:
    """Generate domain-specific questions based on job type"""
    domain_lower = domain.lower()
    
    # Domain-specific question templates
    domain_questions = {
        # Technology & Engineering
        'software engineering': {
            'basic': {
                'conceptual': ["Explain the difference between object-oriented and functional programming", "What is version control and why is it important?", "Define what an API is and how it works"],
                'practical': ["How would you debug a slow-loading web page?", "Describe the steps to deploy a web application", "How do you ensure code quality in a team?"],
                'coding': ["Write a function to find the largest number in an array", "Implement a simple calculator function", "Create a function to validate an email address"]
            },
            'medium': {
                'conceptual': ["Explain microservices architecture and its benefits", "What is the difference between SQL and NoSQL databases?", "Describe the MVC design pattern"],
                'practical': ["How would you scale a web application for high traffic?", "Design a simple e-commerce database schema", "Explain your approach to API testing"],
                'coding': ["Implement a binary search algorithm", "Create a REST API endpoint for user authentication", "Write a function to detect cycles in a linked list"]
            },
            'hard': {
                'conceptual': ["Explain distributed systems and CAP theorem", "Discuss event-driven architecture patterns", "What are the challenges of implementing microservices?"],
                'practical': ["Design a system to handle millions of concurrent users", "How would you implement real-time notifications at scale?", "Architect a fault-tolerant payment processing system"],
                'coding': ["Implement a distributed cache with consistency guarantees", "Design a rate limiter for an API", "Create a system for processing streaming data"]
            }
        },
        
        # Marketing & Sales
        'digital marketing': {
            'basic': {
                'conceptual': ["What is the difference between organic and paid marketing?", "Explain what a conversion funnel is", "What are the main social media platforms for B2B marketing?"],
                'practical': ["How would you measure the success of an email campaign?", "Describe how to set up a Google Ads campaign", "What metrics would you track for a content marketing strategy?"],
                'scenario': ["A client's website traffic dropped 50% - how do you investigate?", "You need to increase brand awareness on a limited budget - what's your approach?"]
            },
            'medium': {
                'conceptual': ["Explain marketing attribution models and their use cases", "What is programmatic advertising and how does it work?", "Describe the customer journey mapping process"],
                'practical': ["How would you optimize a landing page for conversions?", "Design a multi-channel marketing campaign for a product launch", "Create a strategy to improve email open rates"],
                'scenario': ["Your competitor just launched a similar product - how do you respond?", "ROI on paid ads is declining - what's your optimization strategy?"]
            },
            'hard': {
                'conceptual': ["Discuss advanced marketing automation and personalization strategies", "Explain cross-device tracking and privacy implications", "What are the challenges of marketing in a cookieless future?"],
                'practical': ["Design a comprehensive attribution model for a multi-touch customer journey", "Create a strategy for international market expansion", "Develop a framework for marketing mix optimization"],
                'scenario': ["You need to pivot marketing strategy due to economic downturn", "How would you handle a PR crisis affecting brand reputation?"]
            }
        },
        
        # Finance & Accounting
        'financial analysis': {
            'basic': {
                'conceptual': ["What are the three main financial statements?", "Explain the difference between revenue and profit", "What is cash flow and why is it important?"],
                'practical': ["How would you calculate return on investment (ROI)?", "Describe the process of creating a budget", "What ratios would you use to assess company liquidity?"],
                'scenario': ["A company's expenses are increasing faster than revenue - what do you analyze?", "You need to present financial performance to non-financial stakeholders"]
            },
            'medium': {
                'conceptual': ["Explain different valuation methods for companies", "What is the time value of money and how is it applied?", "Describe various types of financial risks"],
                'practical': ["How would you build a discounted cash flow model?", "Analyze the financial impact of a potential acquisition", "Create a sensitivity analysis for key business drivers"],
                'scenario': ["You're evaluating two investment opportunities with different risk profiles", "A client wants to understand why their profit margins are declining"]
            },
            'hard': {
                'conceptual': ["Discuss advanced derivatives and hedging strategies", "Explain the complexities of international financial reporting", "What are the challenges in valuing intangible assets?"],
                'practical': ["Design a comprehensive risk management framework", "Model the financial impact of various economic scenarios", "Create a capital allocation strategy for a diversified portfolio"],
                'scenario': ["You need to restructure debt for a distressed company", "How would you handle financial reporting during a major acquisition?"]
            }
        },
        
        # Human Resources
        'human resources': {
            'basic': {
                'conceptual': ["What is the difference between recruitment and talent acquisition?", "Explain the importance of employee onboarding", "What are the key components of compensation and benefits?"],
                'practical': ["How would you conduct a job interview effectively?", "Describe the steps in performance management", "What's your approach to handling employee complaints?"],
                'scenario': ["An employee is consistently underperforming - how do you address it?", "You need to reduce workforce due to budget constraints"]
            },
            'medium': {
                'conceptual': ["Explain different leadership development approaches", "What is organizational culture and how do you shape it?", "Describe various employee engagement strategies"],
                'practical': ["How would you design a comprehensive training program?", "Create a strategy for improving employee retention", "Develop a framework for succession planning"],
                'scenario': ["There's conflict between two department heads affecting team morale", "You need to implement major organizational changes"]
            },
            'hard': {
                'conceptual': ["Discuss advanced talent analytics and predictive HR", "Explain the complexities of global HR management", "What are the challenges of managing remote and hybrid workforces?"],
                'practical': ["Design a comprehensive diversity and inclusion strategy", "Create a framework for organizational transformation", "Develop advanced compensation modeling for different markets"],
                'scenario': ["You're leading HR during a major merger or acquisition", "How would you handle a workplace harassment investigation?"]
            }
        },
        
        # Design & Creative
        'ux/ui design': {
            'basic': {
                'conceptual': ["What is the difference between UX and UI design?", "Explain the importance of user research", "What are design systems and why are they useful?"],
                'practical': ["How would you conduct user interviews?", "Describe your process for creating wireframes", "What tools do you use for prototyping?"],
                'scenario': ["Users are complaining that a feature is confusing - how do you investigate?", "You need to design for both mobile and desktop - what's your approach?"]
            },
            'medium': {
                'conceptual': ["Explain different usability testing methods", "What is information architecture and how do you approach it?", "Describe the principles of accessible design"],
                'practical': ["How would you redesign a complex dashboard for better usability?", "Create a user journey map for an e-commerce checkout", "Design a responsive navigation system"],
                'scenario': ["Stakeholders want to add many features but users want simplicity", "You have limited time and budget for user research"]
            },
            'hard': {
                'conceptual': ["Discuss advanced interaction design patterns", "Explain the psychology behind user behavior and decision-making", "What are the challenges of designing for emerging technologies?"],
                'practical': ["Design a comprehensive design system for a large organization", "Create a strategy for international localization", "Develop a framework for measuring design impact"],
                'scenario': ["You need to convince executives to invest in design research", "How would you handle conflicting feedback from multiple stakeholders?"]
            }
        }
    }
    
    # Find matching domain questions
    for domain_key, questions in domain_questions.items():
        if domain_key in domain_lower or any(word in domain_lower for word in domain_key.split()):
            if difficulty in questions and qtype in questions[difficulty]:
                return random.choice(questions[difficulty][qtype])
    
    # Fallback to generic questions based on domain category
    if any(tech_word in domain_lower for tech_word in ['software', 'engineering', 'development', 'programming', 'tech', 'data', 'machine learning', 'ai', 'cloud', 'devops', 'cyber', 'security', 'database', 'system']):
        return _generate_tech_question(domain, difficulty, qtype)
    elif any(business_word in domain_lower for business_word in ['business', 'management', 'strategy', 'operations', 'consulting', 'product']):
        return _generate_business_question(domain, difficulty, qtype)
    elif any(marketing_word in domain_lower for marketing_word in ['marketing', 'sales', 'brand', 'content', 'social media', 'seo', 'advertising']):
        return _generate_marketing_question(domain, difficulty, qtype)
    elif any(finance_word in domain_lower for finance_word in ['finance', 'accounting', 'investment', 'banking', 'financial', 'audit', 'tax']):
        return _generate_finance_question(domain, difficulty, qtype)
    elif any(hr_word in domain_lower for hr_word in ['human resources', 'hr', 'talent', 'recruitment', 'organizational', 'training']):
        return _generate_hr_question(domain, difficulty, qtype)
    elif any(design_word in domain_lower for design_word in ['design', 'ux', 'ui', 'creative', 'graphic', 'web design', 'product design']):
        return _generate_design_question(domain, difficulty, qtype)
    elif any(healthcare_word in domain_lower for healthcare_word in ['healthcare', 'medical', 'clinical', 'pharmaceutical', 'biotech', 'health']):
        return _generate_healthcare_question(domain, difficulty, qtype)
    elif any(legal_word in domain_lower for legal_word in ['legal', 'compliance', 'regulatory', 'contract', 'intellectual property']):
        return _generate_legal_question(domain, difficulty, qtype)
    else:
        return _generate_generic_question(domain, difficulty, qtype)

def _generate_tech_question(domain: str, difficulty: str, qtype: str) -> str:
    templates = {
        'basic': f"Explain a fundamental concept in {domain} that every professional should know",
        'medium': f"Describe how you would solve a common challenge in {domain}",
        'hard': f"Design a complex system or solution for an advanced {domain} problem"
    }
    return templates.get(difficulty, templates['basic'])

def _generate_business_question(domain: str, difficulty: str, qtype: str) -> str:
    templates = {
        'basic': f"What are the key principles of {domain} and why are they important?",
        'medium': f"How would you approach a strategic decision in {domain}?",
        'hard': f"Design a comprehensive strategy for a complex {domain} challenge"
    }
    return templates.get(difficulty, templates['basic'])

def _generate_marketing_question(domain: str, difficulty: str, qtype: str) -> str:
    templates = {
        'basic': f"Explain the basics of {domain} and its key metrics",
        'medium': f"How would you create and execute a {domain} campaign?",
        'hard': f"Design an advanced {domain} strategy for a competitive market"
    }
    return templates.get(difficulty, templates['basic'])

def _generate_finance_question(domain: str, difficulty: str, qtype: str) -> str:
    templates = {
        'basic': f"What are the fundamental concepts in {domain}?",
        'medium': f"How would you analyze and present {domain} data to stakeholders?",
        'hard': f"Design a comprehensive {domain} framework for complex scenarios"
    }
    return templates.get(difficulty, templates['basic'])

def _generate_hr_question(domain: str, difficulty: str, qtype: str) -> str:
    templates = {
        'basic': f"What are the core responsibilities in {domain}?",
        'medium': f"How would you handle a challenging {domain} situation?",
        'hard': f"Design a strategic {domain} initiative for organizational transformation"
    }
    return templates.get(difficulty, templates['basic'])

def _generate_design_question(domain: str, difficulty: str, qtype: str) -> str:
    templates = {
        'basic': f"Explain the design process and principles in {domain}",
        'medium': f"How would you approach a {domain} project with specific constraints?",
        'hard': f"Design a comprehensive {domain} system for a complex product"
    }
    return templates.get(difficulty, templates['basic'])

def _generate_healthcare_question(domain: str, difficulty: str, qtype: str) -> str:
    templates = {
        'basic': f"What are the key regulations and standards in {domain}?",
        'medium': f"How would you improve processes or outcomes in {domain}?",
        'hard': f"Design a solution for a complex {domain} challenge involving multiple stakeholders"
    }
    return templates.get(difficulty, templates['basic'])

def _generate_legal_question(domain: str, difficulty: str, qtype: str) -> str:
    templates = {
        'basic': f"What are the fundamental legal principles in {domain}?",
        'medium': f"How would you handle a {domain} issue for a client?",
        'hard': f"Design a comprehensive {domain} strategy for a complex legal matter"
    }
    return templates.get(difficulty, templates['basic'])

def _generate_generic_question(domain: str, difficulty: str, qtype: str) -> str:
    templates = {
        'basic': f"What are the key skills and knowledge areas required in {domain}?",
        'medium': f"Describe a challenging situation you might face in {domain} and how you would handle it",
        'hard': f"Design a strategic approach to excel in {domain} in a competitive environment"
    }
    return templates.get(difficulty, templates['basic'])

def _generate_local_question_with_difficulty(session: dict, session_id: str) -> str:
    domain = session.get('domain') or 'your field'
    eff = _compute_effective_difficulty(session.get('difficulty', 'basic'), session.get('last_score_10'))
    qtype = _select_question_type(eff, session.get('last_score_10'), session)
    
    # Try domain-specific question first
    domain_question = _generate_domain_specific_question(domain, eff, qtype)
    if domain_question:
        asked = set(session.get('questions_asked', []))
        if domain_question not in asked and not _is_repeat(session, domain_question):
            _note_session_question(session, domain_question)
            session.setdefault('type_counts', {})[qtype] = int(session.setdefault('type_counts', {}).get(qtype, 0)) + 1
            session.setdefault('last_types', []).append(qtype)
            return domain_question
    
    # Fallback to original question bank
    bank = LOCAL_QUESTION_BANK.get(eff, {}).get(qtype, [])
    if not bank:
        bank = LOCAL_QUESTION_POOL.get(eff, LOCAL_QUESTION_POOL['basic'])
    asked = set(session.get('questions_asked', []))
    session.setdefault('type_counts', {})
    session.setdefault('last_types', [])
    # Try up to len(bank) to avoid repeat within session
    if bank:
        for _ in range(len(bank)):
            idx = random.randrange(0, len(bank))
            candidate = f"{bank[idx]} (Type: {qtype}, Topic: {domain})"
            if candidate not in asked and not _is_repeat(session, candidate):
                _note_session_question(session, candidate)
                session['type_counts'][qtype] = int(session['type_counts'].get(qtype, 0)) + 1
                session['last_types'].append(qtype)
                return candidate
        # fallback if all seen
        fallback = f"{bank[0]} (Type: {qtype}, Topic: {domain})"
        _note_session_question(session, fallback)
        session['type_counts'][qtype] = int(session['type_counts'].get(qtype, 0)) + 1
        session['last_types'].append(qtype)
        return fallback
    # ultimate fallback
    ultimate = f"Ask me one {eff} {qtype} interview question about {domain}."
    _note_session_question(session, ultimate)
    session['type_counts'][qtype] = int(session['type_counts'].get(qtype, 0)) + 1
    session['last_types'].append(qtype)
    return ultimate

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
def start_interview(provider: str = Form(...), api_key: str = Form(...), domain: str = Form(...), model: str | None = Form(None), difficulty: str = Form("basic")):
    if not api_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    if provider not in API_CONFIGS:
        raise HTTPException(status_code=400, detail=f"Invalid API provider: {provider}")
    # Validate difficulty value
    diff_val = (difficulty or "basic").strip().lower()
    if diff_val not in DIFFICULTY_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid difficulty: {difficulty}. Choose one of {DIFFICULTY_LEVELS}")

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
        "difficulty": diff_val,
        "questions_asked": [],
        "answers_given": [],
        "feedback_received": [],
        "qa_pairs": [],
        "weak_areas": {},
        "scores_10": [],
        "last_score_10": None
    }
    return {"message": "Interview session started", "session_id": session_id, "provider": provider, "domain": domain, "model": chosen_model, "difficulty": diff_val}

@router.post("/interview/question")
def get_interview_question(session_id: str = Form(...)):
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    # Compute effective difficulty and tag for prompting
    base_diff = session.get('difficulty', 'basic')
    last = session.get('last_score_10')
    eff = _compute_effective_difficulty(base_diff, last)
    eff_tag = {
        'basic': 'foundational/basic',
        'medium': 'intermediate',
        'hard': 'advanced/challenging'
    }.get(eff, 'foundational/basic')
    qtype = _select_question_type(eff, last, session)

    # Offline/demo mode: return a locally generated question without calling external APIs
    if _is_offline_demo(session):
        q = _generate_local_question_with_difficulty(session, session_id)
        session.setdefault('questions_asked', []).append(q)
        # track last question for naive evaluation
        session['current_question'] = q
        return {"question": q}

    provider = session['provider']
    config = API_CONFIGS.get(provider)
    # If config is missing, gracefully fallback instead of erroring
    if not config:
        question = _generate_local_question_with_difficulty(session, session_id)
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
                "messages": [{"role": "user", "content": f"Ask me one {eff_tag} {qtype} interview question about {session['domain']}."}]
            }
            res = requests.post(api_url, headers=headers, json=payload, timeout=30)
            try:
                response_data = res.json()
            except Exception:
                response_data = {"message": res.text}
            if not res.ok or 'choices' not in response_data or not response_data['choices']:
                error_msg = mask_secret(extract_error_message(response_data))
                print(f"{provider} API Error (question): {error_msg}")
                question = _generate_local_question_with_difficulty(session, session_id)
            else:
                question = response_data['choices'][0]['message']['content']
                # Avoid duplicates from provider
                if _is_repeat(session, question):
                    question = _generate_local_question_with_difficulty(session, session_id)
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
                    {"role": "user", "content": f"Ask me one {eff_tag} {qtype} interview question about {session['domain']}"}
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
                question = _generate_local_question_with_difficulty(session, session_id)
            else:
                parts = response_data['content']
                question = "".join([p.get('text', '') for p in parts if isinstance(p, dict)]) or str(parts)
                if _is_repeat(session, question):
                    question = _generate_local_question_with_difficulty(session, session_id)
        elif provider == "google":
            # Google Generative Language (Gemini)
            api_url = config["base_url"] + f"/models/{model}:generateContent"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [
                    {"parts": [{"text": f"Ask me one {eff_tag} {qtype} interview question about {session['domain']}"}]}
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
                question = _generate_local_question_with_difficulty(session, session_id)
            else:
                if _is_repeat(session, question):
                    question = _generate_local_question_with_difficulty(session, session_id)
        else:
            # Unsupported provider - fallback instead of erroring
            question = _generate_local_question_with_difficulty(session, session_id)
    except requests.exceptions.RequestException as e:
        print(f"Upstream request failed (question): {str(e)}")
        question = _generate_local_question(session, session_id)

    # Final guard to always produce a question
    if not question:
        question = _generate_local_question_with_difficulty(session, session_id)

    session.setdefault('questions_asked', []).append(question)
    session['current_question'] = question
    # Update type counts and global seen for provider-generated question
    session.setdefault('type_counts', {})
    session['type_counts'][qtype] = int(session['type_counts'].get(qtype, 0)) + 1
    session.setdefault('last_types', []).append(qtype)
    _note_session_question(session, question)
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
        # Naive local scoring on 1–10 scale
        length = len(user_answer.split())
        is_invalid = length < 3
        if is_invalid:
            score = 1
            verdict = "Incorrect"
        else:
            score = min(10, 5 + max(0, length - 8) // 2)
            verdict = "Correct" if score >= 8 else ("Partially Correct" if score >= 5 else "Incorrect")
        feedback_lines = []
        if is_invalid:
            feedback_lines.append("Your answer seems too short or incomplete. Please provide more detail and address the question directly.")
        feedback_lines += [
            "Good structure and clarity." if score >= 8 else "Decent attempt—add more detail and examples.",
            "Consider emphasizing trade-offs." if score >= 5 else "Address key concepts explicitly.",
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
        # Track score history and last score for adaptive difficulty
        session.setdefault('scores_10', []).append(score)
        session['last_score_10'] = score
        # Track weak areas in a very naive way
        weak_map = session.setdefault('weak_areas', {})
        topic = (session.get('domain') or 'General').strip() or 'General'
        if score < 8:
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
                "Return JSON with fields: score (1-10 number), verdict (string), feedback (string), correct_answer (string). "
                "If the answer is empty, too short, or off-topic, set score to 1 and provide a concise, authoritative model answer in correct_answer."
            )
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are an expert interviewer. Score answers 1-10, provide concise feedback and a clear verdict (Correct/Partially Correct/Incorrect)."},
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
                # Normalize to 1–10 scale if provider returned 0–100
                if score > 10:
                    score = max(1, min(10, round(score / 10)))
                if score < 1:
                    score = 1
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
                "score (1-10 number), verdict (Correct/Partially Correct/Incorrect), feedback (concise string), correct_answer (string).\n\n"
                f"Question: {session.get('current_question', 'Unknown')}\nAnswer: {answer}\n"
                "If the answer is empty, too short, or off-topic, set score to 1 and provide a concise, authoritative model answer in correct_answer."
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
                if score > 10:
                    score = max(1, min(10, round(score / 10)))
                if score < 1:
                    score = 1
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
                "score (1-10 number), verdict (Correct/Partially Correct/Incorrect), feedback (concise string), correct_answer (string).\n\n"
                f"Question: {session.get('current_question', 'Unknown')}\nAnswer: {answer}\n"
                "If the answer is empty, too short, or off-topic, set score to 1 and provide a concise, authoritative model answer in correct_answer."
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
                if score > 10:
                    score = max(1, min(10, round(score / 10)))
                if score < 1:
                    score = 1
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
    session.setdefault('scores_10', []).append(score)
    session['last_score_10'] = score

    return {
        'score': score,
        'verdict': verdict,
        'feedback': feedback,
        'correct_answer': correct_answer
    }

@router.post("/interview/followup")
def generate_followup(session_id: str = Form(...)):
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    prev_q = session.get('current_question') or ''
    last_pair = session.get('qa_pairs', [])[-1] if session.get('qa_pairs') else None
    prev_a = (last_pair or {}).get('user_answer') or (session.get('answers_given', [])[-1] if session.get('answers_given') else '')

    base_diff = session.get('difficulty', 'basic')
    last = session.get('last_score_10')
    eff = _compute_effective_difficulty(base_diff, last)
    # Prefer a different type than the last asked for diversity
    last_types = session.get('last_types', [])
    preferred_type = None
    for t in QUESTION_TYPES:
        if not last_types or t != last_types[-1]:
            preferred_type = t
            break
    qtype = preferred_type or _select_question_type(eff, last, session)

    # Offline/demo follow-up
    if _is_offline_demo(session):
        domain = session.get('domain') or 'your field'
        follow = f"Follow-up ({eff}, {qtype}) on {domain}: Can you elaborate more on your previous answer about '{prev_q}'?"
        if _is_repeat(session, follow):
            follow = _generate_local_question_with_difficulty(session, session_id)
        session.setdefault('questions_asked', []).append(follow)
        session['current_question'] = follow
        session.setdefault('type_counts', {})
        session['type_counts'][qtype] = int(session['type_counts'].get(qtype, 0)) + 1
        session.setdefault('last_types', []).append(qtype)
        _note_session_question(session, follow)
        return {"question": follow}

    provider = session['provider']
    config = API_CONFIGS.get(provider)
    if not config:
        q = _generate_local_question_with_difficulty(session, session_id)
        session.setdefault('questions_asked', []).append(q)
        session['current_question'] = q
        return {"question": q}

    model = session.get('model') or get_default_model(provider)
    eff_tag = {
        'basic': 'foundational/basic',
        'medium': 'intermediate',
        'hard': 'advanced/challenging'
    }.get(eff, 'foundational/basic')

    try:
        if provider in {"openai", "perplexity", "grok", "together_ai"}:
            api_url = config["base_url"] + "/chat/completions"
            headers = {"Authorization": f"Bearer {session['api_key']}", "Content-Type": "application/json"}
            prompt = (
                f"Given the previous interview question and the candidate's answer, ask ONE focused {eff_tag} {qtype} follow-up question to probe deeper.\n"
                f"Previous question: {prev_q}\n"
                f"Candidate answer: {prev_a}\n"
                f"Return ONLY the question text."
            )
            payload = {"model": model, "messages": [{"role": "user", "content": prompt}]}
            res = requests.post(api_url, headers=headers, json=payload, timeout=30)
            try:
                response_data = res.json()
            except Exception:
                response_data = {"message": res.text}
            if not res.ok or 'choices' not in response_data or not response_data['choices']:
                error_msg = mask_secret(extract_error_message(response_data))
                print(f"{provider} API Error (followup): {error_msg}")
                question = _generate_local_question_with_difficulty(session, session_id)
            else:
                question = response_data['choices'][0]['message']['content']
                if _is_repeat(session, question):
                    question = _generate_local_question_with_difficulty(session, session_id)
        elif provider == "anthropic":
            api_url = config["base_url"] + "/messages"
            headers = {"x-api-key": session['api_key'], "anthropic-version": "2023-06-01", "Content-Type": "application/json"}
            prompt = (
                f"Given the previous interview question and the candidate's answer, ask ONE focused {eff_tag} {qtype} follow-up question to probe deeper.\n"
                f"Previous question: {prev_q}\n"
                f"Candidate answer: {prev_a}\n"
                f"Return ONLY the question text."
            )
            payload = {"model": model, "max_tokens": 200, "messages": [{"role": "user", "content": prompt}]}
            res = requests.post(api_url, headers=headers, json=payload, timeout=30)
            try:
                response_data = res.json()
            except Exception:
                response_data = {"message": res.text}
            if not res.ok:
                error_msg = mask_secret(extract_error_message(response_data))
                print(f"{provider} API Error (followup): {error_msg}")
                question = _generate_local_question_with_difficulty(session, session_id)
            else:
                parts = response_data.get('content') or []
                question = "".join([p.get('text', '') for p in parts if isinstance(p, dict)]) or str(parts)
                if _is_repeat(session, question):
                    question = _generate_local_question_with_difficulty(session, session_id)
        elif provider == "google":
            api_url = config["base_url"] + f"/models/{model}:generateContent"
            headers = {"Content-Type": "application/json"}
            prompt = (
                f"Given the previous interview question and the candidate's answer, ask ONE focused {eff_tag} {qtype} follow-up question to probe deeper.\n"
                f"Previous question: {prev_q}\n"
                f"Candidate answer: {prev_a}\n"
                f"Return ONLY the question text."
            )
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            res = requests.post(api_url, headers=headers, params={"key": session['api_key']}, json=payload, timeout=30)
            try:
                response_data = res.json()
            except Exception:
                response_data = {"message": res.text}
            try:
                candidates = response_data.get('candidates') or []
                content = (candidates[0] or {}).get('content') or {}
                parts = content.get('parts') or []
                question = (parts[0] or {}).get('text') or ''
            except Exception:
                question = ''
            if not res.ok or not question:
                error_msg = mask_secret(extract_error_message(response_data))
                print(f"{provider} API Error (followup): {error_msg}")
                question = _generate_local_question_with_difficulty(session, session_id)
            else:
                if _is_repeat(session, question):
                    question = _generate_local_question_with_difficulty(session, session_id)
        else:
            question = _generate_local_question_with_difficulty(session, session_id)
    except requests.exceptions.RequestException as e:
        print(f"Upstream request failed (followup): {str(e)}")
        question = _generate_local_question_with_difficulty(session, session_id)

    if not question:
        question = _generate_local_question_with_difficulty(session, session_id)

    session.setdefault('questions_asked', []).append(question)
    session['current_question'] = question
    session.setdefault('type_counts', {})
    session['type_counts'][qtype] = int(session['type_counts'].get(qtype, 0)) + 1
    session.setdefault('last_types', []).append(qtype)
    _note_session_question(session, question)
    return {"question": question}


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
        "model": model,
        "difficulty": session.get('difficulty', 'basic')
    }
