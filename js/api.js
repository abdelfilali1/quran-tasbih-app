/* =========================================================
   API.JS - Quran.com API v4 with resilient caching
   Source: https://api.quran.com/api/v4
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

  function cacheRead(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      return {
        data,
        isExpired: Date.now() - ts > CACHE_TTL_MS
      };
    } catch {
      return null;
    }
  }

  function cacheGet(key, allowExpired = false) {
    const entry = cacheRead(key);
    if (!entry) return null;
    if (entry.isExpired && !allowExpired) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.data;
  }

  function cacheSet(key, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      // localStorage quota exceeded; clear old entries and retry once.
      clearOldCache();
      try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
      } catch {}
    }
  }

  function clearOldCache() {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
  }

  async function apiFetch(path, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(BASE + path, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      if (!resp.ok) throw new Error(`API error ${resp.status}: ${resp.statusText}`);
      return resp.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  // --- Public Methods ---

  async function fetchChapters() {
    const cached = cacheGet('chapters');
    if (cached) return cached;

    try {
      const json = await apiFetch('/chapters?language=en');
      const chapters = json.chapters;
      cacheSet('chapters', chapters);
      return chapters;
    } catch (err) {
      const stale = cacheGet('chapters', true);
      if (stale) return stale;
      throw err;
    }
  }

  async function fetchChapter(id) {
    const key = `chapter_${id}`;
    const cached = cacheGet(key);
    if (cached) return cached;

    try {
      const json = await apiFetch(`/chapters/${id}`);
      const chapter = json.chapter;
      cacheSet(key, chapter);
      return chapter;
    } catch (err) {
      const stale = cacheGet(key, true);
      if (stale) return stale;
      throw err;
    }
  }

  async function fetchVerses(chapterId, translationId = 131) {
    const key = `verses_${chapterId}_${translationId}`;
    const cached = cacheGet(key);
    if (cached) return cached;

    try {
      // per_page=300 covers the longest surah (Al-Baqarah = 286 verses)
      const path = `/verses/by_chapter/${chapterId}?language=en&translations=${translationId}&fields=text_uthmani&per_page=300&page=1`;
      const json = await apiFetch(path);
      const verses = json.verses;
      cacheSet(key, verses);
      return verses;
    } catch (err) {
      const stale = cacheGet(key, true);
      if (stale) return stale;
      throw err;
    }
  }

  return { fetchChapters, fetchChapter, fetchVerses, TRANSLATIONS };
})();
