import { test } from 'node:test';
import assert from 'node:assert';

function normalizeTier(tier, trialEndsAt, paidPro) {
  if (tier === 'pro' && trialEndsAt) {
    if (new Date(trialEndsAt) < new Date() && !paidPro) return 'free';
  }
  const base = tier || 'free';
  return base === 'studio' ? 'pro' : base;
}

test('studio tier maps to pro', () => {
  assert.strictEqual(normalizeTier('studio'), 'pro');
});

test('expired trial without paidPro → free', () => {
  assert.strictEqual(normalizeTier('pro', '2020-01-01', false), 'free');
});

test('expired trial with paidPro → pro', () => {
  assert.strictEqual(normalizeTier('pro', '2020-01-01', true), 'pro');
});

test('free tier stays free', () => {
  assert.strictEqual(normalizeTier('free'), 'free');
});

test('unknown tier defaults to free', () => {
  assert.strictEqual(normalizeTier(null), 'free');
});
