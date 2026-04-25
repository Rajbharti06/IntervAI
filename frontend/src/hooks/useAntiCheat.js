import { useEffect, useRef, useState, useCallback } from 'react';

const WEIGHTS = { tab_switch: 12, copy: 6, paste: 8, devtools: 5 };

export function useAntiCheat({ enabled = true, onViolation } = {}) {
  const [violations, setViolations] = useState([]);
  const [tabSwitches, setTabSwitches] = useState(0);

  const addViolation = useCallback((type, detail) => {
    const v = { type, detail, at: Date.now() };
    setViolations(prev => [...prev, v]);
    onViolation?.(v);
  }, [onViolation]);

  // ── Tab / window visibility ──────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const handle = () => {
      if (document.hidden) {
        setTabSwitches(n => n + 1);
        addViolation('tab_switch', 'Switched tabs or minimized');
      }
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [enabled, addViolation]);

  // ── Copy detection ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const handle = () => {
      const sel = window.getSelection()?.toString() || '';
      if (sel.trim().length > 20) addViolation('copy', `Copied ${sel.trim().length} chars`);
    };
    document.addEventListener('copy', handle);
    return () => document.removeEventListener('copy', handle);
  }, [enabled, addViolation]);

  // ── Paste monitoring ─────────────────────────────────────────────────────────
  const onPaste = useCallback((e) => {
    if (!enabled) return;
    const pasted = e.clipboardData?.getData('text') || '';
    if (pasted.trim().length > 30) addViolation('paste', `Pasted ${pasted.trim().length} chars`);
  }, [enabled, addViolation]);

  // ── Right-click block ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const block = (e) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, [enabled]);

  // ── Dev tools heuristic ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let prev = { w: window.outerWidth, h: window.outerHeight };
    const check = () => {
      const diff = Math.abs(window.outerWidth - window.innerWidth) + Math.abs(window.outerHeight - window.innerHeight);
      if (diff > 200 && (window.outerWidth !== prev.w || window.outerHeight !== prev.h)) {
        prev = { w: window.outerWidth, h: window.outerHeight };
        addViolation('devtools', 'Dev tools possibly opened');
      }
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [enabled, addViolation]);

  // ── Integrity Score (0-100) ──────────────────────────────────────────────────
  const deductions = violations.reduce((sum, v) => sum + (WEIGHTS[v.type] || 5), 0);
  const integrityScore = Math.max(0, 100 - deductions);

  const riskLevel =
    integrityScore >= 90 ? 'clean' :
    integrityScore >= 75 ? 'low' :
    integrityScore >= 55 ? 'medium' : 'high';

  const riskColor = { clean: 'green', low: 'yellow', medium: 'orange', high: 'red' }[riskLevel];
  const totalViolations = violations.length;

  return { violations, tabSwitches, totalViolations, integrityScore, riskLevel, riskColor, onPaste };
}
