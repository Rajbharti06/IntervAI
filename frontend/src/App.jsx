import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Setup from './pages/Setup';
import Interview from './pages/Interview';
import Dashboard from './pages/Dashboard';
import Summary from './pages/Summary';
import Navbar from './components/Navbar';

function App() {
  const [compact, setCompact] = useState(() => {
    try {
      const saved = localStorage.getItem('compactMode');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    // Auto-enable compact on very small screens by default
    if (typeof window !== 'undefined') {
      return window.innerWidth < 380;
    }
    return false;
  });

  useEffect(() => {
    try { localStorage.setItem('compactMode', JSON.stringify(compact)); } catch {}
    // Toggle a class on <html> so global CSS can react
    const el = document.documentElement;
    if (compact) {
      el.classList.add('compact');
    } else {
      el.classList.remove('compact');
    }
  }, [compact]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <Navbar compact={compact} onToggleCompact={() => setCompact((v) => !v)} />
      {/* Fill remaining viewport under Navbar and allow children to manage overflow */}
      <main className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<Setup />} />
          <Route path="/interview" element={<Interview />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
