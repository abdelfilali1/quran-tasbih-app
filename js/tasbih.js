/* =========================================================
   TASBIH.JS — Interactive Tasbih Counter
   ========================================================= */

(function () {

  /* ---------- Dhikr Data ---------- */
  const PRESET_PHASES = [
    { arabic: 'سُبْحَانَ اللَّهِ',   translit: 'SubhanAllah',   english: 'Glory be to Allah',           target: 33 },
    { arabic: 'الْحَمْدُ لِلَّهِ',  translit: 'Alhamdulillah', english: 'All praise is due to Allah',   target: 33 },
    { arabic: 'اللَّهُ أَكْبَرُ',   translit: 'Allahu Akbar',  english: 'Allah is the Greatest',        target: 34 },
  ];

  /* ---------- State ---------- */
  let mode        = 'preset';   // 'preset' | 'custom' | 'free'
  let phaseIndex  = 0;
  let count       = 0;
  let totalCount  = 0;
  let phaseCounts = [0, 0, 0];  // completed counts per phase (preset)
  let customPhase = { arabic: '', target: 33 };
  let isAnimating = false;

  /* ---------- DOM Refs ---------- */
  const ringWrap        = document.getElementById('bead-ring-wrap');
  const countDisplay    = document.getElementById('count-display');
  const totalDisplay    = document.getElementById('total-display');
  const dhikrArabic     = document.getElementById('dhikr-arabic');
  const dhikrTranslit   = document.getElementById('dhikr-translit');
  const dhikrEnglish    = document.getElementById('dhikr-english');
  const phaseDots       = document.querySelectorAll('.phase-dot');
  const modeTabs        = document.querySelectorAll('.mode-tab');
  const customPanel     = document.getElementById('custom-panel');
  const customDhikrInput = document.getElementById('custom-dhikr');
  const customTargetInput = document.getElementById('custom-target');
  const customApplyBtn  = document.getElementById('custom-apply');
  const resetBtn        = document.getElementById('reset-btn');
  const modalOverlay    = document.getElementById('modal-overlay');
  const modalCloseBtn   = document.getElementById('modal-close');
  const modalAgainBtn   = document.getElementById('modal-again');

  let beadEls = [];  // SVG circle elements
  let svgEl   = null;

  /* ---------- Build Bead Ring (SVG) ---------- */
  function buildBeadRing() {
    const BEAD_COUNT = 33;
    const CX = 160, CY = 160;
    const RING_R = 120;
    const BEAD_R = 9;

    const ns = 'http://www.w3.org/2000/svg';
    svgEl = document.createElementNS(ns, 'svg');
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
      // Start from top (-90°), go clockwise
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

  /* ---------- Render Bead States ---------- */
  function renderBeads() {
    const target = getCurrentTarget();
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
    if (mode === 'preset') return PRESET_PHASES[phaseIndex].target;
    if (mode === 'custom') return customPhase.target || 33;
    return Infinity; // free mode
  }

  function getCurrentDhikr() {
    if (mode === 'preset') return PRESET_PHASES[phaseIndex];
    if (mode === 'custom') return {
      arabic: customPhase.arabic || 'ذِكْر',
      translit: 'Custom Dhikr',
      english: ''
    };
    return { arabic: 'ذِكْر', translit: 'Free Mode', english: 'No limit — count freely' };
  }

  /* ---------- Update UI Labels ---------- */
  function updateLabels() {
    const dhikr = getCurrentDhikr();
    dhikrArabic.textContent   = dhikr.arabic;
    dhikrTranslit.textContent = dhikr.translit;
    dhikrEnglish.textContent  = dhikr.english;
    countDisplay.textContent  = count;
    totalDisplay.textContent  = totalCount;

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

  /* ---------- Tap / Click Handler ---------- */
  function handleTap(e) {
    e.preventDefault();
    if (isAnimating) return;

    count++;
    totalCount++;

    const target = getCurrentTarget();
    renderBeads();
    updateLabels();
    triggerPulse();

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
          // All 3 phases done — session complete
          phaseIndex = PRESET_PHASES.length - 1; // keep on last for display
          isAnimating = false;
          showSessionComplete();
          return;
        }
      }

      // Reset count for next phase
      count = 0;
      beadEls.forEach(b => b.classList.remove('lit'));
      updateLabels();
      isAnimating = false;
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
  function showSessionComplete() {
    spawnParticles();
    setTimeout(spawnParticles, 300);

    // Update total in modal
    const modalTotal = document.getElementById('modal-total');
    if (modalTotal) modalTotal.textContent = totalCount;

    modalOverlay.classList.remove('hidden');
  }

  /* ---------- Reset ---------- */
  function reset(fullReset = true) {
    count = 0;
    totalCount = 0;
    phaseIndex = 0;
    phaseCounts = [0, 0, 0];
    isAnimating = false;
    beadEls.forEach(b => b.classList.remove('lit'));
    ringWrap.className = 'bead-ring-wrap phase-1';
    updateLabels();
  }

  /* ---------- Mode Switching ---------- */
  function setMode(newMode) {
    mode = newMode;
    modeTabs.forEach(t => {
      t.classList.toggle('active', t.dataset.mode === newMode);
    });

    customPanel.classList.toggle('hidden', newMode !== 'custom');

    // Show/hide phase dots
    const dotsContainer = document.querySelector('.phase-indicator');
    if (dotsContainer) {
      dotsContainer.style.visibility = newMode === 'preset' ? 'visible' : 'hidden';
    }

    reset();
  }

  /* ---------- Custom Mode Apply ---------- */
  function applyCustom() {
    const text = customDhikrInput.value.trim();
    const target = parseInt(customTargetInput.value) || 33;
    customPhase = { arabic: text || 'ذِكْر', target };
    count = 0;
    beadEls.forEach(b => b.classList.remove('lit'));
    updateLabels();
  }

  /* ---------- Event Listeners ---------- */
  function setupListeners() {
    // Tap on ring
    ringWrap.addEventListener('click', handleTap);
    ringWrap.addEventListener('touchend', handleTap, { passive: false });

    // Also tap anywhere on center area
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleTap(e);
      }
    });

    // Mode tabs
    modeTabs.forEach(tab => {
      tab.addEventListener('click', () => setMode(tab.dataset.mode));
    });

    // Reset button
    resetBtn.addEventListener('click', () => reset(true));

    // Custom apply
    if (customApplyBtn) customApplyBtn.addEventListener('click', applyCustom);

    // Modal close
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => {
      modalOverlay.classList.add('hidden');
    });
    if (modalAgainBtn) modalAgainBtn.addEventListener('click', () => {
      modalOverlay.classList.add('hidden');
      reset();
    });

    // Close modal on backdrop click
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.classList.add('hidden');
    });
  }

  /* ---------- Init ---------- */
  function init() {
    buildBeadRing();
    setMode('preset');
    setupListeners();
    updateLabels();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
