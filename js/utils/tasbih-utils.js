/* =========================================================
   TASBIH-UTILS.JS - Shared pure helpers for tasbih logic
   Exposes `TasbihUtils` on window and `module.exports` in Node.
   ========================================================= */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TasbihUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PRESET_PHASES = [
    { arabic: 'سُبْحَانَ اللَّهِ', translit: 'SubhanAllah', english: 'Glory be to Allah', target: 33 },
    { arabic: 'الْحَمْدُ لِلَّهِ', translit: 'Alhamdulillah', english: 'All praise is due to Allah', target: 33 },
    { arabic: 'اللَّهُ أَكْبَرُ', translit: 'Allahu Akbar', english: 'Allah is the Greatest', target: 34 }
  ];

  const MAX_CUSTOM_TARGET = 1000;
  const DEFAULT_CUSTOM_TARGET = 33;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampTarget(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_CUSTOM_TARGET;
    return clamp(parsed, 1, MAX_CUSTOM_TARGET);
  }

  function sanitizeCustomPhase(arabic, target) {
    return {
      arabic: String(arabic || '').trim() || 'ذِكْر',
      target: clampTarget(target)
    };
  }

  function getCurrentTarget(mode, phaseIndex, customPhase) {
    if (mode === 'preset') return PRESET_PHASES[phaseIndex]?.target || PRESET_PHASES[0].target;
    if (mode === 'custom') return sanitizeCustomPhase(customPhase?.arabic, customPhase?.target).target;
    return Infinity;
  }

  function getCurrentDhikr(mode, phaseIndex, customPhase) {
    if (mode === 'preset') return PRESET_PHASES[phaseIndex] || PRESET_PHASES[0];
    if (mode === 'custom') {
      const safe = sanitizeCustomPhase(customPhase?.arabic, customPhase?.target);
      return { arabic: safe.arabic, translit: 'Custom Dhikr', english: '' };
    }
    return { arabic: 'ذِكْر', translit: 'Free Mode', english: 'No limit - count freely' };
  }

  function createInitialState() {
    return {
      mode: 'preset',
      phaseIndex: 0,
      count: 0,
      totalCount: 0,
      phaseCounts: [0, 0, 0],
      customPhase: { arabic: '', target: DEFAULT_CUSTOM_TARGET }
    };
  }

  return {
    DEFAULT_CUSTOM_TARGET,
    MAX_CUSTOM_TARGET,
    PRESET_PHASES,
    clamp,
    clampTarget,
    createInitialState,
    getCurrentDhikr,
    getCurrentTarget,
    sanitizeCustomPhase
  };
});
