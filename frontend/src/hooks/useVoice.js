import { useRef, useCallback, useState } from 'react';
import { API_BASE } from '../config';

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

  // Queue a sentence without canceling what's already playing
  const queueBrowser = useCallback((text) => {
    if (!synth || !text?.trim()) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.volume = 0.9;
    const preferred = getPreferredVoice();
    if (preferred) utter.voice = preferred;
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
  }, []);

  // Speak a full text, canceling any current speech first
  const speakBrowser = useCallback((text) => {
    if (!synth || !text) return;
    synth.cancel();
    queuedCount.current = 0;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.volume = 0.9;
    const preferred = getPreferredVoice();
    if (preferred) utter.voice = preferred;
    queuedCount.current = 1;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => { queuedCount.current = 0; setIsSpeaking(false); };
    utter.onerror = () => { queuedCount.current = 0; setIsSpeaking(false); };
    utteranceRef.current = utter;
    synth.speak(utter);
  }, []);

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

  // Feed streaming text chunks; speaks complete sentences as they arrive (browser TTS only)
  const speakChunk = useCallback((chunk) => {
    if (!enabled || !chunk || sessionData?.provider === 'openai') return;
    sentenceBuf.current += chunk;
    // Split on sentence-ending punctuation followed by whitespace
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

  return { speak, speakChunk, flushSentenceBuffer, stop, interrupt, isSpeaking };
}
