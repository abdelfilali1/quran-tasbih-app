/* =========================================================
   QURAN-UTILS.JS - Shared pure helpers for reader logic
   Exposes `QuranUtils` on window and `module.exports` in Node.
   ========================================================= */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.QuranUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const EASTERN_ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toArabicNumeral(value) {
    const safe = Number.isFinite(Number(value)) ? String(value) : '0';
    return safe.replace(/\d/g, (d) => EASTERN_ARABIC_DIGITS[d]);
  }

  function stripHtmlTags(input) {
    return String(input || '').replace(/<[^>]+>/g, '');
  }

  function decodeBasicEntities(input) {
    const text = String(input || '');
    return text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  function normalizeWhitespace(input) {
    return String(input || '').replace(/\s+/g, ' ').trim();
  }

  function sanitizeTranslationText(input) {
    return normalizeWhitespace(decodeBasicEntities(stripHtmlTags(input)));
  }

  function safeJsonParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function normalizeSurahId(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return null;
    return clamp(parsed, 1, 114);
  }

  function getAdjacentSurahId(currentId, delta) {
    const current = normalizeSurahId(currentId);
    if (!current) return null;
    return clamp(current + (delta || 0), 1, 114);
  }

  return {
    clamp,
    decodeBasicEntities,
    getAdjacentSurahId,
    normalizeSurahId,
    safeJsonParse,
    sanitizeTranslationText,
    stripHtmlTags,
    toArabicNumeral
  };
});
