/* =========================================================
   QURAN.JS — Quran Reader Logic
   ========================================================= */

(function () {
  // Surah 9 (At-Tawbah) does NOT have Bismillah
  const NO_BISMILLAH_SURAH = 9;

  // Eastern Arabic-Indic numerals
  const toArabicNumeral = (n) =>
    String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

  // DOM refs
  const surahSelect   = document.getElementById('surah-select');
  const versesContainer = document.getElementById('verses-container');
  const surahInfoCard = document.getElementById('surah-info');
  const surahNameAr   = document.getElementById('surah-name-ar');
  const surahNameEn   = document.getElementById('surah-name-en');
  const surahRevelation = document.getElementById('surah-revelation');
  const surahAyahs    = document.getElementById('surah-ayahs');
  const bismillahBanner = document.getElementById('bismillah');
  const scrollTopBtn  = document.getElementById('scroll-top');
  const translationBtns = document.querySelectorAll('.toggle-btn');
  const sizeBtns      = document.querySelectorAll('.size-btn');

  let currentTranslation = 131;
  let currentSurahId = null;
  let isLoading = false;

  /* ---------- Init ---------- */
  async function init() {
    await loadSurahList();
    setupTranslationToggle();
    setupFontSize();
    setupScrollTop();

    // Restore last viewed surah
    const lastSurah = sessionStorage.getItem('lastSurah');
    if (lastSurah) {
      surahSelect.value = lastSurah;
      loadSurah(parseInt(lastSurah));
    }
  }

  /* ---------- Load Surah List ---------- */
  async function loadSurahList() {
    try {
      const chapters = await API.fetchChapters();
      surahSelect.innerHTML = '<option value="">— Select a Surah —</option>';
      chapters.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch.id;
        opt.textContent = `${ch.id}. ${ch.name_simple} — ${ch.name_arabic}`;
        surahSelect.appendChild(opt);
      });
      surahSelect.addEventListener('change', () => {
        const id = parseInt(surahSelect.value);
        if (id) loadSurah(id);
      });
    } catch (err) {
      surahSelect.innerHTML = '<option value="">Failed to load surahs</option>';
      console.error('Failed to load chapter list:', err);
    }
  }

  /* ---------- Load & Render Surah ---------- */
  async function loadSurah(surahId) {
    if (isLoading) return;
    isLoading = true;
    currentSurahId = surahId;

    // Store in session
    sessionStorage.setItem('lastSurah', surahId);

    // Show loader
    showLoader();
    surahInfoCard.classList.add('hidden');
    bismillahBanner.classList.add('hidden');

    try {
      const [chapter, verses] = await Promise.all([
        API.fetchChapter(surahId),
        API.fetchVerses(surahId, currentTranslation)
      ]);

      renderSurahInfo(chapter);
      renderBismillah(surahId);
      renderVerses(verses, surahId);
    } catch (err) {
      showError(err);
    } finally {
      isLoading = false;
    }
  }

  /* ---------- Render Surah Info Card ---------- */
  function renderSurahInfo(ch) {
    surahNameAr.textContent = ch.name_arabic;
    surahNameEn.textContent = ch.translated_name?.name || ch.name_simple;
    surahRevelation.textContent =
      ch.revelation_place === 'makkah' ? 'Meccan' : 'Medinan';
    surahAyahs.textContent = ch.verses_count;
    surahInfoCard.classList.remove('hidden');
  }

  /* ---------- Render Bismillah ---------- */
  function renderBismillah(surahId) {
    if (surahId === NO_BISMILLAH_SURAH) {
      bismillahBanner.classList.add('hidden');
    } else {
      bismillahBanner.classList.remove('hidden');
    }
  }

  /* ---------- Render Verses ---------- */
  function renderVerses(verses, surahId) {
    versesContainer.innerHTML = '';

    verses.forEach((verse, i) => {
      const card = document.createElement('div');
      card.className = 'verse-card';
      card.style.animationDelay = `${Math.min(i * 0.03, 0.4)}s`;

      const verseNum = verse.verse_number || (i + 1);
      const arabicNum = toArabicNumeral(verseNum);
      const arabicText = verse.text_uthmani || '';
      const translation = verse.translations?.[0]?.text || '';

      // Strip HTML tags from translation (some have <sup> footnote marks)
      const cleanTranslation = translation.replace(/<[^>]+>/g, '');

      card.innerHTML = `
        <div class="verse-header">
          <div class="ayah-badge" title="Ayah ${verseNum}">${arabicNum}</div>
        </div>
        <div class="arabic-text">${arabicText}</div>
        <div class="verse-divider"></div>
        <div class="translation-text">${cleanTranslation}</div>
      `;

      versesContainer.appendChild(card);
    });

    // End-of-surah marker
    const endMark = document.createElement('div');
    endMark.className = 'surah-complete';
    endMark.textContent = `End of Surah — ${verses.length} Ayahs`;
    versesContainer.appendChild(endMark);

    // Scroll to top of content
    surahInfoCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Loader / Error States ---------- */
  function showLoader() {
    versesContainer.innerHTML = `
      <div class="loading-state">
        <div class="loader"></div>
        <p>Loading surah...</p>
      </div>`;
  }

  function showError(err) {
    console.error(err);
    versesContainer.innerHTML = `
      <div class="error-state">
        <h3>Failed to load</h3>
        <p>Please check your internet connection and try again.</p>
        <p style="margin-top:8px;font-size:0.75rem;color:var(--text-faint)">${err.message || ''}</p>
      </div>`;
  }

  /* ---------- Translation Toggle ---------- */
  function setupTranslationToggle() {
    translationBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const newTrans = parseInt(btn.dataset.translation);
        if (newTrans === currentTranslation) return;

        translationBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTranslation = newTrans;

        if (currentSurahId) loadSurah(currentSurahId);
      });
    });
  }

  /* ---------- Font Size Toggle ---------- */
  function setupFontSize() {
    const sizeClasses = { small: 'font-small', medium: 'font-medium', large: 'font-large' };

    sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        Object.values(sizeClasses).forEach(c => document.body.classList.remove(c));
        document.body.classList.add(sizeClasses[btn.dataset.size]);

        localStorage.setItem('quran_font_size', btn.dataset.size);
      });
    });

    // Restore saved size
    const savedSize = localStorage.getItem('quran_font_size') || 'medium';
    const savedBtn = document.querySelector(`.size-btn[data-size="${savedSize}"]`);
    if (savedBtn) savedBtn.click();
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

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', init);
})();
