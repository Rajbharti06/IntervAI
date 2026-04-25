import { useEffect, useRef, useState, useCallback } from 'react';
import { getPersonality } from '../config/personality';

// Each trigger: pattern to detect, minimum occurrences needed, responses to rotate, cooldown
const TRIGGERS = [
  {
    id: 'hedging',
    pattern: /\b(i think|i guess|i believe|maybe|perhaps|probably|i'm not sure|not sure|i suppose)\b/gi,
    minCount: 2,
    phrases: [
      "I'm hearing a lot of uncertainty — which part are you actually sure about?",
      "Be more definitive. What do you know for certain?",
      "Strip the hedging. What's your actual position?",
      "Pick a side. What do you actually believe here?",
    ],
    cooldownMs: 45000,
  },
  {
    id: 'algorithm',
    pattern: /\b(binary search|breadth.first|depth.first|bfs|dfs|dynamic programming|recursion|memoization|hash map|hash table|linked list|binary tree|heap|priority queue|trie|graph)\b/gi,
    minCount: 1,
    phrases: [
      "What's the time complexity of that approach?",
      "And the space complexity?",
      "When would that break down? What's the edge case?",
      "Why not a simpler approach? What makes this one better?",
    ],
    cooldownMs: 60000,
  },
  {
    id: 'database',
    pattern: /\b(database|sql|nosql|mongodb|postgres|postgresql|mysql|redis|cassandra|dynamodb|firebase)\b/gi,
    minCount: 1,
    phrases: [
      "Why that database? What's driving that choice?",
      "How does that scale under high write load?",
      "What's the consistency model? How do you handle failures?",
      "What are the trade-offs compared to the alternative?",
    ],
    cooldownMs: 60000,
  },
  {
    id: 'system_design',
    pattern: /\b(microservice|api gateway|load balanc|kubernetes|docker|message queue|kafka|rabbitmq|pub.sub|caching layer|cdn|reverse proxy)\b/gi,
    minCount: 1,
    phrases: [
      "What's the failure mode there? How do you handle it?",
      "What's the latency overhead of introducing that component?",
      "How does that behave under network partition?",
      "Who owns that service? How do you version the contract?",
    ],
    cooldownMs: 60000,
  },
  {
    id: 'topic_jumping',
    pattern: /\b(and then|and also|additionally|furthermore|moreover|on top of that|another thing|also,)\b/gi,
    minCount: 3,
    phrases: [
      "Hold on — you're covering a lot. What's the single most critical point?",
      "Focus. If I could only remember one thing from your answer, what is it?",
      "You're jumping topics. Let's go deep on one before moving on.",
    ],
    cooldownMs: 35000,
  },
  {
    id: 'filler',
    pattern: /\b(basically|essentially|kind of|sort of|you know|like,|right\?|stuff like that|et cetera)\b/gi,
    minCount: 3,
    phrases: [
      "Drop the filler — say it directly.",
      "Be precise. What exactly are you claiming?",
      "Say that again, but more specifically.",
    ],
    cooldownMs: 35000,
  },
  {
    id: 'vague_claim',
    pattern: /\b(it depends|it varies|in some cases|sometimes it|can be used for|could be|might be|depends on)\b/gi,
    minCount: 2,
    phrases: [
      "It depends on what? Give me the specific condition.",
      "Stop there — depends on what exactly? Name the variable.",
      "Depends on what? Make that concrete.",
    ],
    cooldownMs: 40000,
  },
];

export function useInterruptDetector({
  inputValue,
  currentQuestion,
  isLoading,
  isSpeaking,
  personality,
  enabled = true,
  pauseMs = 3500,
  onInterrupt,
}) {
  const persona = getPersonality(personality);
  const [isArmed, setIsArmed] = useState(false);
  const timer = useRef(null);
  const cooldowns = useRef({});
  const phraseIdx = useRef({});
  const lastQId = useRef(null);

  const isSpeakingRef = useRef(isSpeaking);
  const enabledRef = useRef(enabled);
  const onInterruptRef = useRef(onInterrupt);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onInterruptRef.current = onInterrupt; }, [onInterrupt]);

  const cancelArm = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;
    setIsArmed(false);
  }, []);

  // Reset per-question state
  useEffect(() => {
    if (!currentQuestion) { cancelArm(); return; }
    if (currentQuestion.id === lastQId.current) return;
    lastQId.current = currentQuestion.id;
    cooldowns.current = {};
    phraseIdx.current = {};
    cancelArm();
  }, [currentQuestion?.id, cancelArm]);

  // Clear when disabled
  useEffect(() => { if (!enabled) cancelArm(); }, [enabled, cancelArm]);

  // Core detection — runs on every keystroke
  useEffect(() => {
    if (!currentQuestion || !enabled || isLoading || !inputValue.trim()) {
      cancelArm();
      return;
    }

    const now = Date.now();
    let matched = null;

    for (const trigger of TRIGGERS) {
      if (now < (cooldowns.current[trigger.id] || 0)) continue;
      const hits = [...inputValue.matchAll(new RegExp(trigger.pattern.source, 'gi'))];
      if (hits.length < trigger.minCount) continue;
      const idx = phraseIdx.current[trigger.id] || 0;
      matched = { trigger, phrase: trigger.phrases[idx % trigger.phrases.length] };
      break;
    }

    if (!matched) { cancelArm(); return; }

    // Arm: clear any previous timer and start countdown
    clearTimeout(timer.current);
    setIsArmed(true);

    timer.current = setTimeout(() => {
      if (!enabledRef.current || isSpeakingRef.current) {
        setIsArmed(false);
        return;
      }
      cooldowns.current[matched.trigger.id] = Date.now() + matched.trigger.cooldownMs;
      phraseIdx.current[matched.trigger.id] = (phraseIdx.current[matched.trigger.id] || 0) + 1;
      setIsArmed(false);
      // Apply personality prefix to the interrupt phrase
      const prefix = persona.interruptPrefix || '';
      const finalPhrase = prefix ? prefix + matched.phrase.charAt(0).toLowerCase() + matched.phrase.slice(1) : matched.phrase;
      onInterruptRef.current?.(finalPhrase);
    }, pauseMs);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  return { isArmed };
}
