/* =========================================================
   TASBIH.JS - Interactive Tasbih Counter
   ========================================================= */

(function () {
  const Utils = window.TasbihUtils || {
    PRESET_PHASES: [
      { arabic: '????????? ???????', translit: 'SubhanAllah', english: 'Glory be to Allah', target: 33 },
      { arabic: '????????? ???????', translit: 'Alhamdulillah', english: 'All praise is due to Allah', target: 33 },
      { arabic: '??????? ????????', translit: 'Allahu Akbar', english: 'Allah is the Greatest', target: 34 }
    ],
    clampTarget: (value) => {
      const n = parseInt(value, 10);
      if (!Number.isFinite(n)) return 33;
      return Math.min(1000, Math.max(1, n));
    },
    createInitialState: () => ({
      mode: 'preset',
      phaseIndex: 0,
      count: 0,
      totalCount: 0,
      phaseCounts: [0, 0, 0],
      customPhase: { arabic: '', target: 33 }
    }),
    getCurrentDhikr: (mode, phaseIndex, customPhase) => {
      if (mode === 'preset') return Utils.PRESET_PHASES[phaseIndex] || Utils.PRESET_PHASES[0];
      if (mode === 'custom') return { arabic: customPhase?.arabic || '?????', translit: 'Custom Dhikr', english: '' };
      return { arabic: '?????', translit: 'Free Mode', english: 'No limit - count freely' };
    },
    getCurrentTarget: (mode, phaseIndex, customPhase) => {
      if (mode === 'preset') return Utils.PRESET_PHASES[phaseIndex]?.target || 33;
      if (mode === 'custom') return Utils.clampTarget(customPhase?.target);
      return Infinity;
    },
    sanitizeCustomPhase: (arabic, target) => ({ arabic: String(arabic || '').trim() || '?????', target: Utils.clampTarget(target) })
  };

  const STORAGE_KEY = 'tasbih_state_v2';
  const HISTORY_LIMIT = 250;

  /* ---------- Dhikr Data ---------- */
  const PRESET_PHASES = Utils.PRESET_PHASES;

  /* ---------- State ---------- */
  let mode = 'preset'; // 'preset' | 'custom' | 'free'
  let phaseIndex = 0;
  let count = 0;
  let totalCount = 0;
  let phaseCounts = [0, 0, 0];
  let customPhase = { arabic: '', target: 33 };
  let isAnimating = false;
  let history = [];

  /* ---------- DOM Refs ---------- */
  const ringWrap = document.getElementById('bead-ring-wrap');
  const countDisplay = document.getElementById('count-display');
  const totalDisplay = document.getElementById('total-display');
  const dhikrArabic = document.getElementById('dhikr-arabic');
  const dhikrTranslit = document.getElementById('dhikr-translit');
  const dhikrEnglish = document.getElementById('dhikr-english');
  const phaseDots = document.querySelectorAll('.phase-dot');
  const modeTabs = document.querySelectorAll('.mode-tab');
  const customPanel = document.getElementById('custom-panel');
  const customDhikrInput = document.getElementById('custom-dhikr');
  const customTargetInput = document.getElementById('custom-target');
  const customApplyBtn = document.getElementById('custom-apply');
  const resetBtn = document.getElementById('reset-btn');
  const undoBtn = document.getElementById('undo-btn');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalCloseBtn = document.getElementById('modal-close');
  const modalAgainBtn = document.getElementById('modal-again');

  const announcer = createAnnouncer();

  let beadEls = []; // SVG circle elements

  /* ---------- Build Bead Ring (SVG) ---------- */
  function buildBeadRing() {
    const BEAD_COUNT = 33;
    const CX = 160;
    const CY = 160;
    const RING_R = 120;
    const BEAD_R = 9;

    const ns = 'http://www.w3.org/2000/svg';
    const svgEl = document.createElementNS(ns, 'svg');
    svgEl.setAttribute('viewBox', '0 0 320 320');
    svgEl.setAttribute('class', 'bead-ring-svg');
    svgEl.setAttribute('aria-hidden', 'true');

    // Dashed track circle
    const track = document.createElementNS(ns, 'circle');
    track.setAttribute('cx', CX);
    track.setAttribute('cy', CY);
    track.setAttribute('r', RING_R);
    track.setAttribute('class', 'ring-track');
    svgEl.appendChild(track);

    beadEls = [];
    for (let i = 0; i < BEAD_COUNT; i++) {
      // Start from top (-90 deg), go clockwise.
      const angle = (i / BEAD_COUNT) * 2 * Math.PI - Math.PI / 2;
      const bx = CX + RING_R * Math.cos(angle);
      const by = CY + RING_R * Math.sin(angle);

      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', bx.toFixed(2));
      circle.setAttribute('cy', by.toFixed(2));
      circle.setAttribute('r', BEAD_R);
      circle.setAttribute('class', 'bead');
      circle.dataset.i = i;

      svgEl.appendChild(circle);
      beadEls.push(circle);
    }

    ringWrap.insertBefore(svgEl, ringWrap.firstChild);
  }

  function createAnnouncer() {
    const el = document.createElement('div');
    el.className = 'sr-only';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    document.body.appendChild(el);
    return el;
  }

  function announce(message) {
    announcer.textContent = '';
    setTimeout(() => {
      announcer.textContent = message;
    }, 10);
  }

  function isEditableTarget(target) {
    if (!target) return false;
    const tag = (target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  function snapshotState() {
    return {
      mode,
      phaseIndex,
      count,
      totalCount,
      phaseCounts: [...phaseCounts],
      customPhase: { ...customPhase }
    };
  }

  function applyState(nextState, persist = true) {
    mode = nextState.mode;
    phaseIndex = nextState.phaseIndex;
    count = nextState.count;
    totalCount = nextState.totalCount;
    phaseCounts = [...nextState.phaseCounts];
    customPhase = { ...nextState.customPhase };

    syncModeUI();
    renderBeads();
    updateLabels();
    if (persist) persistState();
  }

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotState()));
    } catch {}
  }

  function restorePersistedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const validMode = ['preset', 'custom', 'free'].includes(parsed.mode) ? parsed.mode : 'preset';
      const validPhaseIndex = Math.min(2, Math.max(0, parseInt(parsed.phaseIndex, 10) || 0));
      const validCount = Math.max(0, parseInt(parsed.count, 10) || 0);
      const validTotal = Math.max(0, parseInt(parsed.totalCount, 10) || 0);
      const validPhaseCounts = Array.isArray(parsed.phaseCounts)
        ? [0, 1, 2].map((i) => Math.max(0, parseInt(parsed.phaseCounts[i], 10) || 0))
        : [0, 0, 0];
      const validCustom = Utils.sanitizeCustomPhase(parsed.customPhase?.arabic, parsed.customPhase?.target);

      applyState(
        {
          mode: validMode,
          phaseIndex: validPhaseIndex,
          count: validCount,
          totalCount: validTotal,
          phaseCounts: validPhaseCounts,
          customPhase: validCustom
        },
        false
      );
      announce('Previous tasbih session restored');
    } catch {
      // Ignore invalid stored state.
    }
  }

  function pushHistory() {
    history.push(snapshotState());
    if (history.length > HISTORY_LIMIT) history.shift();
  }

  function undoLastTap() {
    if (isAnimating || history.length === 0) return;
    const previous = history.pop();
    applyState(previous);
    modalOverlay.classList.add('hidden');
    announce('Undid last count');
  }

  /* ---------- Render Bead States ---------- */
  function renderBeads() {
    beadEls.forEach((bead, i) => {
      if (i < count) {
        bead.classList.add('lit');
      } else {
        bead.classList.remove('lit');
      }
    });
  }

  /* ---------- Current Phase/Target ---------- */
  function getCurrentTarget() {
    return Utils.getCurrentTarget(mode, phaseIndex, customPhase);
  }

  function getCurrentDhikr() {
    return Utils.getCurrentDhikr(mode, phaseIndex, customPhase);
  }

  /* ---------- Update UI Labels ---------- */
  function updateLabels() {
    const dhikr = getCurrentDhikr();
    dhikrArabic.textContent = dhikr.arabic;
    dhikrTranslit.textContent = dhikr.translit;
    dhikrEnglish.textContent = dhikr.english;
    countDisplay.textContent = count;
    totalDisplay.textContent = totalCount;

    // Phase class on ring wrap
    ringWrap.className = ringWrap.className.replace(/phase-\d/g, '').trim();
    if (mode === 'preset') {
      ringWrap.classList.add(`phase-${phaseIndex + 1}`);
    }

    // Phase dots
    if (mode === 'preset') {
      phaseDots.forEach((dot, i) => {
        dot.classList.remove('active', 'done');
        if (i < phaseIndex) dot.classList.add('done');
        if (i === phaseIndex) dot.classList.add('active');
      });
    }
  }

  function syncModeUI() {
    modeTabs.forEach((t) => {
      const active = t.dataset.mode === mode;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });

    customPanel.classList.toggle('hidden', mode !== 'custom');

    // Show/hide phase dots
    const dotsContainer = document.querySelector('.phase-indicator');
    if (dotsContainer) {
      dotsContainer.style.visibility = mode === 'preset' ? 'visible' : 'hidden';
    }
  }

  /* ---------- Tap / Click Handler ---------- */
  function handleTap(event) {
    if (event) event.preventDefault();
    if (isAnimating) return;

    pushHistory();

    count++;
    totalCount++;

    const target = getCurrentTarget();
    renderBeads();
    updateLabels();
    triggerPulse();
    persistState();

    if (navigator.vibrate) navigator.vibrate(12);

    if (count >= target && target !== Infinity) {
      handlePhaseComplete();
    }
  }

  /* ---------- Phase Complete ---------- */
  function handlePhaseComplete() {
    isAnimating = true;

    // Flash beads
    ringWrap.classList.add('phase-flash');
    spawnParticles();

    setTimeout(() => {
      ringWrap.classList.remove('phase-flash');

      if (mode === 'preset') {
        phaseCounts[phaseIndex] = count;
        phaseIndex++;

        if (phaseIndex >= PRESET_PHASES.length) {
          // All phases done - session complete
          phaseIndex = PRESET_PHASES.length - 1;
          isAnimating = false;
          updateModalSummary();
          showSessionComplete();
          persistState();
          return;
        }
      }

      // Reset count for next phase
      count = 0;
      beadEls.forEach((b) => b.classList.remove('lit'));
      updateLabels();
      isAnimating = false;
      persistState();
    }, 700);
  }

  /* ---------- Pulse Animation ---------- */
  function triggerPulse() {
    ringWrap.classList.remove('pulsing');
    // Force reflow
    void ringWrap.offsetWidth;
    ringWrap.classList.add('pulsing');
    setTimeout(() => ringWrap.classList.remove('pulsing'), 350);
  }

  /* ---------- Particles ---------- */
  function spawnParticles() {
    const rect = ringWrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ['#C9A84C', '#E8C96A', '#1E6B45', '#F0EAD6'];

    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const angle = (i / 18) * 2 * Math.PI;
      const dist = 80 + Math.random() * 80;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      p.style.cssText = `
        left: ${cx}px;
        top: ${cy}px;
        background: ${colors[i % colors.length]};
        --tx: ${tx}px;
        --ty: ${ty}px;
        animation-duration: ${0.8 + Math.random() * 0.6}s;
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    }
  }

  /* ---------- Session Complete Modal ---------- */
  function updateModalSummary() {
    const subhan = document.getElementById('modal-subhan-count');
    const alhamd = document.getElementById('modal-alhamd-count');
    const akbar = document.getElementById('modal-akbar-count');
    const modalTotal = document.getElementById('modal-total');

    if (subhan) subhan.textContent = `x ${phaseCounts[0] || 0}`;
    if (alhamd) alhamd.textContent = `x ${phaseCounts[1] || 0}`;
    if (akbar) akbar.textContent = `x ${phaseCounts[2] || 0}`;
    if (modalTotal) modalTotal.textContent = totalCount;
  }

  function showSessionComplete() {
    spawnParticles();
    setTimeout(spawnParticles, 300);
    modalOverlay.classList.remove('hidden');
  }

  /* ---------- Reset ---------- */
  function reset() {
    history = [];
    applyState(
      {
        ...Utils.createInitialState(),
        mode,
        customPhase: { ...customPhase }
      },
      true
    );
    modalOverlay.classList.add('hidden');
  }

  /* ---------- Mode Switching ---------- */
  function setMode(newMode) {
    if (!['preset', 'custom', 'free'].includes(newMode)) return;
    mode = newMode;
    syncModeUI();
    reset();
  }

  /* ---------- Custom Mode Apply ---------- */
  function applyCustom() {
    customPhase = Utils.sanitizeCustomPhase(customDhikrInput.value, customTargetInput.value);
    if (customTargetInput) customTargetInput.value = customPhase.target;

    count = 0;
    beadEls.forEach((b) => b.classList.remove('lit'));
    history = [];
    updateLabels();
    persistState();
    announce('Custom dhikr updated');
  }

  /* ---------- Event Listeners ---------- */
  function setupListeners() {
    // Tap on ring
    ringWrap.addEventListener('click', handleTap);
    ringWrap.addEventListener('touchend', handleTap, { passive: false });

    document.addEventListener('keydown', (event) => {
      if (isEditableTarget(event.target)) return;

      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        handleTap(event);
        return;
      }

      if (event.code === 'Backspace') {
        event.preventDefault();
        undoLastTap();
      }
    });

    // Mode tabs
    modeTabs.forEach((tab) => {
      tab.addEventListener('click', () => setMode(tab.dataset.mode));
    });

    // Reset/undo buttons
    if (resetBtn) resetBtn.addEventListener('click', reset);
    if (undoBtn) undoBtn.addEventListener('click', undoLastTap);

    // Custom apply
    if (customApplyBtn) customApplyBtn.addEventListener('click', applyCustom);

    // Modal close
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
      });
    }

    if (modalAgainBtn) {
      modalAgainBtn.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
        reset();
      });
    }

    // Close modal on backdrop click
    modalOverlay.addEventListener('click', (event) => {
      if (event.target === modalOverlay) modalOverlay.classList.add('hidden');
    });
  }

  /* ---------- Init ---------- */
  function init() {
    buildBeadRing();
    setupListeners();

    applyState(Utils.createInitialState(), false);
    restorePersistedState();
    updateLabels();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
