/* =========================================================
   QURAN.JS - Quran Reader Logic
   ========================================================= */

(function () {
  const Utils = window.QuranUtils || {
    getAdjacentSurahId: (id, delta) => {
      const n = parseInt(id, 10);
      if (!Number.isFinite(n)) return null;
      return Math.min(114, Math.max(1, n + (delta || 0)));
    },
    normalizeSurahId: (value) => {
      const n = parseInt(value, 10);
      return Number.isFinite(n) ? Math.min(114, Math.max(1, n)) : null;
    },
    sanitizeTranslationText: (value) => String(value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    toArabicNumeral: (value) => String(value).replace(/\d/g, (d) => '??????????'[d])
  };

  // Surah 9 (At-Tawbah) does NOT have Bismillah
  const NO_BISMILLAH_SURAH = 9;
  const DEFAULT_TRANSLATION = 131;

  const STORAGE_KEYS = {
    FONT_SIZE: 'quran_font_size',
    LAST_SURAH: 'quran_last_surah',
    TRANSLATION: 'quran_translation'
  };

  // DOM refs
  const surahSelect = document.getElementById('surah-select');
  const versesContainer = document.getElementById('verses-container');
  const surahInfoCard = document.getElementById('surah-info');
  const surahNameAr = document.getElementById('surah-name-ar');
  const surahNameEn = document.getElementById('surah-name-en');
  const surahRevelation = document.getElementById('surah-revelation');
  const surahAyahs = document.getElementById('surah-ayahs');
  const bismillahBanner = document.getElementById('bismillah');
  const scrollTopBtn = document.getElementById('scroll-top');
  const translationBtns = document.querySelectorAll('.toggle-btn');
  const sizeBtns = document.querySelectorAll('.size-btn');

  const announcer = createAnnouncer();

  let currentTranslation = DEFAULT_TRANSLATION;
  let currentSurahId = null;
  let isLoading = false;
  let pendingSurahId = null;
  let loadToken = 0;

  const SUPPORTED_TRANSLATIONS = new Set(
    Object.keys((window.API && window.API.TRANSLATIONS) || { 131: true, 167: true }).map(Number)
  );

  /* ---------- Init ---------- */
  async function init() {
    setupTranslationToggle();
    setupFontSize();
    setupScrollTop();
    setupVerseActions();
    setupKeyboardShortcuts();

    await loadSurahList();
    restorePreferences();
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

  function setBusy(isBusy) {
    versesContainer.setAttribute('aria-busy', String(Boolean(isBusy)));
    surahSelect.disabled = Boolean(isBusy);
  }

  /* ---------- Load Surah List ---------- */
  async function loadSurahList() {
    try {
      const chapters = await API.fetchChapters();
      surahSelect.innerHTML = '<option value="">- Select a Surah -</option>';
      chapters.forEach((ch) => {
        const opt = document.createElement('option');
        opt.value = ch.id;
        opt.textContent = `${ch.id}. ${ch.name_simple} - ${ch.name_arabic}`;
        surahSelect.appendChild(opt);
      });

      surahSelect.addEventListener('change', () => {
        const id = Utils.normalizeSurahId(surahSelect.value);
        if (id) loadSurah(id);
      });
    } catch (err) {
      surahSelect.innerHTML = '<option value="">Failed to load surahs</option>';
      console.error('Failed to load chapter list:', err);
      showError(err);
    }
  }

  function restorePreferences() {
    const savedTranslation = parseInt(localStorage.getItem(STORAGE_KEYS.TRANSLATION), 10);
    if (SUPPORTED_TRANSLATIONS.has(savedTranslation)) {
      setTranslation(savedTranslation, false);
    } else {
      setTranslation(DEFAULT_TRANSLATION, false);
    }

    const savedSize = localStorage.getItem(STORAGE_KEYS.FONT_SIZE) || 'medium';
    applyFontSize(savedSize, false);

    const lastSurahRaw = sessionStorage.getItem('lastSurah') || localStorage.getItem(STORAGE_KEYS.LAST_SURAH);
    const lastSurah = Utils.normalizeSurahId(lastSurahRaw);
    if (lastSurah) {
      surahSelect.value = String(lastSurah);
      loadSurah(lastSurah);
    }
  }

  /* ---------- Load & Render Surah ---------- */
  async function loadSurah(surahId) {
    const normalizedId = Utils.normalizeSurahId(surahId);
    if (!normalizedId) return;

    if (isLoading) {
      pendingSurahId = normalizedId;
      return;
    }

    isLoading = true;
    currentSurahId = normalizedId;
    sessionStorage.setItem('lastSurah', String(normalizedId));
    localStorage.setItem(STORAGE_KEYS.LAST_SURAH, String(normalizedId));

    const token = ++loadToken;
    showLoader();
    setBusy(true);
    surahInfoCard.classList.add('hidden');
    bismillahBanner.classList.add('hidden');

    try {
      const [chapter, verses] = await Promise.all([
        API.fetchChapter(normalizedId),
        API.fetchVerses(normalizedId, currentTranslation)
      ]);

      if (token !== loadToken) return;

      renderSurahInfo(chapter);
      renderBismillah(normalizedId);
      renderVerses(verses);
    } catch (err) {
      if (token !== loadToken) return;
      showError(err);
    } finally {
      if (token === loadToken) {
        isLoading = false;
        setBusy(false);

        if (pendingSurahId && pendingSurahId !== currentSurahId) {
          const queued = pendingSurahId;
          pendingSurahId = null;
          loadSurah(queued);
        }
      }
    }
  }

  /* ---------- Render Surah Info Card ---------- */
  function renderSurahInfo(chapter) {
    surahNameAr.textContent = chapter.name_arabic;
    surahNameEn.textContent = chapter.translated_name?.name || chapter.name_simple;
    surahRevelation.textContent = chapter.revelation_place === 'makkah' ? 'Meccan' : 'Medinan';
    surahAyahs.textContent = chapter.verses_count;
    surahInfoCard.classList.remove('hidden');
  }

  /* ---------- Render Bismillah ---------- */
  function renderBismillah(surahId) {
    bismillahBanner.classList.toggle('hidden', surahId === NO_BISMILLAH_SURAH);
  }

  /* ---------- Render Verses ---------- */
  function renderVerses(verses) {
    if (!Array.isArray(verses) || verses.length === 0) {
      versesContainer.innerHTML = '<div class="error-state"><h3>No verses found</h3></div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    const surahLabel = surahNameEn.textContent || `Surah ${currentSurahId}`;

    verses.forEach((verse, i) => {
      const verseNum = verse.verse_number || (i + 1);
      const arabicNum = Utils.toArabicNumeral(verseNum);
      const arabicText = verse.text_uthmani || '';
      const cleanTranslation = Utils.sanitizeTranslationText(verse.translations?.[0]?.text || '');
      const copyText = [
        `${surahLabel} - Ayah ${verseNum}`,
        arabicText,
        cleanTranslation
      ].filter(Boolean).join('\n');

      const card = document.createElement('article');
      card.className = 'verse-card';
      card.style.animationDelay = `${Math.min(i * 0.03, 0.4)}s`;

      const header = document.createElement('div');
      header.className = 'verse-header';

      const badge = document.createElement('div');
      badge.className = 'ayah-badge';
      badge.title = `Ayah ${verseNum}`;
      badge.textContent = arabicNum;

      const actions = document.createElement('div');
      actions.className = 'verse-actions';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'verse-copy-btn';
      copyBtn.dataset.copyText = copyText;
      copyBtn.setAttribute('aria-label', `Copy ayah ${verseNum}`);
      copyBtn.textContent = 'Copy';

      actions.appendChild(copyBtn);
      header.appendChild(actions);
      header.appendChild(badge);

      const arabic = document.createElement('div');
      arabic.className = 'arabic-text';
      arabic.textContent = arabicText;

      const divider = document.createElement('div');
      divider.className = 'verse-divider';

      const translation = document.createElement('div');
      translation.className = 'translation-text';
      translation.textContent = cleanTranslation || 'Translation unavailable.';

      card.appendChild(header);
      card.appendChild(arabic);
      card.appendChild(divider);
      card.appendChild(translation);

      fragment.appendChild(card);
    });

    const endMark = document.createElement('div');
    endMark.className = 'surah-complete';
    endMark.textContent = `End of Surah - ${verses.length} Ayahs`;
    fragment.appendChild(endMark);

    versesContainer.replaceChildren(fragment);

    if (!surahInfoCard.classList.contains('hidden')) {
      surahInfoCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ---------- Loader / Error States ---------- */
  function showLoader() {
    const offlineMessage = !navigator.onLine ? '<p>You appear to be offline. Trying cached data...</p>' : '';
    versesContainer.innerHTML = `
      <div class="loading-state">
        <div class="loader"></div>
        <p>Loading surah...</p>
        ${offlineMessage}
      </div>`;
  }

  function showError(err) {
    console.error(err);
    const safeMessage = String(err?.message || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const offlineHint = !navigator.onLine
      ? 'You appear to be offline and no cached copy was found.'
      : 'Please check your internet connection and try again.';

    versesContainer.innerHTML = `
      <div class="error-state">
        <h3>Failed to load</h3>
        <p>${offlineHint}</p>
        <button type="button" class="btn btn-primary" id="retry-surah-btn" style="margin-top:14px">Retry</button>
        <p style="margin-top:8px;font-size:0.75rem;color:var(--text-faint)">${safeMessage}</p>
      </div>`;
  }

  /* ---------- Actions ---------- */
  function setupVerseActions() {
    versesContainer.addEventListener('click', async (event) => {
      const retryBtn = event.target.closest('#retry-surah-btn');
      if (retryBtn && currentSurahId) {
        loadSurah(currentSurahId);
        return;
      }

      const copyBtn = event.target.closest('.verse-copy-btn');
      if (!copyBtn) return;

      const text = copyBtn.dataset.copyText || '';
      if (!text) return;

      try {
        await copyToClipboard(text);
        copyBtn.textContent = 'Copied';
        announce('Ayah copied to clipboard');
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
        }, 1000);
      } catch (err) {
        console.error('Copy failed:', err);
        announce('Copy failed');
      }
    });
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const temp = document.createElement('textarea');
    temp.value = text;
    temp.setAttribute('readonly', 'true');
    temp.style.position = 'absolute';
    temp.style.left = '-9999px';
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    temp.remove();
  }

  /* ---------- Translation Toggle ---------- */
  function setupTranslationToggle() {
    translationBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTranslation = parseInt(btn.dataset.translation, 10);
        if (!SUPPORTED_TRANSLATIONS.has(nextTranslation)) return;
        if (nextTranslation === currentTranslation) return;

        setTranslation(nextTranslation, true);
        if (currentSurahId) loadSurah(currentSurahId);
      });
    });
  }

  function setTranslation(id, persist = true) {
    if (!SUPPORTED_TRANSLATIONS.has(id)) return;

    currentTranslation = id;
    translationBtns.forEach((btn) => {
      const active = parseInt(btn.dataset.translation, 10) === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    if (persist) localStorage.setItem(STORAGE_KEYS.TRANSLATION, String(id));
  }

  /* ---------- Font Size Toggle ---------- */
  function setupFontSize() {
    sizeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        applyFontSize(btn.dataset.size, true);
      });
    });
  }

  function applyFontSize(size, persist = true) {
    const sizeClasses = { small: 'font-small', medium: 'font-medium', large: 'font-large' };
    const selected = sizeClasses[size] ? size : 'medium';

    sizeBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.size === selected);
    });

    Object.values(sizeClasses).forEach((className) => document.body.classList.remove(className));
    document.body.classList.add(sizeClasses[selected]);

    if (persist) localStorage.setItem(STORAGE_KEYS.FONT_SIZE, selected);
  }

  /* ---------- Scroll To Top ---------- */
  function setupScrollTop() {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        scrollTopBtn.classList.remove('hidden');
      } else {
        scrollTopBtn.classList.add('hidden');
      }
    });

    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- Keyboard Navigation ---------- */
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (event) => {
      if (isEditableTarget(event.target)) return;

      const key = String(event.key || '').toLowerCase();
      if (key === 'j' || event.key === 'ArrowRight') {
        const nextId = Utils.getAdjacentSurahId(currentSurahId || 1, 1);
        if (!nextId || nextId === currentSurahId) return;
        surahSelect.value = String(nextId);
        loadSurah(nextId);
        return;
      }

      if (key === 'k' || event.key === 'ArrowLeft') {
        const prevId = Utils.getAdjacentSurahId(currentSurahId || 1, -1);
        if (!prevId || prevId === currentSurahId) return;
        surahSelect.value = String(prevId);
        loadSurah(prevId);
      }
    });
  }

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', init);
})();

