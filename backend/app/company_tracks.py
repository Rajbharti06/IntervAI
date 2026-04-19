"""
Company-Specific Interview Tracks.

Covers FAANG, top startups, and major industries.
Each track has: interview style, focus areas, question bank, tips.
"""

from __future__ import annotations

TRACKS: dict[str, dict] = {
    "google": {
        "name": "Google",
        "icon": "🔍",
        "style": "Structured, algorithm-heavy, with strong emphasis on scalability and clean code.",
        "focus": ["Data Structures", "Algorithms", "System Design", "Problem Solving", "Googleyness"],
        "rounds": ["Technical (2-3 rounds)", "System Design", "Behavioral (Googleyness)"],
        "tips": [
            "Think out loud — Google wants to see your reasoning process, not just the answer.",
            "Optimize time and space complexity; always state your Big-O analysis.",
            "For system design, start with clarifying requirements, then scale up.",
            "Googleyness: show genuine curiosity, learning from failure, and collaboration.",
        ],
        "questions": {
            "basic": [
                "What is the difference between a stack and a queue? When would you use each?",
                "Explain Big-O notation. What is the time complexity of binary search?",
                "How does garbage collection work in your preferred language?",
                "What is the difference between process and thread?",
                "Explain recursion and give a classic example.",
            ],
            "medium": [
                "Design a parking lot system — what classes, data structures would you use?",
                "Given an array of integers, find all pairs that sum to a target value. Optimize for O(n).",
                "Explain how a HashMap works internally. What happens during collision?",
                "How would you find the LCA (Lowest Common Ancestor) of two nodes in a binary tree?",
                "Design a rate limiter for an API that serves 1 million requests/day.",
            ],
            "hard": [
                "Design Google Maps — focus on routing, real-time updates, and scale.",
                "Implement a distributed cache with consistent hashing and fault tolerance.",
                "Explain the CAP theorem and how Google Spanner addresses it.",
                "Design a system to detect duplicate news articles at Google News scale.",
                "How would you implement autocomplete for Google Search with sub-100ms latency?",
            ],
        },
    },
    "amazon": {
        "name": "Amazon",
        "icon": "📦",
        "style": "Leadership Principles-driven. Every answer should map to at least one LP.",
        "focus": ["Leadership Principles", "System Design", "Algorithms", "Customer Obsession"],
        "rounds": ["Phone screen", "Technical (2 rounds)", "System Design", "Bar Raiser (behavioral)"],
        "tips": [
            "Master all 16 Amazon Leadership Principles — every answer needs an LP angle.",
            "Use STAR format for behavioral questions. Be specific with metrics and outcomes.",
            "Customer Obsession: always frame technical decisions around customer impact.",
            "Ownership: show you've taken full ownership of problems, not just done your part.",
        ],
        "questions": {
            "basic": [
                "Tell me about a time you took ownership of a problem that wasn't your responsibility.",
                "Describe a situation where you had to deliver with incomplete information.",
                "What is the difference between SQS and SNS in AWS?",
                "Explain the concept of eventual consistency.",
                "How does DynamoDB differ from relational databases?",
            ],
            "medium": [
                "Design Amazon's shopping cart — handle millions of concurrent users.",
                "Tell me about a time you used data to make a decision that others disagreed with.",
                "Design a notification system (email, push, SMS) for Amazon Prime customers.",
                "How would you handle a situation where your team missed a critical deadline?",
                "Describe a time you simplified a complex process. What was the impact?",
            ],
            "hard": [
                "Design Amazon's recommendation engine — how do you handle cold start?",
                "Tell me about the most ambiguous project you led. How did you bring clarity?",
                "Design a global order fulfillment system that handles Black Friday traffic spikes.",
                "How would you design a system to detect fraudulent transactions in real time?",
                "Describe a time you invented something that became a standard at your company.",
            ],
        },
    },
    "meta": {
        "name": "Meta (Facebook)",
        "icon": "👤",
        "style": "Move fast, data-driven decisions, social graph problems, scale challenges.",
        "focus": ["Algorithms", "System Design at Scale", "Product Sense", "Behavioral"],
        "rounds": ["Technical (2 rounds)", "System Design", "Behavioral", "Product Sense (PM roles)"],
        "tips": [
            "Meta loves graph problems — master BFS/DFS, shortest paths, connected components.",
            "Scale is everything. Always think 'how does this work with 3 billion users?'",
            "Product sense matters even for engineers — think about user impact.",
            "Show speed and pragmatism — Meta values shipping over perfection.",
        ],
        "questions": {
            "basic": [
                "How would you represent a social network graph? What data structure?",
                "Explain BFS vs DFS and when to use each.",
                "What are the tradeoffs between SQL and NoSQL for a social feed?",
                "How does React's virtual DOM improve performance?",
                "What is the difference between authentication and authorization?",
            ],
            "medium": [
                "Design Facebook's News Feed — how do you rank 1000s of posts for each user?",
                "How would you find all friends within 2 degrees of separation for a given user?",
                "Design Instagram's story disappearing feature with 24-hour expiry.",
                "Tell me about a time you had to make a difficult tradeoff between quality and speed.",
                "How would you detect hate speech at scale across 3 billion users?",
            ],
            "hard": [
                "Design WhatsApp's message delivery system with end-to-end encryption at scale.",
                "How would you build a real-time collaborative editing system like Google Docs?",
                "Design Meta's live video streaming infrastructure for billions of viewers.",
                "How do you prevent distributed denial-of-service attacks on the API layer?",
                "Design a global identity system that handles account merges across WhatsApp, Instagram, and Facebook.",
            ],
        },
    },
    "microsoft": {
        "name": "Microsoft",
        "icon": "🪟",
        "style": "Growth mindset, collaborative culture, practical problem solving.",
        "focus": ["OOP Design", "Algorithms", "System Design", "Cloud (Azure)", "Behavioral"],
        "rounds": ["Technical (3-4 rounds)", "System Design", "Manager round"],
        "tips": [
            "Microsoft loves OOP — design patterns (Singleton, Observer, Factory) come up often.",
            "Show growth mindset — Microsoft's core value. Discuss how you learn from failures.",
            "Azure knowledge is a bonus. Understand cloud concepts: VMs, containers, serverless.",
            "Collaboration: show you can work across teams and influence without authority.",
        ],
        "questions": {
            "basic": [
                "Explain the SOLID principles with examples.",
                "What is the difference between abstract class and interface?",
                "How does Dependency Injection work and why is it useful?",
                "Explain the Observer design pattern.",
                "What is a deadlock and how do you prevent it?",
            ],
            "medium": [
                "Design a file system — folders, files, permissions. What classes would you create?",
                "How would you design a collaborative document editor (like Word Online)?",
                "Tell me about a time you dealt with a difficult stakeholder.",
                "Design an elevator system for a 50-floor building.",
                "How would you implement a thread-safe singleton in your preferred language?",
            ],
            "hard": [
                "Design Azure Active Directory's authentication flow for enterprise SSO.",
                "How would you build Microsoft Teams' real-time messaging at global scale?",
                "Design a multi-tenant SaaS billing system that handles different pricing models.",
                "How do you approach migrating a monolith to microservices without downtime?",
                "Design GitHub's code review system with real-time collaboration features.",
            ],
        },
    },
    "apple": {
        "name": "Apple",
        "icon": "🍎",
        "style": "Polish, attention to detail, privacy-first, hardware-software integration.",
        "focus": ["System Programming", "Performance Optimization", "Privacy", "User Experience"],
        "rounds": ["Technical (deep dive)", "Design review", "Manager/Director round"],
        "tips": [
            "Apple cares deeply about privacy — always consider data minimization in your designs.",
            "Performance matters. Know memory management, CPU optimization, and battery impact.",
            "Attention to detail is critical — small UX decisions get interrogated deeply.",
            "Swift and Objective-C knowledge is valued for iOS/macOS roles.",
        ],
        "questions": {
            "basic": [
                "What is ARC (Automatic Reference Counting) and how does it prevent memory leaks?",
                "Explain the MVC pattern and how Apple's frameworks implement it.",
                "What is the difference between value types and reference types in Swift?",
                "How does Core Data differ from SQLite?",
                "What are Grand Central Dispatch (GCD) and OperationQueue used for?",
            ],
            "medium": [
                "Design an offline-first photo sharing app that syncs when online.",
                "How would you optimize an iOS app that's consuming too much battery?",
                "Explain how you'd design a privacy-preserving analytics system.",
                "How would you implement smooth scrolling for a complex list with 10,000 items?",
                "Design the iCloud sync architecture for Notes app across all Apple devices.",
            ],
            "hard": [
                "Design the security architecture for Apple Pay — from tap to transaction confirmation.",
                "How would you build Face ID's liveness detection to prevent spoofing?",
                "Design a distributed compilation system for Xcode Cloud.",
                "How would you approach reducing the iPhone's cold boot time by 30%?",
                "Design Siri's intent recognition and cross-app action system.",
            ],
        },
    },
    "startup": {
        "name": "Startup / Early Stage",
        "icon": "🚀",
        "style": "Generalist, fast learner, can own full features end-to-end.",
        "focus": ["Full Stack", "Product Thinking", "Ownership", "Speed vs Quality tradeoffs"],
        "rounds": ["Take-home project OR live coding", "Cultural fit", "Founder round"],
        "tips": [
            "Show you can wear many hats — frontend, backend, DevOps, data.",
            "Product thinking: why are we building this? How does it grow the business?",
            "Speed matters. Show you can ship an MVP in a weekend if needed.",
            "Cultural fit is huge at startups — be authentic, show passion for the mission.",
        ],
        "questions": {
            "basic": [
                "Walk me through how you'd set up a new project from scratch.",
                "What's your approach when you're given a feature with no requirements?",
                "How do you prioritize when you have three urgent tasks at once?",
                "What's the simplest architecture you'd choose for a new SaaS app?",
                "How do you decide when to refactor vs when to ship messy code?",
            ],
            "medium": [
                "Design and build a simple REST API for a task management app. Walk me through it.",
                "How would you go from 0 to 1000 users in 30 days? What would you build first?",
                "Tell me about a time you shipped something you weren't 100% happy with. Why?",
                "How do you instrument a new feature to measure if it's working?",
                "Walk me through a technical decision you made that you'd change now.",
            ],
            "hard": [
                "How would you architect a platform that starts as a monolith but can scale to millions?",
                "Design a multi-tenant SaaS with strict data isolation on a shoestring budget.",
                "You're the only engineer and you have a critical outage. Walk me through your incident process.",
                "How do you build a culture of engineering excellence in a 5-person team?",
                "Design a self-serve onboarding flow that converts 40% of signups to paid customers.",
            ],
        },
    },
    "behavioral": {
        "name": "Behavioral / Leadership",
        "icon": "🤝",
        "style": "STAR method, situation-action-result, leadership and conflict stories.",
        "focus": ["Leadership", "Conflict Resolution", "Ownership", "Communication", "Growth Mindset"],
        "rounds": ["HR screen", "Manager round", "Skip-level interview"],
        "tips": [
            "Always use STAR: Situation, Task, Action, Result. Never skip Result with metrics.",
            "Have 5-7 core stories that can flex to answer different questions.",
            "Show self-awareness — discuss what you'd do differently in hindsight.",
            "Quantify everything: 'improved performance by 40%', 'reduced costs by $50k'.",
        ],
        "questions": {
            "basic": [
                "Tell me about yourself and why you're interested in this role.",
                "Describe a time you had to learn something new quickly. How did you approach it?",
                "Tell me about a project you're proud of and your role in it.",
                "How do you handle feedback that you disagree with?",
                "Describe how you prioritize tasks when everything feels urgent.",
            ],
            "medium": [
                "Tell me about a time you had a conflict with a colleague. How did you resolve it?",
                "Describe a situation where you influenced a decision without direct authority.",
                "Tell me about the most difficult feedback you've given someone. How did you prepare?",
                "Describe a project that failed. What did you learn and what did you change?",
                "Tell me about a time you identified a problem before it became critical.",
            ],
            "hard": [
                "Describe the most ambiguous project you've led. How did you bring clarity and drive results?",
                "Tell me about a time you had to make a decision with incomplete information under pressure.",
                "Describe a time you had to change the culture or direction of a team.",
                "Tell me about a time you pushed back on leadership. How did you handle it?",
                "Describe a situation where you had to build trust with a skeptical stakeholder from scratch.",
            ],
        },
    },
    "system_design": {
        "name": "System Design",
        "icon": "🏗️",
        "style": "Open-ended architecture discussions, scalability, reliability, trade-offs.",
        "focus": ["Scalability", "Reliability", "Database Design", "APIs", "Caching", "Queues"],
        "rounds": ["1-2 hour design session with a senior engineer"],
        "tips": [
            "Always clarify requirements first: scale, features, constraints, SLAs.",
            "Start simple, then scale: monolith → services → distributed systems.",
            "Know the 4 Cs: Cache, CDN, Queue, Database sharding.",
            "Always discuss trade-offs — there's no perfect solution, only the best fit.",
        ],
        "questions": {
            "basic": [
                "Design a URL shortener like bit.ly. What's your database schema?",
                "How would you design a simple key-value store?",
                "Design a basic notification system for a social media app.",
                "How would you implement a search autocomplete feature?",
                "Design a simple rate limiter for an API.",
            ],
            "medium": [
                "Design Twitter's tweet feed — how do you handle fanout for celebrities with 50M followers?",
                "Design a distributed job scheduler (like cron but for thousands of servers).",
                "How would you design Uber's surge pricing engine?",
                "Design a real-time collaborative whiteboard tool.",
                "How would you build a web crawler for a search engine?",
            ],
            "hard": [
                "Design Google's globally distributed file system (GFS).",
                "How would you build a real-time fraud detection system for a payment processor?",
                "Design Netflix's video transcoding and streaming pipeline.",
                "How would you design a consistent, low-latency global database like Spanner?",
                "Design a distributed tracing system for a microservices architecture with 1000 services.",
            ],
        },
    },
}


def get_track(track_id: str) -> dict | None:
    return TRACKS.get(track_id.lower())


def get_all_tracks() -> list[dict]:
    return [
        {"id": k, "name": v["name"], "icon": v["icon"], "style": v["style"], "focus": v["focus"]}
        for k, v in TRACKS.items()
    ]


def get_track_question(track_id: str, difficulty: str, asked: set | None = None) -> str | None:
    """Pick a random unseen question from the track's bank."""
    import random
    track = get_track(track_id)
    if not track:
        return None
    bank = track.get("questions", {}).get(difficulty, [])
    if not bank:
        bank = track.get("questions", {}).get("medium", [])
    if not bank:
        return None
    asked = asked or set()
    unseen = [q for q in bank if q not in asked]
    if not unseen:
        unseen = bank
    return random.choice(unseen)
