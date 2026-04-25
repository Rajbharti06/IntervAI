import React, { useState, useRef, useCallback } from 'react';
import { API_BASE } from '../config';

const BROWSER_STT = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export default function MicButton({ onTranscript, provider, sessionId, disabled = false, onStartRecording }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);

  const stopAll = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // ── Browser Web Speech API (works for ALL providers, no API key) ─────────────
  const startBrowserSTT = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    let finalTranscript = '';

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += t;
        else interim += t;
      }
    };

    rec.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      if (finalTranscript.trim()) onTranscript(finalTranscript.trim());
    };

    rec.onerror = (e) => {
      setIsRecording(false);
      recognitionRef.current = null;
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError('Mic error: ' + e.error);
        setTimeout(() => setError(null), 3000);
      }
    };

    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
    onStartRecording?.();
  }, [onTranscript, onStartRecording]);

  // ── Whisper STT (OpenAI / Groq — records WebM blob, sends to backend) ────────
  const startWhisperSTT = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = rec;

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      rec.onstop = async () => {
        setIsProcessing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const fd = new FormData();
          fd.append('file', blob, 'audio.webm');
          fd.append('session_id', sessionId);
          const res = await fetch(API_BASE + '/interview/transcribe', { method: 'POST', body: fd });
          const data = await res.json();
          if (data.fallback || !data.text) {
            // API fallback — switch to browser STT silently
            startBrowserSTT();
          } else if (data.text) {
            onTranscript(data.text);
          }
        } catch {
          setError('Transcription failed. Try again.');
          setTimeout(() => setError(null), 3000);
        } finally {
          setIsProcessing(false);
        }
      };

      rec.start(100);
      setIsRecording(true);
      onStartRecording?.();
    } catch (err) {
      setError('Microphone access denied.');
      setTimeout(() => setError(null), 3000);
    }
  }, [sessionId, onTranscript, startBrowserSTT]);

  const handleClick = useCallback(async () => {
    setError(null);
    if (isRecording) {
      stopAll();
      return;
    }

    const useWhisper = (provider === 'openai' || provider === 'grok') && sessionId;
    if (useWhisper) {
      await startWhisperSTT();
    } else if (BROWSER_STT) {
      startBrowserSTT();
    } else {
      setError('Voice not supported in this browser. Use Chrome.');
      setTimeout(() => setError(null), 4000);
    }
  }, [isRecording, provider, sessionId, stopAll, startWhisperSTT, startBrowserSTT]);

  const isDisabled = disabled || isProcessing;

  return (
    <div className="relative flex flex-col items-center">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        title={isRecording ? 'Stop recording' : 'Start voice input'}
        className={[
          'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200',
          isRecording
            ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-lg shadow-red-200 ring-4 ring-red-200 animate-pulse'
            : isDisabled
            ? 'bg-gray-300 cursor-not-allowed opacity-60'
            : 'bg-blue-500 hover:bg-blue-600 hover:scale-105 shadow-md',
        ].join(' ')}
      >
        {isProcessing ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
        {isRecording && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full">
            <span className="absolute inset-0 bg-red-400 rounded-full animate-ping" />
          </span>
        )}
      </button>

      {isRecording && (
        <div className="absolute -bottom-7 whitespace-nowrap">
          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            Listening...
          </span>
        </div>
      )}
      {isProcessing && (
        <div className="absolute -bottom-7 whitespace-nowrap">
          <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">Transcribing...</span>
        </div>
      )}
      {error && (
        <div className="absolute -bottom-10 whitespace-nowrap">
          <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded border border-red-200">{error}</span>
        </div>
      )}
    </div>
  );
}
