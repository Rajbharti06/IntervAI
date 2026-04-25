import { useEffect, useRef, useCallback } from 'react';
import { getPersonality } from '../config/personality';

// Default pools used when personality doesn't override
const DEFAULT_IDLE = [
  "Take your time — walk me through your initial thinking.",
  "What's the first thing that comes to mind for this?",
  "Let's break it down. What part of the question feels clear to you?",
  "I'm patient. Start with whatever you know for certain.",
  "No pressure — begin wherever feels natural.",
];

const DEFAULT_PAUSE = [
  "Good start — keep going. What comes next?",
  "Interesting direction. Why specifically that approach?",
  "Can you be more specific there?",
  "Push a little further — what's the core of your argument?",
  "You're on the right track. What's the next logical step?",
];

const DEFAULT_VERBOSE = [
  "Hold on — that's a lot of ground. What's your single most important point?",
  "Let me stop you there. Can you give me the core idea in two sentences?",
  "I want to make sure I follow — what's the central claim you're making?",
  "You've covered a lot. If you had to pick one key thing, what is it?",
];

export function useSilenceDetector({
  currentQuestion,
  inputValue,
  isLoading,
  isSpeaking,
  personality,
  enabled = true,
  idleThresholdMs = 18000,
  pauseThresholdMs = 10000,
  verbosityWords = 130,
  verbosityPauseMs = 6000,
  onNudge,
}) {
  const idleTimer = useRef(null);
  const pauseTimer = useRef(null);
  const nudgeIdx = useRef(0);
  const hasTyped = useRef(false);
  const lastQId = useRef(null);
  const lastLen = useRef(0);

  const isSpeakingRef = useRef(isSpeaking);
  const enabledRef = useRef(enabled);
  const onNudgeRef = useRef(onNudge);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onNudgeRef.current = onNudge; }, [onNudge]);

  // Resolve phrase pools from personality or defaults
  const persona = getPersonality(personality);
  const idlePool = (persona.idleNudges?.length > 0) ? persona.idleNudges : DEFAULT_IDLE;
  const pausePool = (persona.pauseNudges?.length > 0) ? persona.pauseNudges : DEFAULT_PAUSE;
  const verbosePool = (persona.verboseInterrupts?.length > 0) ? persona.verboseInterrupts : DEFAULT_VERBOSE;

  const idlePoolRef = useRef(idlePool);
  const pausePoolRef = useRef(pausePool);
  const verbosePoolRef = useRef(verbosePool);
  useEffect(() => { idlePoolRef.current = idlePool; }, [JSON.stringify(idlePool)]);
  useEffect(() => { pausePoolRef.current = pausePool; }, [JSON.stringify(pausePool)]);
  useEffect(() => { verbosePoolRef.current = verbosePool; }, [JSON.stringify(verbosePool)]);

  const clearAll = useCallback(() => {
    clearTimeout(idleTimer.current);
    clearTimeout(pauseTimer.current);
    idleTimer.current = null;
    pauseTimer.current = null;
  }, []);

  const fire = useCallback((poolRef) => {
    if (!enabledRef.current || isSpeakingRef.current) return;
    const pool = poolRef.current;
    const phrase = pool[nudgeIdx.current % pool.length];
    nudgeIdx.current += 1;
    onNudgeRef.current?.(phrase);
  }, []);

  // Reset and start idle timer whenever a new question arrives
  useEffect(() => {
    if (!currentQuestion || isLoading) { clearAll(); return; }
    if (currentQuestion.id === lastQId.current) return;

    lastQId.current = currentQuestion.id;
    nudgeIdx.current = 0;
    hasTyped.current = false;
    lastLen.current = 0;
    clearAll();

    if (!enabled) return;

    idleTimer.current = setTimeout(() => {
      if (!hasTyped.current) {
        fire(idlePoolRef);
        idleTimer.current = setTimeout(() => {
          if (!hasTyped.current) fire(idlePoolRef);
        }, idleThresholdMs);
      }
    }, idleThresholdMs);

    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, isLoading]);

  // Clear timers when voice is toggled off
  useEffect(() => { if (!enabled) clearAll(); }, [enabled, clearAll]);

  // Watch typing — pause nudge + verbose interrupt
  useEffect(() => {
    if (!currentQuestion || !enabled || isLoading) return;
    const len = inputValue.length;

    if (len > 0 && !hasTyped.current) {
      hasTyped.current = true;
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }

    if (len > lastLen.current) {
      lastLen.current = len;
      clearTimeout(pauseTimer.current);
      pauseTimer.current = null;

      const words = inputValue.trim().split(/\s+/).filter(Boolean).length;
      if (words >= verbosityWords) {
        pauseTimer.current = setTimeout(() => fire(verbosePoolRef), verbosityPauseMs);
      } else if (words >= 20) {
        pauseTimer.current = setTimeout(() => fire(pausePoolRef), pauseThresholdMs);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  return { clearAll };
}
