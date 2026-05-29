import { test } from 'node:test';
import assert from 'node:assert';
import { computeEarnedBadges, getNewBadges, computeStats } from '../achievements.js';

test('first-rep badge earned after 1 workout', () => {
  const badges = computeEarnedBadges({ totalWorkouts: 1, longestStreak: 0, totalPRs: 0, weeklyVolume: 0 });
  assert.ok(badges.some(b => b.id === 'first-rep'));
});

test('half-centurion unlocks at 50 workouts', () => {
  const badges = computeEarnedBadges({ totalWorkouts: 50, longestStreak: 0, totalPRs: 0, weeklyVolume: 0 });
  assert.ok(badges.some(b => b.id === 'half-centurion'));
});

test('half-centurion NOT earned at 49 workouts', () => {
  const badges = computeEarnedBadges({ totalWorkouts: 49, longestStreak: 0, totalPRs: 0, weeklyVolume: 0 });
  assert.ok(!badges.some(b => b.id === 'half-centurion'));
});

test('iron-will requires 180 streak days', () => {
  const badges = computeEarnedBadges({ totalWorkouts: 200, longestStreak: 180, totalPRs: 0, weeklyVolume: 0 });
  assert.ok(badges.some(b => b.id === 'iron-will'));
});

test('pr-hunter requires 10 PRs', () => {
  const badges = computeEarnedBadges({ totalWorkouts: 100, longestStreak: 0, totalPRs: 10, weeklyVolume: 0 });
  assert.ok(badges.some(b => b.id === 'pr-hunter'));
});

test('getNewBadges returns only newly earned badges', () => {
  const current = [{ id: 'first-rep' }, { id: 'half-centurion' }];
  const newBadges = getNewBadges(current, ['first-rep']);
  assert.strictEqual(newBadges.length, 1);
  assert.strictEqual(newBadges[0].id, 'half-centurion');
});

test('computeStats aggregates correctly', () => {
  const today = new Date().toISOString().slice(0, 10);
  const logs = [{ totalVolume: 500, date: today }, { totalVolume: 300, date: today }];
  const stats = computeStats(logs, [{ exercise: 'squat' }], 14);
  assert.strictEqual(stats.totalWorkouts, 2);
  assert.strictEqual(stats.totalPRs, 1);
  assert.strictEqual(stats.weeklyVolume, 800);
  assert.strictEqual(stats.longestStreak, 14);
});
