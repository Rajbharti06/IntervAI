import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MicButton from '../components/MicButton';
import MessageBubble from '../components/MessageBubble';

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

  // Initialize session data
  useEffect(() => {
    const stateData = location.state;
    if (stateData?.session_id) {
      setSessionData(stateData);
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

    // Check network status first
    if (!isOnline) {
      setNetworkError('Cannot generate question while offline. Please check your internet connection.');
      return;
    }

    setIsGeneratingQuestion(true);
    setErrors({});
    setNetworkError(null);

    try {
      const formData = new FormData();
      formData.append('session_id', sessionData.session_id);
      
      const response = await fetch('http://localhost:8000/interview/question', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMessage = `Server error (${response.status})`;
        try {
          const errJson = await response.clone().json();
          const detail = errJson?.detail || errJson?.message || errJson?.error;
          if (typeof detail === 'string' && detail.trim().length > 0) {
            if (detail.toLowerCase().includes('session not found')) {
              errorMessage = 'Your session is invalid or expired. Please go back to the setup screen and start a new interview.';
            } else {
              errorMessage = detail;
            }
          }
        } catch {}
        if (response.status === 404 && errorMessage === `Server error (404)`) {
          errorMessage = 'Interview service not found. Please check if the backend is running.';
        } else if (response.status === 500) {
          errorMessage = 'Internal server error. Please try again later.';
        } else if (response.status === 422) {
          errorMessage = 'Your session is invalid or expired. Please go back to the setup screen and start a new interview.';
        } else if (response.status === 400) {
          // Only fall back to generic message if backend did not provide a helpful detail
          if (!errorMessage || errorMessage === `Server error (400)`) {
            errorMessage = 'Bad request. Please restart the interview from the setup screen and try again.';
          }
        } else if (response.status >= 400 && response.status < 500 && !errorMessage) {
          errorMessage = 'Invalid request. Please refresh and try again.';
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const questionText = data.question || 'No question received';

      const questionMessage = {
        id: Date.now(),
        type: 'question',
        content: questionText,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, questionMessage]);
      setCurrentQuestion(questionMessage);
      setInterviewStats(prev => ({
        ...prev,
        questionsAsked: prev.questionsAsked + 1
      }));

    } catch (error) {
      console.error('Error generating question:', error);
      
      // Check if it's a network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setNetworkError('Cannot connect to the interview service. Please check if the backend is running on port 8000.');
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

    try {
      const formData = new FormData();
      formData.append('session_id', sessionData.session_id);
      formData.append('answer', userMessage.content);
      
      const response = await fetch('http://localhost:8000/interview/answer', {
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

          // Update average score
          setInterviewStats(prev => {
            const totalQuestions = prev.questionsAsked;
            const newAverage = totalQuestions > 0 
              ? ((prev.averageScore * (totalQuestions - 1)) + (feedbackMessage.score)) / totalQuestions
              : (feedbackMessage.score);
            return { ...prev, averageScore: newAverage };
          });

          setCurrentQuestion(null);
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
        // OK response handling
        const feedbackMessage = {
          id: Date.now() + 1,
          type: 'feedback',
          content: [
            (data && data.feedback) || 'No feedback received',
            data && data.correct_answer ? `\n\nCorrect answer:\n${data.correct_answer}` : ''
          ].filter(Boolean).join(''),
          score: (data && typeof data.score === 'number') ? data.score : 0,
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, feedbackMessage]);

        // Update average score
        setInterviewStats(prev => {
          const totalQuestions = prev.questionsAsked;
          const newAverage = totalQuestions > 0 
            ? ((prev.averageScore * (totalQuestions - 1)) + (feedbackMessage.score)) / totalQuestions
            : (feedbackMessage.score);
          return { ...prev, averageScore: newAverage };
        });

        setCurrentQuestion(null);
      }

    } catch (error) {
      console.error('Error sending answer:', error);
      
      // Check if it's a network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setNetworkError('Cannot connect to the interview service. Please check if the backend is running on port 8000.');
      } else {
        setErrors({ answer: error.message || 'Failed to send answer. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const endInterview = async () => {
    if (!sessionData?.session_id) return;

    const confirmEnd = window.confirm('Are you sure you want to end this interview? This action cannot be undone.');
    if (!confirmEnd) return;

    setErrors({});
    setNetworkError(null);

    try {
      const formData = new FormData();
      formData.append('session_id', sessionData.session_id);
      
      const response = await fetch('http://localhost:8000/interview/end', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMessage = `Server error (${response.status})`;
        if (response.status === 404) {
          errorMessage = 'End interview service not found. Please check if the backend is running.';
        } else if (response.status === 500) {
          errorMessage = 'Internal server error while ending interview.';
        }
        throw new Error(errorMessage);
      }

      // Mark session as ended
      try {
        const session = JSON.parse(localStorage.getItem('intervai_active_session') || '{}');
        session.lastEndedAt = Date.now();
        localStorage.setItem('intervai_active_session', JSON.stringify(session));
      } catch {}

      navigate('/summary', { 
        state: { 
          session_id: sessionData.session_id,
          stats: interviewStats,
          messages: messages
        } 
      });
    } catch (error) {
      console.error('Error ending interview:', error);
      
      // Check if it's a network error
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

      {/* Session Info */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-500">Domain</div>
              <div className="font-medium text-gray-900">{sessionData.domain}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Provider</div>
              <div className="font-medium text-gray-900 capitalize">{sessionData.provider}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Questions</div>
              <div className="font-medium text-gray-900">{interviewStats.questionsAsked}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Avg Score</div>
              <div className="font-medium text-gray-900">
                {interviewStats.averageScore > 0 ? `${interviewStats.averageScore.toFixed(1)}/100` : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Messages Area */}
          <div className="lg:col-span-3">
            <div className="card h-[600px] flex flex-col">
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

                <div className="flex space-x-4">
                  <div className="flex-1">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your answer here..."
                      className="form-input resize-none"
                      rows="3"
                      disabled={isLoading || !currentQuestion}
                    />
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={sendAnswer}
                      disabled={!input.trim() || isLoading || !currentQuestion}
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
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
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

              {/* Session Stats */}
              <div className="card">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Session Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Duration</span>
                      <span className="font-medium">{formatTime(interviewStats.totalTime)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Questions</span>
                      <span className="font-medium">{interviewStats.questionsAsked}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Avg Score</span>
                      <span className="font-medium">
                        {interviewStats.averageScore > 0 ? `${interviewStats.averageScore.toFixed(1)}/100` : 'N/A'}
                      </span>
                    </div>
                  </div>
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
