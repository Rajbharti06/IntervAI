import React, { useEffect, useState } from 'react';

function useLocalStorage(key, defaultVal) {
  const [val, setVal] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : defaultVal;
    } catch {
      return defaultVal;
    }
  });
  const update = (newVal) => {
    setVal(newVal);
    try { localStorage.setItem(key, JSON.stringify(newVal)); } catch {}
  };
  return [val, update];
}

const LEVELS = [
  { name: 'Rookie',       minXp: 0,    icon: '🌱' },
  { name: 'Learner',      minXp: 100,  icon: '📚' },
  { name: 'Practitioner', minXp: 300,  icon: '⚡' },
  { name: 'Skilled',      minXp: 600,  icon: '🎯' },
  { name: 'Advanced',     minXp: 1000, icon: '🔥' },
  { name: 'Expert',       minXp: 1500, icon: '💎' },
  { name: 'Master',       minXp: 2200, icon: '👑' },
  { name: 'Elite',        minXp: 3000, icon: '🚀' },
];

function getLevel(xp) {
  let level = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.minXp) level = l;
  return level;
}
function getNextLevel(xp) {
  for (const l of LEVELS) if (xp < l.minXp) return l;
  return null;
}

export default function GamificationBar({ sessionXp = 0, sessionScore = null, newBadges = [] }) {
  const [totalXp, setTotalXp] = useLocalStorage('intervai_total_xp', 0);
  const [streak, setStreak] = useLocalStorage('intervai_streak', 0);
  const [lastDate, setLastDate] = useLocalStorage('intervai_last_date', '');
  const [showBadge, setShowBadge] = useState(null);

  // Update streak on mount
  useEffect(() => {
    const today = new Date().toDateString();
    if (lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      setStreak(lastDate === yesterday ? streak + 1 : 1);
      setLastDate(today);
    }
  }, []);

  // Add session XP
  useEffect(() => {
    if (sessionXp > 0) {
      setTotalXp(totalXp + sessionXp);
    }
  }, [sessionXp]);

  // Show badge popup
  useEffect(() => {
    if (newBadges && newBadges.length > 0) {
      let i = 0;
      const show = () => {
        if (i < newBadges.length) {
          setShowBadge(newBadges[i]);
          i++;
          setTimeout(() => { setShowBadge(null); setTimeout(show, 400); }, 2500);
        }
      };
      setTimeout(show, 500);
    }
  }, [newBadges]);

  const level = getLevel(totalXp);
  const next = getNextLevel(totalXp);
  const progress = next ? Math.round(((totalXp - level.minXp) / (next.minXp - level.minXp)) * 100) : 100;

  return (
    <>
      {/* Badge popup */}
      {showBadge && (
        <div className="fixed top-20 right-4 z-50 animate-bounce">
          <div className="bg-white border-2 border-yellow-400 rounded-2xl shadow-xl px-5 py-4 text-center max-w-xs">
            <div className="text-3xl mb-1">{showBadge.icon}</div>
            <div className="font-bold text-gray-900 text-sm">{showBadge.name}</div>
            <div className="text-xs text-gray-500">{showBadge.desc}</div>
          </div>
        </div>
      )}

      {/* Bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-4 flex-wrap">
          {/* Level */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{level.icon}</span>
            <div>
              <div className="text-xs font-semibold text-gray-700">{level.name}</div>
              <div className="text-xs text-gray-400">{totalXp} XP</div>
            </div>
          </div>

          {/* XP progress bar */}
          {next && (
            <div className="flex-1 min-w-24 max-w-40">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{next.minXp - totalXp} XP to {next.name}</div>
            </div>
          )}

          {/* Streak */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-base">🔥</span>
            <div>
              <div className="text-xs font-bold text-gray-700">{streak} day streak</div>
              <div className="text-xs text-gray-400">Keep it up!</div>
            </div>
          </div>

          {/* Session score */}
          {sessionScore !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 rounded-full">
              <span className="text-xs font-bold text-blue-700">+{sessionXp} XP</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
