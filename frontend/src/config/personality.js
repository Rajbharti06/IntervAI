export const PERSONALITIES = {
  friendly: {
    id: 'friendly',
    name: 'Friendly Mentor',
    icon: '😊',
    desc: 'Warm, encouraging, builds confidence',
    voiceRate: 0.88,
    fillers: [
      'Hmm, interesting.',
      'Let me think about that.',
      'Right.',
      'Good.',
      'I see.',
    ],
    fillerChance: 0.40,
    idleNudges: [
      "Take your time — I'm right here with you.",
      "No rush. What's the first thing that comes to mind?",
      "Start wherever feels natural — there's no wrong entry point.",
      "I'm patient. What do you know for certain about this?",
    ],
    pauseNudges: [
      "Good thinking — keep going, what comes next?",
      "You're on the right track. Push a little further.",
      "That's a solid start. What's the next logical step?",
      "Build on that — what's the deeper reason?",
    ],
    verboseInterrupts: [
      "Great detail! Can you give me the core idea in one sentence?",
      "Good depth. What's the single most important point?",
      "I love the thoroughness — what's the headline takeaway?",
    ],
    interruptPrefix: "Ooh, interesting — ",
  },

  strict: {
    id: 'strict',
    name: 'Strict Interviewer',
    icon: '🧑‍💼',
    desc: 'Formal, terse, high expectations',
    voiceRate: 1.0,
    fillers: [
      'Noted.',
      'Continue.',
      'Next.',
      'I see.',
    ],
    fillerChance: 0.18,
    idleNudges: [
      'Begin.',
      'Answer the question.',
      "I'm waiting.",
      'Proceed.',
    ],
    pauseNudges: [
      'Continue.',
      'Your point?',
      'Finish the thought.',
      'Keep going.',
    ],
    verboseInterrupts: [
      'Too long. Core point only.',
      'Concise. What is your answer?',
      'Summarise in one sentence.',
    ],
    interruptPrefix: '',
  },

  aggressive: {
    id: 'aggressive',
    name: 'Startup Founder',
    icon: '🔥',
    desc: 'Impatient, challenging, high pressure',
    voiceRate: 1.12,
    fillers: [
      'Quickly.',
      'Alright.',
      'Go.',
      "Let's move.",
    ],
    fillerChance: 0.28,
    idleNudges: [
      "Come on, we don't have all day.",
      'Start talking. What've you got?',
      "Clock's running. What do you know?",
      "I need an answer, not silence.",
    ],
    pauseNudges: [
      "Don't trail off.",
      'Finish your thought.',
      "I'm losing you here.",
      'Get to the point.',
    ],
    verboseInterrupts: [
      'Too much. Main point — now.',
      'Cut it. What's your actual answer?',
      'Stop. One sentence. Go.',
    ],
    interruptPrefix: 'Hold on — ',
  },

  silent: {
    id: 'silent',
    name: 'Silent Observer',
    icon: '🎭',
    desc: 'Minimal feedback, pressure through silence',
    voiceRate: 0.83,
    fillers: [
      'Mm.',
      'Mm-hm.',
    ],
    fillerChance: 0.12,
    idleNudges: [
      "Whenever you're ready.",
      '...',
    ],
    pauseNudges: [
      'Go on.',
      '...',
      'Continue.',
    ],
    verboseInterrupts: [
      'Simplify.',
      'Less.',
    ],
    interruptPrefix: '',
  },
};

export const DEFAULT_PERSONALITY = 'friendly';

export function getPersonality(id) {
  return PERSONALITIES[id] || PERSONALITIES[DEFAULT_PERSONALITY];
}
