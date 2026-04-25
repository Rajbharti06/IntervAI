import React, { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';

function Summary() {
  const location = useLocation();
  const navigate = useNavigate();
  const summary = location.state?.summary;
  const domain = location.state?.domain || 'Interview';
  const messages = Array.isArray(location.state?.messages) ? location.state.messages : [];
  const growthPlan = location.state?.growth_plan || null;
  const gamification = summary?.gamification || null;
  const commStats = summary?.communication_stats || null;
  const [isDownloading, setIsDownloading] = useState(false);

  const contentRef = useRef(null);

  const downloadPdf = async () => {
    setIsDownloading(true);
    try {
      const element = contentRef.current;
      const opt = {
        margin: 0.5,
        filename: `${domain}_Interview_Summary_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      await html2pdf().from(element).set(opt).save();
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 6) return 'text-yellow-600 bg-yellow-100';
    if (score >= 4) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreGrade = (score) => {
    if (score >= 9) return 'Excellent';
    if (score >= 8) return 'Very Good';
    if (score >= 7) return 'Good';
    if (score >= 6) return 'Fair';
    if (score >= 5) return 'Below Average';
    return 'Needs Improvement';
  };

  const hasSummary = !!summary;
  const hasPairs = !!summary?.qa_pairs?.length;
  const hasMessages = messages.length > 0;

  if (!hasSummary && !hasMessages) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Summary Available</h2>
          <p className="text-gray-600 mb-6">No interview summary or transcript was found.</p>
          <button 
            onClick={() => navigate('/dashboard')} 
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const weakAreasIsObject = summary && summary.weak_areas && typeof summary.weak_areas === 'object' && !Array.isArray(summary.weak_areas) && Object.keys(summary.weak_areas).length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl mb-8 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Interview Summary</h1>
              <p className="text-gray-600">{domain} • {new Date().toLocaleDateString()}</p>
            </div>
            <div className="flex space-x-3 mt-4 sm:mt-0">
              <button
                onClick={downloadPdf}
                disabled={isDownloading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDownloading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                <span>{isDownloading ? 'Generating...' : 'Download PDF'}</span>
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>New Interview</span>
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                </svg>
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content for PDF */}
        <div ref={contentRef} className="space-y-8">
          {/* Gamification Summary */}
          {gamification && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-yellow-500 text-lg">🏆</span>
                </div>
                Session Results
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center bg-indigo-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-indigo-700">+{gamification.total_xp}</div>
                  <div className="text-xs text-indigo-500 mt-1">XP Earned</div>
                </div>
                <div className="text-center bg-blue-50 rounded-xl p-4">
                  <div className="text-2xl">{gamification.level?.icon || '🌱'}</div>
                  <div className="text-xs font-medium text-blue-700 mt-1">{gamification.level?.name}</div>
                </div>
                <div className="text-center bg-green-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-green-700">{gamification.average_score}/10</div>
                  <div className="text-xs text-green-500 mt-1">Avg Score</div>
                </div>
                <div className="text-center bg-purple-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-purple-700">{gamification.questions_answered}</div>
                  <div className="text-xs text-purple-500 mt-1">Questions</div>
                </div>
              </div>
              {gamification.badges_earned?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Badges Earned</h3>
                  <div className="flex flex-wrap gap-3">
                    {gamification.badges_earned.map(b => (
                      <div key={b.key} className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
                        <span className="text-xl">{b.icon}</span>
                        <div>
                          <div className="text-xs font-semibold text-gray-800">{b.name}</div>
                          <div className="text-xs text-gray-500">{b.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {commStats && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Communication Stats</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Avg Filler Rate', value: `${commStats.avg_filler_rate}%`, color: commStats.avg_filler_rate > 10 ? 'text-red-600' : 'text-green-600' },
                      { label: 'Avg Confidence', value: `${commStats.avg_confidence_score}/10`, color: 'text-blue-600' },
                      { label: 'Avg Clarity', value: `${commStats.avg_clarity_score}/10`, color: 'text-purple-600' },
                      { label: 'Avg Word Count', value: commStats.avg_word_count, color: 'text-gray-700' },
                      { label: 'STAR Answers', value: commStats.star_answers, color: 'text-yellow-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-3">
                        <div className={`text-xl font-bold ${color}`}>{value}</div>
                        <div className="text-xs text-gray-500">{label}</div>
                      </div>
                    ))}
                    {commStats.top_fillers?.length > 0 && (
                      <div className="bg-red-50 rounded-lg p-3">
                        <div className="text-xs font-semibold text-red-700 mb-1">Top Filler Words</div>
                        <div className="flex flex-wrap gap-1">
                          {commStats.top_fillers.map(w => (
                            <span key={w} className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">"{w}"</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Growth Plan */}
          {growthPlan && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                Your 7-Day Growth Plan
              </h2>

              {growthPlan.overall_assessment && (
                <p className="text-gray-700 mb-6 leading-relaxed">{growthPlan.overall_assessment}</p>
              )}

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {Array.isArray(growthPlan.top_strengths) && growthPlan.top_strengths.length > 0 && (
                  <div className="bg-green-50 rounded-xl p-4">
                    <h3 className="font-semibold text-green-900 mb-3">Your Strengths</h3>
                    <ul className="space-y-1">
                      {growthPlan.top_strengths.map((s, i) => (
                        <li key={i} className="flex items-start text-sm text-green-800">
                          <span className="mr-2 mt-0.5 text-green-500">✓</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(growthPlan.top_gaps) && growthPlan.top_gaps.length > 0 && (
                  <div className="bg-amber-50 rounded-xl p-4">
                    <h3 className="font-semibold text-amber-900 mb-3">Focus Areas</h3>
                    <ul className="space-y-1">
                      {growthPlan.top_gaps.map((g, i) => (
                        <li key={i} className="flex items-start text-sm text-amber-800">
                          <span className="mr-2 mt-0.5">→</span>{g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {Array.isArray(growthPlan.daily_plan) && growthPlan.daily_plan.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Daily Practice Plan</h3>
                  <div className="grid gap-3">
                    {growthPlan.daily_plan.map((day) => (
                      <div key={day.day} className="flex gap-4 bg-gray-50 rounded-xl p-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                          D{day.day}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-900 text-sm">{day.focus}</span>
                            {day.time_minutes && (
                              <span className="text-xs text-gray-400">{day.time_minutes} min</span>
                            )}
                          </div>
                          {Array.isArray(day.tasks) && (
                            <ul className="space-y-0.5">
                              {day.tasks.map((t, ti) => (
                                <li key={ti} className="text-xs text-gray-600 flex items-start">
                                  <span className="mr-1.5 text-gray-400">•</span>{t}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(growthPlan.recommended_resources) && growthPlan.recommended_resources.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Recommended Resources</h3>
                  <div className="space-y-2">
                    {growthPlan.recommended_resources.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 bg-indigo-50 rounded-lg p-3">
                        <span className="text-indigo-500 text-xs font-medium uppercase mt-0.5 flex-shrink-0 bg-indigo-100 px-1.5 py-0.5 rounded">
                          {r.type || 'resource'}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-indigo-900">{r.title}</div>
                          {r.reason && <div className="text-xs text-indigo-700 mt-0.5">{r.reason}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {growthPlan.motivational_message && (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white text-center">
                  <p className="font-medium italic">"{growthPlan.motivational_message}"</p>
                </div>
              )}
            </div>
          )}

          {hasSummary && (
            <>
              {/* Performance Overview */}
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  Overall Performance
                </h2>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Summary</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-bold text-gray-900">{summary.overall_score ?? 'N/A'}</div>
                        <div className="text-sm text-gray-600">out of 10</div>
                      </div>
                      {typeof summary.overall_score === 'number' && (
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(summary.overall_score)}`}>
                          {getScoreGrade(summary.overall_score)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Stats</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Questions Asked:</span>
                        <span className="font-medium">{summary.qa_pairs?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Domain:</span>
                        <span className="font-medium">{domain}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium">{new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Weak Areas */}
                {(Array.isArray(summary.weak_areas) && summary.weak_areas.length > 0) && (
                  <div className="mt-6 bg-red-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Areas for Improvement
                    </h3>
                    <ul className="space-y-2">
                      {summary.weak_areas.map((area, idx) => (
                        <li key={idx} className="flex items-start">
                          <div className="w-2 h-2 bg-red-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                          <span className="text-red-800">{area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {weakAreasIsObject && (
                  <div className="mt-6 bg-red-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Detailed Areas for Improvement
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(summary.weak_areas).map(([topic, entries]) => (
                        <div key={topic} className="bg-white rounded-lg p-4">
                          <h4 className="font-semibold text-red-900 mb-2">{topic}</h4>
                          {Array.isArray(entries) && entries.length > 0 && (
                            <div className="space-y-2">
                              {entries.map((e, i) => (
                                <div key={i} className="text-sm text-red-800 bg-red-100 rounded p-2">
                                  {e?.question && <div className="font-medium">Q: {e.question}</div>}
                                  {e?.improvement_tips && <div className="mt-1">💡 {e.improvement_tips}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Interview Transcript */}
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.013 8.013 0 01-7-4L5 20l4-1a8.014 8.014 0 01-2-7c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                    </svg>
                  </div>
                  Interview Transcript
                </h2>

                {hasPairs ? (
                  <div className="space-y-6">
                    {summary.qa_pairs.map((pair, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-xl p-6 border-l-4 border-blue-500">
                        <div className="mb-4">
                          <div className="flex items-center mb-2">
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                              Question {idx + 1}
                            </span>
                          </div>
                          <p className="text-gray-900 font-medium">{pair.question}</p>
                        </div>
                        
                        <div className="mb-4">
                          <div className="flex items-center mb-2">
                            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                              Your Answer
                            </span>
                          </div>
                          <p className="text-gray-700">{pair.user_answer}</p>
                        </div>

                        {pair.feedback && (
                          <div className="bg-purple-50 rounded-lg p-4">
                            <div className="flex items-center mb-2">
                              <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                AI Feedback
                              </span>
                            </div>
                            <p className="text-purple-800 text-sm">{pair.feedback}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : hasMessages ? (
                  <div className="space-y-4">
                    {messages.map((msg, idx) => (
                      <div key={idx} className={`p-4 rounded-xl ${
                        msg.role === 'user' 
                          ? 'bg-blue-50 border-l-4 border-blue-500' 
                          : 'bg-gray-50 border-l-4 border-gray-400'
                      }`}>
                        <div className="flex items-center mb-2">
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                            msg.role === 'user'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {msg.role === 'user' ? 'You' : 'AI'}
                          </span>
                        </div>
                        <p className="text-gray-700 whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.013 8.013 0 01-7-4L5 20l4-1a8.014 8.014 0 01-2-7c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                      </svg>
                    </div>
                    <p className="text-gray-500">No transcript available</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Summary;
