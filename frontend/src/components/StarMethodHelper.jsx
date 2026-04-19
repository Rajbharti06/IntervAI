import React, { useState } from 'react';

const STAR_TIPS = {
  Situation: {
    desc: "Set the context. Where were you? What was happening?",
    starters: ["When I was working at...", "During my project on...", "In Q3 last year, our team..."],
  },
  Task: {
    desc: "What was your responsibility? What needed to be done?",
    starters: ["My role was to...", "I was responsible for...", "The challenge was to..."],
  },
  Action: {
    desc: "What specific steps did YOU take? (use 'I', not 'we')",
    starters: ["I decided to...", "I built...", "I first analyzed... then I..."],
  },
  Result: {
    desc: "What happened? Include numbers, impact, or learning.",
    starters: ["This resulted in a 40% improvement in...", "The team was able to...", "I learned that..."],
  },
};

export default function StarMethodHelper({ visible }) {
  const [expanded, setExpanded] = useState(null);

  if (!visible) return null;

  return (
    <div className="mt-2 border border-blue-200 rounded-xl bg-blue-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-100">
        <span className="text-blue-600 text-sm">⭐</span>
        <span className="text-xs font-semibold text-blue-800">STAR Method Helper — use this for behavioral questions</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-blue-200">
        {Object.entries(STAR_TIPS).map(([step, info]) => (
          <button
            key={step}
            onClick={() => setExpanded(expanded === step ? null : step)}
            className="text-left bg-white hover:bg-blue-50 p-3 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700">{step}</span>
              <svg className={`w-3 h-3 text-blue-400 transition-transform ${expanded === step ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{info.desc}</p>
            {expanded === step && (
              <ul className="mt-2 space-y-1">
                {info.starters.map((s, i) => (
                  <li key={i} className="text-xs text-blue-700 bg-blue-100 rounded px-2 py-1 italic">
                    "{s}"
                  </li>
                ))}
              </ul>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
