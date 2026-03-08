/* =========================================================
   API.JS — Quran.com API v4 + localStorage Cache
   Source: https://api.quran.com/api/v4
   Arabic text: Tanzil Project (Uthmani script)
   ========================================================= */

const API = (() => {
  const BASE = 'https://api.quran.com/api/v4';

  // Translation IDs (Quran.com verified)
  const TRANSLATIONS = {
    131: 'Sahih International',
    167: 'The Clear Quran (Dr. Mustafa Khattab)'
  };

  // Cache helpers
  const CACHE_PREFIX = 'quran_v1_';
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function cacheSet(key, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {
      // localStorage full — clear old quran entries and retry
      clearOldCache();
      try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data })); } catch {}
    }
  }

  function clearOldCache() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  }

  async function apiFetch(path) {
    const resp = await fetch(BASE + path, {
      headers: { Accept: 'application/json' }
    });
    if (!resp.ok) throw new Error(`API error ${resp.status}: ${resp.statusText}`);
    return resp.json();
  }

  // --- Public Methods ---

  /**
   * Fetch list of all 114 chapters.
   * Returns: Array of chapter objects
   */
  async function fetchChapters() {
    const cached = cacheGet('chapters');
    if (cached) return cached;

    const json = await apiFetch('/chapters?language=en');
    const chapters = json.chapters;
    cacheSet('chapters', chapters);
    return chapters;
  }

  /**
   * Fetch a single chapter's metadata.
   */
  async function fetchChapter(id) {
    const cached = cacheGet(`chapter_${id}`);
    if (cached) return cached;

    const json = await apiFetch(`/chapters/${id}`);
    const chapter = json.chapter;
    cacheSet(`chapter_${id}`, chapter);
    return chapter;
  }

  /**
   * Fetch all verses of a chapter with Uthmani Arabic text and translation.
   * @param {number} chapterId  - 1 to 114
   * @param {number} translationId - 131 (Sahih Int.) or 167 (Clear Quran)
   * Returns: Array of verse objects
   */
  async function fetchVerses(chapterId, translationId = 131) {
    const cacheKey = `verses_${chapterId}_${translationId}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    // per_page=300 covers the longest surah (Al-Baqarah = 286 verses)
    const path = `/verses/by_chapter/${chapterId}?language=en&translations=${translationId}&fields=text_uthmani&per_page=300&page=1`;
    const json = await apiFetch(path);
    const verses = json.verses;
    cacheSet(cacheKey, verses);
    return verses;
  }

  return { fetchChapters, fetchChapter, fetchVerses, TRANSLATIONS };
})();
