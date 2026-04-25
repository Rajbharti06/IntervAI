import { useEffect, useRef, useState, useCallback } from 'react';

export function useAntiCheat({ enabled = true, onViolation } = {}) {
  const [violations, setViolations] = useState([]);
  const [tabSwitches, setTabSwitches] = useState(0);
  const pasteBlockRef = useRef(false);

  const addViolation = useCallback((type, detail) => {
    const v = { type, detail, at: Date.now() };
    setViolations(prev => [...prev, v]);
    if (onViolation) onViolation(v);
  }, [onViolation]);

  // ── Tab / window visibility ──────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitches(n => n + 1);
        addViolation('tab_switch', 'Candidate switched tabs or minimized window');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, addViolation]);

  // ── Copy detection ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const handleCopy = () => {
      const sel = window.getSelection()?.toString() || '';
      if (sel.trim().length > 20) {
        addViolation('copy', `Copied ${sel.trim().length} characters`);
      }
    };
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [enabled, addViolation]);

  // ── Paste block on textarea (flag but don't block so user can still type) ────
  const onPaste = useCallback((e) => {
    if (!enabled) return;
    const pasted = e.clipboardData?.getData('text') || '';
    if (pasted.trim().length > 30) {
      addViolation('paste', `Pasted ${pasted.trim().length} characters into answer box`);
    }
  }, [enabled, addViolation]);

  // ── Right-click block ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const block = (e) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, [enabled]);

  // ── Dev tools detection (window resize heuristic) ────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let prev = { w: window.outerWidth, h: window.outerHeight };
    const check = () => {
      const diff = Math.abs(window.outerWidth - window.innerWidth) + Math.abs(window.outerHeight - window.innerHeight);
      if (diff > 200 && (window.outerWidth !== prev.w || window.outerHeight !== prev.h)) {
        prev = { w: window.outerWidth, h: window.outerHeight };
        addViolation('devtools', 'Possible developer tools opened');
      }
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [enabled, addViolation]);

  const totalViolations = violations.length;
  const riskLevel = totalViolations === 0 ? 'clean' : totalViolations <= 2 ? 'low' : totalViolations <= 5 ? 'medium' : 'high';
  const riskColor = { clean: 'green', low: 'yellow', medium: 'orange', high: 'red' }[riskLevel];

  return { violations, tabSwitches, totalViolations, riskLevel, riskColor, onPaste };
}
