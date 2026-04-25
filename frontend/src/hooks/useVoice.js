import { useRef, useCallback, useState } from 'react';
import { API_BASE } from '../config';

const synth = window.speechSynthesis;

export function useVoice({ sessionData, enabled = true }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (synth) synth.cancel();
    setIsSpeaking(false);
  }, []);

  const speakBrowser = useCallback((text) => {
    if (!synth || !text) return;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.volume = 0.9;
    // Pick a natural English voice if available
    const voices = synth.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Alex'))
    ) || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utter.voice = preferred;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
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

  const speak = useCallback((text) => {
    if (!enabled || !text) return;
    const useOpenAI = sessionData?.provider === 'openai';
    if (useOpenAI) {
      speakOpenAI(text);
    } else {
      speakBrowser(text);
    }
  }, [enabled, sessionData, speakOpenAI, speakBrowser]);

  // Call this when mic recording starts — interrupts AI speech instantly
  const interrupt = useCallback(() => {
    stop();
  }, [stop]);

  return { speak, stop, interrupt, isSpeaking };
}
