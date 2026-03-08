const test = require('node:test');
const assert = require('node:assert/strict');

const TasbihUtils = require('../js/utils/tasbih-utils.js');

test('clampTarget enforces bounds and defaults', () => {
  assert.equal(TasbihUtils.clampTarget('bad'), 33);
  assert.equal(TasbihUtils.clampTarget(0), 1);
  assert.equal(TasbihUtils.clampTarget(2500), 1000);
  assert.equal(TasbihUtils.clampTarget(99), 99);
});

test('sanitizeCustomPhase returns non-empty phrase and valid target', () => {
  const sanitized = TasbihUtils.sanitizeCustomPhase('   ', -5);
  assert.equal(sanitized.arabic, 'ذِكْر');
  assert.equal(sanitized.target, 1);
});

test('getCurrentTarget reflects mode correctly', () => {
  assert.equal(TasbihUtils.getCurrentTarget('preset', 0, {}), 33);
  assert.equal(TasbihUtils.getCurrentTarget('custom', 0, { arabic: 'abc', target: 1200 }), 1000);
  assert.equal(TasbihUtils.getCurrentTarget('free', 0, {}), Infinity);
});

test('getCurrentDhikr returns expected labels per mode', () => {
  assert.equal(TasbihUtils.getCurrentDhikr('preset', 1, {}).translit, 'Alhamdulillah');
  assert.equal(TasbihUtils.getCurrentDhikr('custom', 0, { arabic: 'س', target: 10 }).translit, 'Custom Dhikr');
  assert.equal(TasbihUtils.getCurrentDhikr('free', 0, {}).translit, 'Free Mode');
});

test('createInitialState starts at a clean preset session', () => {
  const initial = TasbihUtils.createInitialState();
  assert.equal(initial.mode, 'preset');
  assert.equal(initial.phaseIndex, 0);
  assert.equal(initial.count, 0);
  assert.equal(initial.totalCount, 0);
  assert.deepEqual(initial.phaseCounts, [0, 0, 0]);
});
