import { useRef, useCallback, useState } from 'react';
import { API_BASE } from '../config';
import { getPersonality } from '../config/personality';

const synth = window.speechSynthesis;

function getPreferredVoice() {
  const voices = synth?.getVoices() || [];
  return (
    voices.find(v =>
      v.lang.startsWith('en') &&
      (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Alex'))
    ) || voices.find(v => v.lang.startsWith('en')) || null
  );
}

export function useVoice({ sessionData, enabled = true }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);
  const sentenceBuf = useRef('');
  const queuedCount = useRef(0);

  const persona = getPersonality(sessionData?.personality);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (synth) synth.cancel();
    sentenceBuf.current = '';
    queuedCount.current = 0;
    setIsSpeaking(false);
  }, []);

  // Build a configured utterance (no cancel, just queue)
  const makeUtterance = useCallback((text, rate) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate ?? persona.voiceRate;
    utter.pitch = 1;
    utter.volume = 0.9;
    const preferred = getPreferredVoice();
    if (preferred) utter.voice = preferred;
    return utter;
  }, [persona.voiceRate]);

  // Queue a sentence without canceling current speech
  const queueBrowser = useCallback((text, rate) => {
    if (!synth || !text?.trim()) return;
    const utter = makeUtterance(text, rate);
    queuedCount.current += 1;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => {
      queuedCount.current = Math.max(0, queuedCount.current - 1);
      if (queuedCount.current === 0) setIsSpeaking(false);
    };
    utter.onerror = () => {
      queuedCount.current = Math.max(0, queuedCount.current - 1);
      if (queuedCount.current === 0) setIsSpeaking(false);
    };
    synth.speak(utter);
  }, [makeUtterance]);

  // Speak a full text, canceling any current speech first
  const speakBrowser = useCallback((text) => {
    if (!synth || !text) return;
    synth.cancel();
    queuedCount.current = 0;
    const utter = makeUtterance(text);
    queuedCount.current = 1;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => { queuedCount.current = 0; setIsSpeaking(false); };
    utter.onerror = () => { queuedCount.current = 0; setIsSpeaking(false); };
    utteranceRef.current = utter;
    synth.speak(utter);
  }, [makeUtterance]);

  const speakOpenAI = useCallback(async (text) => {
    if (!text || !sessionData?.session_id) return;
    try {
      stop();
      setIsSpeaking(true);
      const fd = new FormData();
      fd.append('session_id', sessionData.session_id);
      fd.append('text', text);
      const res = await fetch(API_BASE + '/interview/speak', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('TTS unavailable');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
      await audio.play();
    } catch {
      speakBrowser(text);
    }
  }, [sessionData, stop, speakBrowser]);

  // Speak a complete response (call when full text is ready)
  const speak = useCallback((text) => {
    if (!enabled || !text) return;
    if (sessionData?.provider === 'openai') {
      speakOpenAI(text);
    } else {
      speakBrowser(text);
    }
  }, [enabled, sessionData, speakOpenAI, speakBrowser]);

  // Speak a nudge/interrupt with personality filler prefix ("Hmm...", "Noted.", etc.)
  // Uses queue (no cancel) — only call when AI is already silent
  const speakWithFiller = useCallback((text) => {
    if (!enabled || !text || sessionData?.provider === 'openai') return;
    const shouldFiller = persona.fillers.length > 0 && Math.random() < persona.fillerChance;
    if (shouldFiller) {
      const filler = persona.fillers[Math.floor(Math.random() * persona.fillers.length)];
      // Speak filler slightly slower for a natural thinking pause
      queueBrowser(filler, Math.max(0.7, persona.voiceRate - 0.1));
    }
    queueBrowser(text);
  }, [enabled, sessionData, persona, queueBrowser]);

  // Feed streaming text chunks — speaks complete sentences as they arrive (browser TTS only)
  const speakChunk = useCallback((chunk) => {
    if (!enabled || !chunk || sessionData?.provider === 'openai') return;
    sentenceBuf.current += chunk;
    const parts = sentenceBuf.current.split(/(?<=[.!?])\s+/);
    if (parts.length > 1) {
      const complete = parts.slice(0, -1);
      sentenceBuf.current = parts[parts.length - 1];
      complete.forEach(s => { if (s.trim().length > 5) queueBrowser(s.trim()); });
    }
  }, [enabled, sessionData, queueBrowser]);

  // Speak any text remaining in the sentence buffer (call when stream ends)
  const flushSentenceBuffer = useCallback(() => {
    if (!enabled || sessionData?.provider === 'openai') return;
    const remaining = sentenceBuf.current.trim();
    sentenceBuf.current = '';
    if (remaining.length > 2) queueBrowser(remaining);
  }, [enabled, sessionData, queueBrowser]);

  const interrupt = useCallback(() => {
    stop();
  }, [stop]);

  return { speak, speakWithFiller, speakChunk, flushSentenceBuffer, stop, interrupt, isSpeaking };
}
