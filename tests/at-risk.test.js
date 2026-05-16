import { test } from 'node:test';
import assert from 'node:assert';
import { calculateChurnRisk, AT_RISK_RULES } from '../at-risk.js';

const now = new Date('2026-05-04T12:00:00Z');
const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString();

test('healthy client = score 0', () => {
  const result = calculateChurnRisk({
    lastAppOpenAt: daysAgo(1),
    lastWorkoutEnteredAt: daysAgo(1),
    skippedWorkoutsLast7Days: 0,
    avgRpeLast6Days: 7,
    baselineRpe: 7,
    lastChatReplyAt: daysAgo(1)
  }, now);
  assert.strictEqual(result.score, 0);
  assert.deepStrictEqual(result.triggered, []);
});

test('5+ days no app open triggers rule', () => {
  const result = calculateChurnRisk({
    lastAppOpenAt: daysAgo(6),
    lastWorkoutEnteredAt: daysAgo(1),
    skippedWorkoutsLast7Days: 0,
    avgRpeLast6Days: 7,
    baselineRpe: 7,
    lastChatReplyAt: daysAgo(1)
  }, now);
  assert.ok(result.score > 0);
  assert.ok(result.triggered.includes('no_app_open_5d'));
});

test('3+ days no workout triggers rule', () => {
  const result = calculateChurnRisk({
    lastAppOpenAt: daysAgo(1),
    lastWorkoutEnteredAt: daysAgo(4),
    skippedWorkoutsLast7Days: 0,
    avgRpeLast6Days: 7,
    baselineRpe: 7,
    lastChatReplyAt: daysAgo(1)
  }, now);
  assert.ok(result.triggered.includes('no_workout_3d'));
});

test('2+ skipped workouts triggers rule', () => {
  const result = calculateChurnRisk({
    lastAppOpenAt: daysAgo(1),
    lastWorkoutEnteredAt: daysAgo(1),
    skippedWorkoutsLast7Days: 2,
    avgRpeLast6Days: 7,
    baselineRpe: 7,
    lastChatReplyAt: daysAgo(1)
  }, now);
  assert.ok(result.triggered.includes('skipped_2_in_7d'));
});

test('RPE creep +1.5 over baseline triggers rule', () => {
  const result = calculateChurnRisk({
    lastAppOpenAt: daysAgo(1),
    lastWorkoutEnteredAt: daysAgo(1),
    skippedWorkoutsLast7Days: 0,
    avgRpeLast6Days: 8.6,
    baselineRpe: 7,
    lastChatReplyAt: daysAgo(1)
  }, now);
  assert.ok(result.triggered.includes('rpe_creep'));
});

test('4+ days no chat reply triggers rule', () => {
  const result = calculateChurnRisk({
    lastAppOpenAt: daysAgo(1),
    lastWorkoutEnteredAt: daysAgo(1),
    skippedWorkoutsLast7Days: 0,
    avgRpeLast6Days: 7,
    baselineRpe: 7,
    lastChatReplyAt: daysAgo(5)
  }, now);
  assert.ok(result.triggered.includes('no_chat_reply_4d'));
});

test('multiple triggers stack score', () => {
  const result = calculateChurnRisk({
    lastAppOpenAt: daysAgo(7),
    lastWorkoutEnteredAt: daysAgo(5),
    skippedWorkoutsLast7Days: 3,
    avgRpeLast6Days: 9,
    baselineRpe: 7,
    lastChatReplyAt: daysAgo(6)
  }, now);
  assert.strictEqual(result.triggered.length, 5);
  assert.ok(result.score >= 70);
});

test('score capped at 100', () => {
  const result = calculateChurnRisk({
    lastAppOpenAt: daysAgo(30),
    lastWorkoutEnteredAt: daysAgo(30),
    skippedWorkoutsLast7Days: 7,
    avgRpeLast6Days: 10,
    baselineRpe: 5,
    lastChatReplyAt: daysAgo(30)
  }, now);
  assert.strictEqual(result.score, 100);
});

test('AT_RISK_RULES exposes rule metadata', () => {
  assert.ok(AT_RISK_RULES.length === 5);
  assert.ok(AT_RISK_RULES.every(r => r.id && r.label && r.weight));
});
