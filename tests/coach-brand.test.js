import { test } from 'node:test';
import assert from 'node:assert';
import { defaultCoachBrand, mergeCoachBrand } from '../coach-brand.js';

test('defaultCoachBrand returns Bix defaults', () => {
  const brand = defaultCoachBrand();
  assert.strictEqual(brand.displayName, 'Bix');
  assert.strictEqual(brand.primaryColor, '#0A84FF');
  assert.strictEqual(brand.accentColor, '#34C759');
  assert.strictEqual(brand.logoUrl, null);
});

test('mergeCoachBrand fills in missing fields with defaults', () => {
  const partial = { displayName: 'Coach Mike Training' };
  const merged = mergeCoachBrand(partial);
  assert.strictEqual(merged.displayName, 'Coach Mike Training');
  assert.strictEqual(merged.primaryColor, '#0A84FF');
});

test('mergeCoachBrand handles null/undefined gracefully', () => {
  assert.deepStrictEqual(mergeCoachBrand(null), defaultCoachBrand());
  assert.deepStrictEqual(mergeCoachBrand(undefined), defaultCoachBrand());
});
