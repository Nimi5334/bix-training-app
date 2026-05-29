import { test } from 'node:test';
import assert from 'node:assert';

// Inline the pure logic — matches functions/ai-progression.js
function suggestAdjustment(avgRpe) {
  if (avgRpe <= 6)  return { kg: 5,    label: '+5kg',   reason: 'RPE well below target — room to progress' };
  if (avgRpe <= 7)  return { kg: 2.5,  label: '+2.5kg', reason: 'RPE on target — standard progression' };
  if (avgRpe <= 8)  return { kg: 0,    label: 'Hold',   reason: 'RPE high — consolidate this weight' };
  return              { kg: -2.5, label: 'Deload', reason: 'RPE critically high — reduce load' };
}

test('RPE 5 → +5kg', () => {
  assert.strictEqual(suggestAdjustment(5).kg, 5);
  assert.strictEqual(suggestAdjustment(5).label, '+5kg');
});

test('RPE 6 → +5kg', () => {
  assert.strictEqual(suggestAdjustment(6).kg, 5);
});

test('RPE 7 → +2.5kg', () => {
  assert.strictEqual(suggestAdjustment(7).kg, 2.5);
  assert.strictEqual(suggestAdjustment(7).label, '+2.5kg');
});

test('RPE 8 → hold', () => {
  assert.strictEqual(suggestAdjustment(8).kg, 0);
  assert.strictEqual(suggestAdjustment(8).label, 'Hold');
});

test('RPE 9 → deload', () => {
  assert.strictEqual(suggestAdjustment(9).kg, -2.5);
  assert.strictEqual(suggestAdjustment(9).label, 'Deload');
});

test('RPE 10 → deload', () => {
  assert.strictEqual(suggestAdjustment(10).kg, -2.5);
});
