import React, { useState, useEffect } from 'react';

import axios from 'axios';

import { API_BASE } from '../config';
import { useNavigate } from 'react-router-dom';

function Setup() {
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [domain, setDomain] = useState('Software Engineering');
  const [model, setModel] = useState('');
  const [difficulty, setDifficulty] = useState('basic');
  const [timeLimitSec, setTimeLimitSec] = useState(120);
  const [stressMode, setStressMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const providers = [
    { 
      id: 'openai', 
      name: 'OpenAI', 
      icon: '🧠',
      description: 'GPT-4, GPT-3.5 Turbo',
      popular: true
    },
    { 
      id: 'anthropic', 
      name: 'Anthropic', 
      icon: '🧩',
      description: 'Claude 3.5 Sonnet, Claude 3 Opus',
      popular: true
    },
    { 
      id: 'google', 
      name: 'Google', 
      icon: '🔍',
      description: 'Gemini Pro, Gemini Flash',
      popular: false
    },
    { 
      id: 'perplexity', 
      name: 'Perplexity', 
      icon: '⚡',
      description: 'Llama 3.1 Sonar models',
      popular: false
    },
    { 
      id: 'grok', 
      name: 'Groq', 
      icon: '🚀',
      description: 'Fast inference models',
      popular: false
    },
    { 
      id: 'together_ai', 
      name: 'Together AI', 
      icon: '🤝',
      description: 'Open source models',
      popular: false
    }
  ];

  const domains = [
    // Technology & Engineering
    'Software Engineering',
    'Data Science',
    'Machine Learning',
    'Cloud Computing',
    'DevOps',
    'Frontend Development',
    'Backend Development',
    'Mobile Development',
    'Cybersecurity',
    'System Design',
    'Database Design',
    'Quality Assurance',
    'Network Engineering',
    'AI/ML Engineering',
    
    // Business & Management
    'Product Management',
    'Project Management',
    'Business Analysis',
    'Operations Management',
    'Strategy Consulting',
    'Business Development',
    'Supply Chain Management',
    'Risk Management',
    
    // Marketing & Sales
    'Digital Marketing',
    'Content Marketing',
    'Social Media Marketing',
    'Sales',
    'Account Management',
    'Brand Management',
    'Market Research',
    'SEO/SEM',
    
    // Finance & Accounting
    'Financial Analysis',
    'Investment Banking',
    'Corporate Finance',
    'Accounting',
    'Financial Planning',
    'Risk Analysis',
    'Auditing',
    'Tax',
    
    // Human Resources
    'Human Resources',
    'Talent Acquisition',
    'Organizational Development',
    'Compensation & Benefits',
    'Employee Relations',
    'Training & Development',
    
    // Design & Creative
    'UX/UI Design',
    'Graphic Design',
    'Web Design',
    'Product Design',
    'Creative Direction',
    'Content Creation',
    'Video Production',
    
    // Healthcare & Life Sciences
    'Healthcare Administration',
    'Clinical Research',
    'Pharmaceutical',
    'Medical Device',
    'Biotechnology',
    'Public Health',
    
    // Legal & Compliance
    'Legal',
    'Compliance',
    'Regulatory Affairs',
    'Contract Management',
    'Intellectual Property',
    
    // Customer Service & Support
    'Customer Success',
    'Customer Support',
    'Technical Support',
    'Client Relations',
    
    // Education & Training
    'Education',
    'Curriculum Development',
    'Educational Technology',
    
    // Other Professional Fields
    'Consulting',
    'Research & Development',
    'Logistics',
    'Real Estate',
    'Non-Profit',
    'Government',
    'Journalism',
    'Public Relations'
  ];

  const providerPlaceholders = {
    openai: 'e.g., gpt-4o, gpt-4o-mini, gpt-3.5-turbo',
    perplexity: 'e.g., llama-3.1-sonar-small-128k-online',
    grok: 'e.g., llama-3.3-70b-versatile',
    google: 'e.g., gemini-1.5-pro, gemini-1.5-flash',
    anthropic: 'e.g., claude-3-5-sonnet-20240620',
    together_ai: 'e.g., meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'
  };

  const difficultyOptions = [
    { id: 'basic', name: 'Basic', desc: 'Foundational questions' },
    { id: 'medium', name: 'Medium', desc: 'Intermediate complexity' },
    { id: 'hard', name: 'Hard', desc: 'Advanced/challenging' }
  ];

  const validateForm = () => {
    const newErrors = {};
    
    if (!apiKey.trim()) {
      newErrors.apiKey = 'API key is required';
    }
    
    if (!domain.trim()) {
      newErrors.domain = 'Domain/Subject is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const formData = new FormData();
      formData.append('provider', provider);
      formData.append('api_key', apiKey);
      formData.append('domain', domain);
      formData.append('difficulty', difficulty);
      if (model && model.trim().length > 0) {
        formData.append('model', model.trim());
      }

      const response = await axios.post(API_BASE + '/interview/start', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { session_id, model: usedModel } = response.data;

      // Persist active session
      try {
        localStorage.setItem(
          'intervai_active_session',
          JSON.stringify({ 
            session_id, 
            provider, 
            domain, 
            model: usedModel, 
            startedAt: Date.now() 
          })
        );
      } catch {}

      // Persist extras and navigate with state
      try {
        const existing = localStorage.getItem('intervai_active_session');
        const base = existing ? JSON.parse(existing) : {};
        localStorage.setItem(
          'intervai_active_session',
          JSON.stringify({
            ...base,
            session_id,
            provider,
            domain,
            model: usedModel,
            difficulty,
            timeLimitSec,
            stressMode,
            startedAt: base.startedAt || Date.now()
          })
        );
      } catch {}

      navigate('/interview', { 
        state: { session_id, provider, domain, model: usedModel, difficulty, timeLimitSec, stressMode } 
      });
    } catch (error) {
      console.error('Error starting interview:', error);
      const msg = error?.response?.data?.detail || error?.message || 'Unknown error';
      setErrors({ submit: `Failed to start interview: ${msg}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Check for existing session on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('intervai_active_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session?.session_id && !session?.lastEndedAt) {
          // Show option to resume
          const resume = window.confirm('You have an active interview session. Would you like to resume it?');
          if (resume) {
            navigate('/interview', { 
              state: { 
                session_id: session.session_id, 
                provider: session.provider, 
                domain: session.domain, 
                model: session.model 
              } 
            });
          }
        }
      }
    } catch {}
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          <div className="text-center animate-fadeIn">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              AI Interview
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> Platform</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Practice technical interviews with AI-powered questions tailored to your domain. 
              Get instant feedback and improve your interview skills.
            </p>
            <div className="flex items-center justify-center space-x-8 text-sm text-gray-500">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Real-time feedback
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                Multiple AI providers
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                Customizable difficulty
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="card card-hover animate-fadeIn">
          <div className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure Your Interview</h2>
              <p className="text-gray-600">Choose your AI provider, domain, and preferences</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Provider Selection */}
              <div>
                <label className="form-label">AI Provider</label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {providers.map((p) => (
                    <div
                      key={p.id}
                      className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all duration-200 ${
                        provider === p.id
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setProvider(p.id)}
                    >
                      {p.popular && (
                        <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                          Popular
                        </div>
                      )}
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{p.icon}</span>
                        <div>
                          <h3 className="font-medium text-gray-900">{p.name}</h3>
                          <p className="text-sm text-gray-500">{p.description}</p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="provider"
                        value={p.id}
                        checked={provider === p.id}
                        onChange={() => setProvider(p.id)}
                        className="sr-only"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="form-label">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className={`form-input ${errors.apiKey ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                  placeholder="Enter your provider API key (use 'demo' for offline mode)"
                />
                {errors.apiKey && (
                  <p className="mt-1 text-sm text-red-600">{errors.apiKey}</p>
                )}
                <p className="mt-2 text-sm text-gray-500">
                  Your API key is used only for this session and is not stored permanently.
                </p>
              </div>

              {/* Domain Selection */}
              <div>
                <label className="form-label">Interview Domain</label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className={`form-select ${errors.domain ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                >
                  {domains.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {errors.domain && (
                  <p className="mt-1 text-sm text-red-600">{errors.domain}</p>
                )}
              </div>

              {/* Model Override */}
              <div>
                <label className="form-label">Model (Optional)</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="form-input"
                  placeholder={providerPlaceholders[provider] || 'Enter model ID for the selected provider'}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Leave empty to use the provider's default model. Enter any valid model name for the chosen provider.
                </p>
              </div>

              {/* Difficulty Selection */}
              <div>
                <label className="form-label">Difficulty</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {difficultyOptions.map((d) => (
                    <div
                      key={d.id}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all duration-200 ${
                        difficulty === d.id ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setDifficulty(d.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{d.id === 'basic' ? '🌱' : d.id === 'medium' ? '🌳' : '🌴'}</span>
                        <div>
                          <h3 className="font-medium text-gray-900">{d.name}</h3>
                          <p className="text-sm text-gray-500">{d.desc}</p>
                        </div>
                      </div>
                      <input type="radio" name="difficulty" value={d.id} checked={difficulty === d.id} onChange={() => setDifficulty(d.id)} className="sr-only" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Management */}
              <div>
                <label className="form-label">Time per Question</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <input
                      type="number"
                      min={30}
                      max={900}
                      step={30}
                      value={timeLimitSec}
                      onChange={(e) => setTimeLimitSec(Math.max(30, Math.min(900, Number(e.target.value) || 120)))}
                      className="form-input pr-16"
                      placeholder="e.g., 120"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">seconds</span>
                  </div>
                  <div className="flex items-center space-x-3 bg-gray-50 rounded-lg p-4">
                    <input id="stressMode" type="checkbox" checked={stressMode} onChange={(e) => setStressMode(e.target.checked)} className="checkbox" />
                    <label htmlFor="stressMode" className="text-sm text-gray-700">Enable Stress Mode (tick sounds, intense timer)</label>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Set a realistic time limit to simulate pressure. Stress mode adds visual and audio cues.</p>
              </div>

              {/* Error Display */}
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{errors.submit}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary btn-lg min-w-[200px]"
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Starting Interview...
                    </div>
                  ) : (
                    'Start Interview'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center animate-fadeIn">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Instant Feedback</h3>
            <p className="text-gray-600">Get real-time evaluation of your answers with detailed feedback and scoring.</p>
          </div>
          
          <div className="text-center animate-fadeIn" style={{animationDelay: '0.1s'}}>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Adaptive Questions</h3>
            <p className="text-gray-600">Questions adapt to your skill level and chosen domain for optimal learning.</p>
          </div>
          
          <div className="text-center animate-fadeIn" style={{animationDelay: '0.2s'}}>
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Progress Tracking</h3>
            <p className="text-gray-600">Monitor your improvement over time with detailed analytics and insights.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Setup;



