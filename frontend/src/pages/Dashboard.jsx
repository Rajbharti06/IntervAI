import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = () => {
    try {
      const raw = localStorage.getItem('intervai_history');
      const arr = raw ? JSON.parse(raw) : [];
      setHistory(Array.isArray(arr) ? arr : []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // If summary was provided via navigation, ensure it's in history already
  useEffect(() => {
    if (location.state?.summary) {
      // We already store on endInterview; just reload
      loadHistory();
    }
  }, [location.state]);

  const hasItems = history.length > 0;

  const clearAll = () => {
    if (!hasItems) return;
    if (confirm('Clear all interview history?')) {
      try { localStorage.removeItem('intervai_history'); } catch {}
      setHistory([]);
    }
  };

  const deleteOne = (id) => {
    try {
      const filtered = history.filter((h) => h.id !== id);
      localStorage.setItem('intervai_history', JSON.stringify(filtered));
      setHistory(filtered);
    } catch {}
  };

  const formatDate = (ts) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getScoreGrade = (score) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  };

  const avgScore = useMemo(() => {
    if (!hasItems) return 0;
    const total = history.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
    return Math.round((total / history.length) * 10) / 10;
  }, [history, hasItems]);

  const stats = useMemo(() => {
    if (!hasItems) return { total: 0, avgScore: 0, bestScore: 0, recentScore: 0 };
    
    const scores = history.map(h => Number(h.score) || 0);
    return {
      total: history.length,
      avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      bestScore: Math.max(...scores),
      recentScore: scores[scores.length - 1] || 0
    };
  }, [history, hasItems]);

  const trendData = useMemo(() => {
    const labels = history.map((h, i) => `Interview ${i + 1}`);
    const data = history.map((h) => Number(h.score) || 0);
    return {
      labels,
      datasets: [
        {
          label: 'Score',
          data,
          tension: 0.4,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
        },
      ],
    };
  }, [history]);

  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#6366f1',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (context) => `Interview ${context[0].dataIndex + 1}`,
          label: (context) => `Score: ${context.parsed.y}/100`
        }
      },
    },
    scales: {
      x: { 
        grid: { display: false },
        ticks: { color: '#6b7280' }
      },
      y: { 
        beginAtZero: true, 
        max: 100,
        grid: { color: 'rgba(107, 114, 128, 0.1)' },
        ticks: { color: '#6b7280' }
      },
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Interview Dashboard
          </h1>
          <p className="text-gray-600">
            Track your interview performance and progress over time
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Interviews</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Score</p>
                <p className="text-3xl font-bold text-gray-900">{stats.avgScore}</p>
                <p className="text-sm text-gray-500">Grade: {getScoreGrade(stats.avgScore)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Best Score</p>
                <p className="text-3xl font-bold text-gray-900">{stats.bestScore}</p>
                <p className="text-sm text-gray-500">Grade: {getScoreGrade(stats.bestScore)}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Recent Score</p>
                <p className="text-3xl font-bold text-gray-900">{stats.recentScore}</p>
                <p className="text-sm text-gray-500">Grade: {getScoreGrade(stats.recentScore)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        {hasItems && (
          <div className="glass-card p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Performance Trend</h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={clearAll}
                  className="btn-secondary text-sm"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="h-64 sm:h-80">
              <Line data={trendData} options={trendOptions} />
            </div>
          </div>
        )}

        {/* Interview History */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Interview History</h2>
            {hasItems && (
              <span className="text-sm text-gray-500">{history.length} interview{history.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {!hasItems ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No interviews yet</h3>
              <p className="text-gray-600 mb-6">Start your first interview to see your performance data here.</p>
              <button
                onClick={() => navigate('/interview')}
                className="btn-primary"
              >
                Start Your First Interview
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
              {history.map((item, index) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {item.subject}
                        </h3>
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full capitalize">
                          {item.provider}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{formatDate(item.at)}</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getScoreColor(item.score)}`}>
                          {item.score}/100 ({getScoreGrade(item.score)})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => navigate('/summary', { 
                          state: { 
                            summary: item.summary, 
                            domain: item.subject, 
                            messages: item.messages || [] 
                          } 
                        })}
                        className="btn-primary text-sm"
                      >
                        View Summary
                      </button>
                      <button
                        onClick={() => deleteOne(item.id)}
                        className="btn-secondary text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}