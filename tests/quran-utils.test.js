const test = require('node:test');
const assert = require('node:assert/strict');

const QuranUtils = require('../js/utils/quran-utils.js');

test('toArabicNumeral converts latin digits to eastern arabic digits', () => {
  assert.equal(QuranUtils.toArabicNumeral(1234567890), '١٢٣٤٥٦٧٨٩٠');
});

test('sanitizeTranslationText strips tags and normalizes entities/whitespace', () => {
  const raw = '<sup>1</sup>In&nbsp;the&nbsp;name &amp; mercy';
  assert.equal(QuranUtils.sanitizeTranslationText(raw), '1In the name & mercy');
});

test('normalizeSurahId clamps to valid Quran chapter range', () => {
  assert.equal(QuranUtils.normalizeSurahId(0), 1);
  assert.equal(QuranUtils.normalizeSurahId(115), 114);
  assert.equal(QuranUtils.normalizeSurahId('27'), 27);
  assert.equal(QuranUtils.normalizeSurahId('bad'), null);
});

test('getAdjacentSurahId stays within boundaries', () => {
  assert.equal(QuranUtils.getAdjacentSurahId(1, -1), 1);
  assert.equal(QuranUtils.getAdjacentSurahId(114, 1), 114);
  assert.equal(QuranUtils.getAdjacentSurahId(10, 1), 11);
});

test('safeJsonParse returns fallback on invalid JSON', () => {
  const fallback = { ok: false };
  assert.deepEqual(QuranUtils.safeJsonParse('{bad-json}', fallback), fallback);
});
