import React from 'react';

function ScoreMeter({ label, value, max = 10, color = 'blue' }) {
  const pct = Math.round((value / max) * 100);
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
  };
  const bar = colors[color] || colors.blue;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-medium text-gray-700">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SpeechAnalysisCard({ analysis, isOpen, onToggle }) {
  if (!analysis) return null;

  const fillerColor = analysis.filler_rate_pct > 10 ? 'text-red-600 bg-red-50' :
                      analysis.filler_rate_pct > 5  ? 'text-yellow-600 bg-yellow-50' :
                                                      'text-green-600 bg-green-50';

  const starColor = analysis.star_score >= 4 ? 'text-green-700 bg-green-50' :
                    analysis.star_score >= 2 ? 'text-yellow-700 bg-yellow-50' :
                                               'text-gray-600 bg-gray-50';

  return (
    <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="font-medium text-gray-700">Communication Analysis</span>
          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
            {analysis.overall_communication_score}/10
          </span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="p-4 space-y-4">
          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className={`rounded-lg p-2 ${fillerColor}`}>
              <div className="text-lg font-bold">{analysis.filler_rate_pct}%</div>
              <div className="text-xs">Filler Words</div>
            </div>
            <div className="rounded-lg p-2 bg-blue-50 text-blue-700">
              <div className="text-lg font-bold">{analysis.word_count}</div>
              <div className="text-xs">Words</div>
            </div>
            <div className={`rounded-lg p-2 ${starColor}`}>
              <div className="text-lg font-bold">{analysis.star_score}/4</div>
              <div className="text-xs">STAR Score</div>
            </div>
          </div>

          {/* Score meters */}
          <div className="space-y-2">
            <ScoreMeter label="Confidence" value={analysis.confidence_score} color="purple" />
            <ScoreMeter label="Clarity" value={analysis.clarity_score} color="blue" />
            <ScoreMeter label="Structure" value={analysis.structure_score} color="green" />
          </div>

          {/* STAR breakdown */}
          {analysis.star_components && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">STAR Method</div>
              <div className="flex gap-1.5 flex-wrap">
                {Object.entries(analysis.star_components).map(([key, found]) => (
                  <span
                    key={key}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      found ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {found ? '✓' : '✗'} {key.charAt(0).toUpperCase() + key.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Filler words */}
          {analysis.filler_words && analysis.filler_words.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">Detected Fillers</div>
              <div className="flex flex-wrap gap-1">
                {analysis.filler_words.map((w) => (
                  <span key={w} className="px-1.5 py-0.5 bg-red-50 text-red-600 text-xs rounded border border-red-200">
                    "{w}"
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          {analysis.tips && analysis.tips.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="text-xs font-medium text-amber-700 mb-1.5">Improvement Tips</div>
              <ul className="space-y-1">
                {analysis.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                    <span className="mt-0.5 flex-shrink-0">→</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
