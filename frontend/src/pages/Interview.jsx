import React, { useState, useEffect, useRef, useCallback } from 'react';

import { API_BASE } from '../config';
import { useLocation, useNavigate } from 'react-router-dom';
import MicButton from '../components/MicButton';
import MessageBubble from '../components/MessageBubble';
import GamificationBar from '../components/GamificationBar';
import StarMethodHelper from '../components/StarMethodHelper';
import { useVoice } from '../hooks/useVoice';
import { useAntiCheat } from '../hooks/useAntiCheat';
import { useSilenceDetector } from '../hooks/useSilenceDetector';

function Interview() {
  const location = useLocation();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [interviewStats, setInterviewStats] = useState({
    questionsAsked: 0,
    averageScore: 0,
    totalTime: 0,
    startTime: Date.now()
  });
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [errors, setErrors] = useState({});
  const [networkError, setNetworkError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const fileInputRef = useRef(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [showStarHelper, setShowStarHelper] = useState(false);
  const [sessionXp, setSessionXp] = useState(0);
  const [newBadges, setNewBadges] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [stressActive, setStressActive] = useState(false);
  const videoRef = useRef(null);
  const [mediaStream, setMediaStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const audioCtxRef = useRef(null);
  const lastBeepRef = useRef(null);

  // Voice & anti-cheat
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isFeedbackStreaming, setIsFeedbackStreaming] = useState(false);
  const { speak, speakChunk, flushSentenceBuffer, stop: stopSpeech, interrupt: interruptSpeech, isSpeaking } = useVoice({ sessionData, enabled: voiceEnabled });
  const { tabSwitches, totalViolations, integrityScore, riskLevel, riskColor, onPaste } = useAntiCheat({
    enabled: true,
    onViolation: (v) => console.warn('[AntiCheat]', v),
  });

  useSilenceDetector({
    currentQuestion,
    inputValue: input,
    isLoading: isLoading || isGeneratingQuestion,
    isSpeaking,
    enabled: voiceEnabled,
    onNudge: (phrase) => speak(phrase),
  });

  // Initialize session data
  useEffect(() => {
    const stateData = location.state;
    if (stateData?.session_id) {
      // Merge extras from localStorage if missing (resume flow)
      try {
        const raw = localStorage.getItem('intervai_active_session');
        const stored = raw ? JSON.parse(raw) : {};
        const merged = {
          ...stateData,
          difficulty: stateData.difficulty ?? stored.difficulty,
          timeLimitSec: stateData.timeLimitSec ?? stored.timeLimitSec,
          stressMode: stateData.stressMode ?? stored.stressMode,
        };
        setSessionData(merged);
      } catch {
        setSessionData(stateData);
      }
      return;
    }

    // Try to restore from localStorage
    try {
      const raw = localStorage.getItem('intervai_active_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session?.session_id && !session?.lastEndedAt) {
          setSessionData(session);
          return;
        }
      }
    } catch {}

    // No valid session found
    navigate('/');
  }, [location.state, navigate]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when not loading
  useEffect(() => {
    if (!isLoading && !isGeneratingQuestion) {
      inputRef.current?.focus();
    }
  }, [isLoading, isGeneratingQuestion]);

  // Update interview timer
  useEffect(() => {
    const interval = setInterval(() => {
      setInterviewStats(prev => ({
        ...prev,
        totalTime: Date.now() - prev.startTime
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkError(null);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setNetworkError('You are currently offline. Please check your internet connection.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Setup per-question timer when a new question arrives
  useEffect(() => {
    if (!currentQuestion || !sessionData) return;
    const limit = Number(sessionData.timeLimitSec || 0);
    if (!limit || limit <= 0) return;

    setIsTimeUp(false);
    setTimeLeft(limit);
    setStressActive(!!sessionData.stressMode);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = (prev || 0) - 1;
        if (next <= 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setIsTimeUp(true);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentQuestion, sessionData]);

  // Stress mode audio ticks (last 10s) and time-up cue
  const playBeep = (duration = 120, frequency = 880, volume = 0.05) => {
    try {
      const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        oscillator.disconnect();
        gainNode.disconnect();
      }, duration);
    } catch (e) {
      // ignore audio failures
    }
  };

  useEffect(() => {
    if (!stressActive) return;
    if (typeof timeLeft !== 'number') return;
    // Beep once per second in last 10s
    if (timeLeft > 0 && timeLeft <= 10 && lastBeepRef.current !== timeLeft) {
      lastBeepRef.current = timeLeft;
      playBeep(100, 900, 0.04);
    }
    // Final cue at time-up
    if (isTimeUp && lastBeepRef.current !== 'final') {
      lastBeepRef.current = 'final';
      playBeep(250, 600, 0.06);
    }
  }, [timeLeft, stressActive, isTimeUp]);

  // Camera controls
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setMediaStream(stream);
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera start failed:', err);
      setErrors(prev => ({ ...prev, camera: 'Unable to access camera. Check permissions.' }));
    }
  };

  const stopCamera = () => {
    try {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
      }
    } finally {
      setCameraOn(false);
      setMediaStream(null);
    }
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const generateQuestion = async () => {
    if (!sessionData?.session_id) return;
    if (!isOnline) {
      setNetworkError('Cannot generate question while offline.');
      return;
    }

    setIsGeneratingQuestion(true);
    setErrors({});
    setNetworkError(null);

    // ── Streaming path — uses SSE endpoint ───────────────────────────────────
    const msgId = Date.now();
    let accumulated = '';
    let streamSucceeded = false;

    try {
      const url = `${API_BASE}/interview/question/stream?session_id=${encodeURIComponent(sessionData.session_id)}`;
      const response = await fetch(url);

      if (response.ok && response.body) {
        // Optimistic placeholder so the user sees typing immediately
        setMessages(prev => [...prev, {
          id: msgId, type: 'question', content: '', timestamp: new Date().toISOString()
        }]);
        setInterviewStats(prev => ({ ...prev, questionsAsked: prev.questionsAsked + 1 }));

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6);
            if (raw === '[DONE]') { streamSucceeded = true; break; }
            if (raw.startsWith('[ERROR]')) {
              throw new Error(raw.slice(7) || 'Stream error');
            }
            try {
              const chunk = JSON.parse(raw);
              accumulated += chunk;
              speakChunk(chunk);
              setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, content: accumulated } : m
              ));
            } catch {
              // raw text not JSON (demo mode word-by-word)
              accumulated += raw;
              speakChunk(raw);
              setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, content: accumulated } : m
              ));
            }
          }
          if (streamSucceeded) break;
        }

        const finalMsg = { id: msgId, type: 'question', content: accumulated, timestamp: new Date().toISOString() };
        setMessages(prev => prev.map(m => m.id === msgId ? finalMsg : m));
        setCurrentQuestion(finalMsg);
        // For browser TTS: flush any remaining sentence in the buffer
        // For OpenAI: speak the full text now (TTS isn't streamed)
        if (sessionData?.provider === 'openai') {
          speak(accumulated);
        } else {
          flushSentenceBuffer();
        }
        setIsGeneratingQuestion(false);
        return;
      }
    } catch (streamErr) {
      // Fall through to non-streaming path
      console.warn('Streaming question failed, falling back:', streamErr);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      setInterviewStats(prev => ({ ...prev, questionsAsked: Math.max(0, prev.questionsAsked - 1) }));
    }

    // ── Non-streaming fallback ────────────────────────────────────────────────
    try {
      const formData = new FormData();
      formData.append('session_id', sessionData.session_id);
      const response = await fetch(API_BASE + '/interview/question', { method: 'POST', body: formData });

      if (!response.ok) {
        let errorMessage = `Server error (${response.status})`;
        try {
          const errJson = await response.clone().json();
          const detail = errJson?.detail || errJson?.message;
          if (typeof detail === 'string' && detail.trim()) errorMessage = detail;
        } catch {}
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const questionMessage = {
        id: Date.now(), type: 'question',
        content: data.question || 'No question received',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, questionMessage]);
      setCurrentQuestion(questionMessage);
      speak(questionMessage.content);
      setInterviewStats(prev => ({ ...prev, questionsAsked: prev.questionsAsked + 1 }));

    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setNetworkError('Cannot connect to the interview service. Please ensure the backend is running.');
      } else {
        setErrors({ question: error.message || 'Failed to generate question. Please try again.' });
      }
    } finally {
      setIsGeneratingQuestion(false);
    }
  };

  const sendAnswer = async () => {
    if (!input.trim() || !sessionData?.session_id || !currentQuestion) return;

    // Check network status first
    if (!isOnline) {
      setNetworkError('Cannot submit answer while offline. Please check your internet connection.');
      return;
    }

    const userMessage = {
      id: Date.now(),
      type: 'answer',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setErrors({});
    setNetworkError(null);
    stopSpeech(); // stop AI voice if still speaking

    try {
      const formData = new FormData();
      formData.append('session_id', sessionData.session_id);
      formData.append('answer', userMessage.content);
      
      const response = await fetch(API_BASE + '/interview/answer', {
        method: 'POST',
        body: formData
      });

      // Try to parse JSON regardless of status
      let data = null;
      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        // If backend provided evaluative data, surface it instead of a generic error
        if (data && (typeof data.score !== 'undefined' || data.feedback || data.correct_answer)) {
          const feedbackMessage = {
            id: Date.now() + 1,
            type: 'feedback',
            content: [
              data.feedback || 'No feedback received',
              data.correct_answer ? `\n\nCorrect answer:\n${data.correct_answer}` : ''
            ].filter(Boolean).join(''),
            score: typeof data.score === 'number' ? data.score : 0,
            timestamp: new Date().toISOString()
          };

          setMessages(prev => [...prev, feedbackMessage]);
          // Compute 1-10 scale for average
          const score10 = typeof feedbackMessage.score === 'number' ? (feedbackMessage.score <= 10 ? feedbackMessage.score : Math.round(feedbackMessage.score / 10)) : 0;

          // Update average score
          setInterviewStats(prev => {
            const totalQuestions = prev.questionsAsked;
            const newAverage = totalQuestions > 0 
              ? ((prev.averageScore * (totalQuestions - 1)) + score10) / totalQuestions
              : score10;
            return { ...prev, averageScore: newAverage };
          });

          setCurrentQuestion(null);
          setTimeLeft(null);
          setIsTimeUp(false);

          // Auto follow-up for lower scores
          if (score10 && score10 < 7) {
            await requestFollowup();
          }
        } else {
          let errorMessage = (data && (data.detail || data.message)) ? (data.detail || data.message) : `Server error (${response.status})`;
          if (!(data && (data.detail || data.message))) {
            if (response.status === 404) {
              errorMessage = 'Answer service not found. Please check if the backend is running.';
            } else if (response.status === 500) {
              errorMessage = 'Internal server error. Please try again later.';
            } else if (response.status >= 400 && response.status < 500) {
              // Provide more specific guidance for common 4xx statuses
              if (response.status === 400) {
                errorMessage = 'Bad request: please check your answer and try again.';
              } else if (response.status === 401 || response.status === 403) {
                errorMessage = 'Authentication error with provider API key. Please verify your key and provider.';
              } else if (response.status === 429) {
                errorMessage = 'Rate limit reached. Please wait a moment and try again.';
              } else {
                errorMessage = 'Request failed. Please try again.';
              }
            }
          }
          throw new Error(errorMessage);
        }
      } else {
        // Attach analysis to the user's answer message
        if (data?.analysis) {
          setMessages(prev => prev.map(m => m.id === userMessage.id ? { ...m, analysis: data.analysis } : m));
        }

        // XP earned this answer
        if (typeof data?.score === 'number') {
          const xpEarned = data.score * 10 + (data.analysis?.filler_word_count === 0 ? 15 : 0) + (data.analysis?.is_star_answer ? 20 : 0);
          setSessionXp(prev => prev + xpEarned);
        }

        const feedbackMessage = {
          id: Date.now() + 1,
          type: 'feedback',
          content: [
            (data && data.feedback) || 'No feedback received',
            data && data.correct_answer ? `\n\nCorrect answer:\n${data.correct_answer}` : ''
          ].filter(Boolean).join(''),
          score: (data && typeof data.score === 'number') ? data.score : 0,
          short_verdict: data?.short_verdict || null,
          improvement_tip: data?.improvement_tip || null,
          topic_tag: data?.topic_tag || null,
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, feedbackMessage]);
        const score10 = (feedbackMessage.score <= 10) ? feedbackMessage.score : Math.round(feedbackMessage.score / 10);

        // Speak short verdict
        const verdictText = feedbackMessage.short_verdict || (score10 >= 7 ? 'Good answer.' : 'Let me give you some feedback.');
        speak(verdictText);

        // Update average score
        setInterviewStats(prev => {
          const totalQuestions = prev.questionsAsked;
          const newAverage = totalQuestions > 0
            ? ((prev.averageScore * (totalQuestions - 1)) + score10) / totalQuestions
            : score10;
          return { ...prev, averageScore: newAverage };
        });

        setCurrentQuestion(null);
        setTimeLeft(null);
        setIsTimeUp(false);

        if (score10 && score10 < 7) {
          await requestFollowup();
        }
      }

    } catch (error) {
      console.error('Error sending answer:', error);
      
      // Check if it's a network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setNetworkError('Cannot connect to the interview service. Please ensure the backend is running and reachable.');
      } else {
        setErrors({ answer: error.message || 'Failed to send answer. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const requestFollowup = async () => {
    if (!sessionData?.session_id || !isOnline) return;
    try {
      const formData = new FormData();
      formData.append('session_id', sessionData.session_id);
      const response = await fetch(API_BASE + '/interview/followup', { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Follow-up failed (${response.status})`);
      const data = await response.json();
      const q = data.question || '';
      const message = { id: Date.now(), type: 'question', content: q, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, message]);
      setCurrentQuestion(message);
      setInterviewStats(prev => ({ ...prev, questionsAsked: prev.questionsAsked + 1 }));
      speak(q);
    } catch (err) {
      console.error('Follow-up error:', err);
    }
  };

  const uploadDocument = async (file) => {
    if (!file || !sessionData?.session_id) return;
    const allowed = ['.pdf', '.docx', '.txt', '.md'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setErrors(prev => ({ ...prev, upload: `Unsupported file type. Allowed: ${allowed.join(', ')}` }));
      return;
    }
    setIsUploading(true);
    setUploadMessage(null);
    setErrors(prev => ({ ...prev, upload: null }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('session_id', sessionData.session_id);
      const res = await fetch(API_BASE + '/interview/upload_document', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Upload failed');
      setUploadedFile({ name: file.name, topics: data.detected_topics || [] });
      setUploadMessage(data.message || 'Document uploaded. Questions will now draw from its content.');
    } catch (err) {
      setErrors(prev => ({ ...prev, upload: err.message || 'Failed to upload document.' }));
    } finally {
      setIsUploading(false);
    }
  };

  const endInterview = async () => {
    if (!sessionData?.session_id) return;

    const confirmEnd = window.confirm('Are you sure you want to end this interview? This action cannot be undone.');
    if (!confirmEnd) return;

    setErrors({});
    setNetworkError(null);

    let growthPlan = null;
    // Fetch growth plan before ending the session (non-blocking on failure)
    try {
      const gpFd = new FormData();
      gpFd.append('session_id', sessionData.session_id);
      const gpRes = await fetch(API_BASE + '/interview/growth_plan', { method: 'POST', body: gpFd });
      if (gpRes.ok) {
        const gpData = await gpRes.json();
        growthPlan = gpData?.growth_plan || null;
      }
    } catch {}

    try {
      const formData = new FormData();
      formData.append('session_id', sessionData.session_id);

      const response = await fetch(API_BASE + '/interview/end', {
        method: 'POST',
        body: formData
      });

      let summaryData = null;
      try { summaryData = await response.json(); } catch {}

      if (!response.ok) {
        let errorMessage = `Server error (${response.status})`;
        if (response.status === 404) {
          errorMessage = 'End interview service not found. Please check if the backend is running.';
        } else if (response.status === 500) {
          errorMessage = 'Internal server error while ending interview.';
        }
        throw new Error(errorMessage);
      }

      try {
        const session = JSON.parse(localStorage.getItem('intervai_active_session') || '{}');
        session.lastEndedAt = Date.now();
        localStorage.setItem('intervai_active_session', JSON.stringify(session));
      } catch {}

      // Save to dashboard history
      try {
        const raw = localStorage.getItem('intervai_history');
        const hist = raw ? JSON.parse(raw) : [];
        const overallScore = summaryData?.summary?.overall_score;
        hist.unshift({
          id: Date.now().toString(),
          at: Date.now(),
          subject: sessionData.domain,
          provider: sessionData.provider,
          score: typeof overallScore === 'number'
            ? Math.round(overallScore * 10)
            : Math.round(interviewStats.averageScore * 10),
          summary: summaryData?.summary,
          messages,
        });
        localStorage.setItem('intervai_history', JSON.stringify(hist.slice(0, 50)));
      } catch {}

      // Update cross-session user memory profile
      try {
        const qa = summaryData?.summary?.qa_pairs || [];
        const topicMap = {};
        qa.forEach(p => {
          const t = p.topic_tag || 'General';
          if (!topicMap[t]) topicMap[t] = [];
          topicMap[t].push(p.score || 0);
        });
        const existing = JSON.parse(localStorage.getItem('intervai_user_profile') || '{}');
        const mergedWeak = { ...(existing.topic_scores || {}), ...topicMap };
        const weakTopics = Object.entries(mergedWeak)
          .filter(([, scores]) => (scores.reduce((a, b) => a + b, 0) / scores.length) < 6.5)
          .map(([t]) => t).slice(0, 5);
        const strongTopics = Object.entries(mergedWeak)
          .filter(([, scores]) => (scores.reduce((a, b) => a + b, 0) / scores.length) >= 8)
          .map(([t]) => t).slice(0, 5);
        const updated = {
          weak_topics: weakTopics,
          strong_topics: strongTopics,
          topic_scores: mergedWeak,
          sessions_completed: (existing.sessions_completed || 0) + 1,
          last_domain: sessionData.domain,
          updated_at: Date.now(),
        };
        localStorage.setItem('intervai_user_profile', JSON.stringify(updated));
      } catch {}

      navigate('/summary', {
        state: {
          session_id: sessionData.session_id,
          stats: interviewStats,
          messages: messages,
          summary: summaryData?.summary,
          domain: sessionData.domain,
          growth_plan: growthPlan,
          integrity_score: integrityScore,
        }
      });
    } catch (error) {
      console.error('Error ending interview:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setNetworkError('Cannot connect to the interview service to end the session. You can still navigate away manually.');
      } else {
        setErrors({ end: error.message || 'Failed to end interview properly. You can still navigate away manually.' });
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAnswer();
    }
  };

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading interview session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">Interview Session</h1>
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Active</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Difficulty and Per-question limit badges */}
              <div className="hidden md:flex items-center space-x-3">
                {sessionData?.difficulty && (
                  <span className="px-2 py-1 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-200">
                    Difficulty: {String(sessionData.difficulty).charAt(0).toUpperCase() + String(sessionData.difficulty).slice(1)}
                  </span>
                )}
                {sessionData?.timeLimitSec ? (
                  <span className="px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
                    Per Q: {sessionData.timeLimitSec}s
                  </span>
                ) : null}
              </div>
              {/* Integrity Score */}
              <div
                className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                  riskLevel === 'high'   ? 'bg-red-50 text-red-700 border-red-200' :
                  riskLevel === 'medium' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                  riskLevel === 'low'    ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                  'bg-green-50 text-green-700 border-green-200'
                }`}
                title={`${tabSwitches} tab switch(es) · ${totalViolations} total flag(s)`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                {integrityScore}%
              </div>

              {/* Voice toggle */}
              <button
                onClick={() => { setVoiceEnabled(v => !v); if (isSpeaking) stopSpeech(); }}
                title={voiceEnabled ? 'Voice on — click to mute' : 'Voice off — click to enable'}
                className={`p-2 rounded-full transition-colors ${voiceEnabled ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
              >
                {voiceEnabled ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3-3m3 3l3-3M6.343 6.343A8 8 0 1017.657 17.657"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
                  </svg>
                )}
              </button>

              {/* Speaking indicator */}
              {isSpeaking && (
                <div className="flex items-center gap-1 text-xs text-indigo-600">
                  <span className="flex gap-0.5">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1 bg-indigo-500 rounded-full animate-bounce" style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </span>
                  <span className="hidden sm:inline">Speaking</span>
                </div>
              )}

              <div className="interview-timer">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatTime(interviewStats.totalTime)}</span>
              </div>

              <button
                onClick={endInterview}
                className="btn btn-secondary btn-sm"
              >
                End Interview
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Gamification Bar */}
      <GamificationBar sessionXp={sessionXp} newBadges={newBadges} />

      {/* Main Content */}
      <div className="w-[95%] max-w-[1400px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 int900:grid-cols-[1fr_320px] gap-6">
          {/* Messages Area */}
          <div>
            <div className="card flex flex-col" style={{height: '70vh', minHeight: '520px'}}>
              {/* AI Presence Zone */}
              {(() => {
                const aiState = isGeneratingQuestion ? 'thinking'
                  : isLoading ? 'evaluating'
                  : isSpeaking ? 'speaking'
                  : currentQuestion ? 'waiting'
                  : 'idle';
                const stateConfig = {
                  thinking:   { dot: 'bg-yellow-400', ring: 'ring-yellow-300', bg: 'from-yellow-50 to-amber-50',   label: 'Thinking...', sub: 'Composing your next question' },
                  evaluating: { dot: 'bg-red-400',    ring: 'ring-red-300',    bg: 'from-red-50 to-orange-50',     label: 'Evaluating...', sub: 'Reading your answer carefully' },
                  speaking:   { dot: 'bg-green-400',  ring: 'ring-green-300',  bg: 'from-green-50 to-emerald-50',  label: 'Speaking', sub: 'Listen to the question' },
                  waiting:    { dot: 'bg-blue-400',   ring: 'ring-blue-200',   bg: 'from-blue-50 to-indigo-50',    label: 'Waiting', sub: 'Ready for your answer' },
                  idle:       { dot: 'bg-gray-300',   ring: 'ring-gray-200',   bg: 'from-gray-50 to-slate-50',     label: 'AI Interviewer', sub: 'Click Generate Question to begin' },
                };
                const cfg = stateConfig[aiState];
                const isActive = aiState !== 'idle' && aiState !== 'waiting';
                return (
                  <div className={`border-b border-gray-100 px-5 py-3 flex items-center gap-3 bg-gradient-to-r ${cfg.bg} rounded-t-xl flex-shrink-0`}>
                    {/* Animated AI Avatar */}
                    <div className={`relative flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md ${isActive ? `ring-2 ${cfg.ring} ring-offset-2` : ''}`}>
                      {isActive && (
                        <span className={`absolute inset-0 rounded-full ${cfg.dot} animate-ping opacity-25`} />
                      )}
                      {/* SVG face — eyes animate on state */}
                      <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none">
                        {/* Face */}
                        <circle cx="20" cy="20" r="18" fill="white" fillOpacity="0.15"/>
                        {/* Eyes */}
                        {aiState === 'thinking' ? (
                          <>
                            <ellipse cx="14" cy="17" rx="3" ry="2" fill="white" opacity="0.9">
                              <animate attributeName="ry" values="2;0.5;2" dur="1.2s" repeatCount="indefinite"/>
                            </ellipse>
                            <ellipse cx="26" cy="17" rx="3" ry="2" fill="white" opacity="0.9">
                              <animate attributeName="ry" values="2;0.5;2" dur="1.2s" begin="0.6s" repeatCount="indefinite"/>
                            </ellipse>
                          </>
                        ) : aiState === 'speaking' ? (
                          <>
                            <circle cx="14" cy="17" r="3" fill="white" opacity="0.9"/>
                            <circle cx="26" cy="17" r="3" fill="white" opacity="0.9"/>
                            {/* Mouth waveform */}
                            <rect x="12" y="24" width="2" height="4" rx="1" fill="white" opacity="0.8">
                              <animate attributeName="height" values="2;6;2" dur="0.4s" repeatCount="indefinite"/>
                            </rect>
                            <rect x="16" y="22" width="2" height="7" rx="1" fill="white" opacity="0.9">
                              <animate attributeName="height" values="3;8;3" dur="0.5s" begin="0.1s" repeatCount="indefinite"/>
                            </rect>
                            <rect x="20" y="23" width="2" height="5" rx="1" fill="white" opacity="0.8">
                              <animate attributeName="height" values="2;6;2" dur="0.45s" begin="0.2s" repeatCount="indefinite"/>
                            </rect>
                            <rect x="24" y="22" width="2" height="7" rx="1" fill="white" opacity="0.9">
                              <animate attributeName="height" values="3;7;3" dur="0.38s" begin="0.05s" repeatCount="indefinite"/>
                            </rect>
                          </>
                        ) : aiState === 'evaluating' ? (
                          <>
                            <circle cx="14" cy="17" r="3" fill="white" opacity="0.9"/>
                            <circle cx="26" cy="17" r="3" fill="white" opacity="0.9"/>
                            {/* Thinking dots as mouth */}
                            <circle cx="14" cy="27" r="1.5" fill="white" opacity="0.7">
                              <animate attributeName="opacity" values="0.3;0.9;0.3" dur="0.9s" repeatCount="indefinite"/>
                            </circle>
                            <circle cx="20" cy="27" r="1.5" fill="white" opacity="0.7">
                              <animate attributeName="opacity" values="0.3;0.9;0.3" dur="0.9s" begin="0.3s" repeatCount="indefinite"/>
                            </circle>
                            <circle cx="26" cy="27" r="1.5" fill="white" opacity="0.7">
                              <animate attributeName="opacity" values="0.3;0.9;0.3" dur="0.9s" begin="0.6s" repeatCount="indefinite"/>
                            </circle>
                          </>
                        ) : (
                          <>
                            <circle cx="14" cy="17" r="3" fill="white" opacity="0.9"/>
                            <circle cx="26" cy="17" r="3" fill="white" opacity="0.9"/>
                            <path d="M13 26 Q20 31 27 26" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8"/>
                          </>
                        )}
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{cfg.label}</span>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      </div>
                      <div className="text-xs text-gray-500">{cfg.sub}</div>
                    </div>
                    <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                      {currentQuestion && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                          Q{interviewStats.questionsAsked}
                        </span>
                      )}
                      {aiState === 'thinking' && (
                        <span className="flex gap-1 items-center">
                          {[0,1,2].map(i => (
                            <span key={i} className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce" style={{animationDelay: `${i*0.18}s`}} />
                          ))}
                        </span>
                      )}
                      {aiState === 'evaluating' && (
                        <span className="flex gap-1 items-center">
                          {[0,1,2].map(i => (
                            <span key={i} className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{animationDelay: `${i*0.18}s`}} />
                          ))}
                        </span>
                      )}
                      {aiState === 'speaking' && (
                        <span className="flex gap-0.5 items-end">
                          {[5,9,7,11,6].map((h, i) => (
                            <span key={i} className="w-1 bg-green-500 rounded-full animate-bounce" style={{height: `${h}px`, animationDelay: `${i*0.1}s`}} />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.013 8.013 0 01-7-4L5 20l4-1a8.014 8.014 0 01-2-7c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Start</h3>
                    <p className="text-gray-600 mb-6">Click "Generate Question" to begin your interview session.</p>
                    <button
                      onClick={generateQuestion}
                      disabled={isGeneratingQuestion}
                      className="btn btn-primary"
                    >
                      {isGeneratingQuestion ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Generating...
                        </div>
                      ) : (
                        'Generate Question'
                      )}
                    </button>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 p-6">
                {/* Per-question Timer */}
                {currentQuestion && timeLeft !== null && (
                  <div className={`mb-4 flex items-center justify-between ${isTimeUp ? 'bg-red-50 border border-red-200 rounded-lg p-3' : ''}`}>
                    <div className="flex items-center space-x-2">
                      <svg className={`w-5 h-5 ${isTimeUp ? 'text-red-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className={`text-sm ${isTimeUp ? 'text-red-700 font-medium' : 'text-gray-700'}`}>
                        {isTimeUp ? 'Time\'s up for this question.' : `Time left: ${timeLeft}s`}
                      </span>
                    </div>
                    {!isTimeUp && stressActive && timeLeft <= 10 && (
                      <span className="text-xs text-red-600 animate-pulse">Focus — last 10s</span>
                    )}
                  </div>
                )}
                {/* Network Error Display */}
                {networkError && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-800">{networkError}</p>
                    </div>
                  </div>
                )}
                
                {/* Offline Status */}
                {!isOnline && (
                  <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-yellow-800">You are currently offline. Some features may not work.</p>
                    </div>
                  </div>
                )}

                {/* Question Generation Error */}
                {errors.question && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-800">{errors.question}</p>
                    </div>
                  </div>
                )}
                
                {errors.answer && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">{errors.answer}</p>
                  </div>
                )}

                {/* Document upload feedback */}
                {uploadedFile && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span><strong>{uploadedFile.name}</strong> — {uploadMessage || 'Questions will draw from this document.'}</span>
                  </div>
                )}
                {errors.upload && (
                  <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errors.upload}</div>
                )}

                <div className="flex space-x-4">
                  <div className="flex-1">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      onPaste={onPaste}
                      placeholder="Type your answer here... (or upload a PDF/DOCX to practice from it)"
                      className="form-input resize-none"
                      rows="4"
                      style={{fontSize: '16px', minHeight: '80px'}}
                      disabled={isLoading || !currentQuestion || isTimeUp}
                    />
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadDocument(f);
                        e.target.value = '';
                      }}
                    />
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || !sessionData?.session_id}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-40"
                      title="Upload PDF, DOCX, or TXT — AI will generate questions from it"
                    >
                      {isUploading ? (
                        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      )}
                      {isUploading ? 'Uploading...' : (uploadedFile ? `Change file (${uploadedFile.name})` : 'Attach PDF / DOCX / TXT')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowStarHelper(v => !v)}
                      className={`flex items-center gap-1 text-xs transition-colors ${showStarHelper ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
                      title="STAR method guide for behavioral questions"
                    >
                      <span>⭐</span>
                      STAR Helper
                    </button>
                    {/* Word count — turns amber at 80w, red at 130w */}
                    {(() => {
                      const wc = input.trim() ? input.trim().split(/\s+/).filter(Boolean).length : 0;
                      if (wc < 20) return null;
                      const isVerbose = wc >= 130;
                      const isWarning = wc >= 80;
                      return (
                        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                          isVerbose ? 'bg-red-100 text-red-700' : isWarning ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                        }`} title={isVerbose ? 'Very long — be more concise' : isWarning ? 'Getting long — consider trimming' : ''}>
                          {wc}w{isVerbose ? ' — be concise' : isWarning ? ' — trim if possible' : ''}
                        </span>
                      );
                    })()}
                    </div>
                    <StarMethodHelper visible={showStarHelper} />
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={sendAnswer}
                      disabled={!input.trim() || isLoading || !currentQuestion || isTimeUp}
                      className="btn btn-primary"
                    >
                      {isLoading ? (
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        'Send'
                      )}
                    </button>
                    
                    <MicButton
                      onTranscript={(text) => setInput(text)}
                      provider={sessionData.provider}
                      sessionId={sessionData.session_id}
                      onStartRecording={interruptSpeech}
                    />
                    <button
                      onClick={requestFollowup}
                      disabled={isGeneratingQuestion || !sessionData?.session_id}
                      className="btn btn-outline"
                    >
                      Ask Follow-Up
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="space-y-4">
              {/* Session Info */}
              <div className="card">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Session</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Domain</span>
                      <span className="font-medium text-gray-900 text-right max-w-[160px] truncate">{sessionData.domain}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Provider</span>
                      <span className="font-medium text-gray-900 capitalize">{sessionData.provider}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Duration</span>
                      <span className="font-medium">{formatTime(interviewStats.totalTime)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Questions</span>
                      <span className="font-medium">{interviewStats.questionsAsked}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Avg Score</span>
                      <span className="font-medium">
                        {interviewStats.averageScore > 0 ? `${interviewStats.averageScore.toFixed(1)}/10` : 'N/A'}
                      </span>
                    </div>
                    {sessionData?.difficulty && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Difficulty</span>
                        <span className="font-medium capitalize">{sessionData.difficulty}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="card">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
                  <div className="space-y-2">
                    <button
                      onClick={generateQuestion}
                      disabled={isGeneratingQuestion || currentQuestion}
                      className="w-full btn btn-outline btn-sm"
                    >
                      {isGeneratingQuestion ? 'Generating...' : 'New Question'}
                    </button>
                    <button
                      onClick={() => setInput('')}
                      className="w-full btn btn-outline btn-sm"
                    >
                      Clear Input
                    </button>
                  </div>
                </div>
              </div>

              {/* Camera Preview */}
              <div className="card">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Camera Preview</h3>
                  <div className="rounded-lg overflow-hidden bg-black" style={{height: '180px'}}>
                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  </div>
                  <div className="mt-3 flex space-x-2">
                    {!cameraOn ? (
                      <button onClick={startCamera} className="btn btn-outline btn-xs">Start Camera</button>
                    ) : (
                      <button onClick={stopCamera} className="btn btn-outline btn-xs">Stop Camera</button>
                    )}
                  </div>
                  {errors.camera && (
                    <p className="mt-2 text-xs text-red-600">{errors.camera}</p>
                  )}
                </div>
              </div>

              {/* Tips */}
              <div className="card">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Tips</h3>
                  <div className="space-y-2 text-xs text-gray-600">
                    <p>• Be specific and detailed in your answers</p>
                    <p>• Use examples from your experience</p>
                    <p>• Think out loud to show your process</p>
                    <p>• Ask clarifying questions if needed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Interview;


