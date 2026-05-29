import { test } from 'node:test';
import assert from 'node:assert';
import { isRestDay, attendanceRate, shouldSendRescueNudge, ATTENDANCE_THRESHOLD } from '../rescue-nudge-logic.js';

const NOW = new Date('2026-05-29T10:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();

const baseClient = {
  fcmToken: 'fake-token',
  name: 'Sarah',
  restDayMarkedAt: null,
};

const baseWorkout = {
  clientId: 'client-1',
  scheduledAt: daysAgo(0), // scheduled "just now" for testing purposes
};

// ── isRestDay ────────────────────────────────────────────────────────────────

test('isRestDay: false when restDayMarkedAt is null', () => {
  assert.strictEqual(isRestDay({ restDayMarkedAt: null }, NOW), false);
});

test('isRestDay: false when marked a different day', () => {
  assert.strictEqual(isRestDay({ restDayMarkedAt: daysAgo(1) }, NOW), false);
});

test('isRestDay: true when marked today', () => {
  const today = NOW.toISOString().slice(0, 10) + 'T00:00:00Z';
  assert.strictEqual(isRestDay({ restDayMarkedAt: today }, NOW), true);
});

// ── attendanceRate ───────────────────────────────────────────────────────────

test('attendanceRate: returns 1 with no scheduled workouts', () => {
  assert.strictEqual(attendanceRate([], NOW.getTime()), 1);
});

test('attendanceRate: 100% when all completed', () => {
  const workouts = [
    { scheduledAt: daysAgo(2), completedAt: daysAgo(2) },
    { scheduledAt: daysAgo(5), completedAt: daysAgo(5) },
  ];
  assert.strictEqual(attendanceRate(workouts, NOW.getTime()), 1);
});

test('attendanceRate: 50% when half completed', () => {
  const workouts = [
    { scheduledAt: daysAgo(2), completedAt: daysAgo(2) },
    { scheduledAt: daysAgo(3) },
  ];
  assert.strictEqual(attendanceRate(workouts, NOW.getTime()), 0.5);
});

test('attendanceRate: ignores workouts older than 30 days', () => {
  const workouts = [
    { scheduledAt: daysAgo(31) }, // old, no completedAt
    { scheduledAt: daysAgo(2), completedAt: daysAgo(2) }, // recent, completed
  ];
  // Only 1 recent workout, 1 completed → 100%
  assert.strictEqual(attendanceRate(workouts, NOW.getTime()), 1);
});

// ── shouldSendRescueNudge ───────────────────────────────────────────────────

const goodWorkouts = [
  { scheduledAt: daysAgo(7), completedAt: daysAgo(7) },
  { scheduledAt: daysAgo(14), completedAt: daysAgo(14) },
  { scheduledAt: daysAgo(21), completedAt: daysAgo(21) },
];

test('happy path: nudge sends when all guards pass', () => {
  assert.strictEqual(
    shouldSendRescueNudge(baseWorkout, baseClient, goodWorkouts, NOW),
    true
  );
});

test('already completed: no nudge', () => {
  const workout = { ...baseWorkout, completedAt: daysAgo(0) };
  assert.strictEqual(shouldSendRescueNudge(workout, baseClient, goodWorkouts, NOW), false);
});

test('already nudged: no second nudge', () => {
  const workout = { ...baseWorkout, rescueNudgeSentAt: daysAgo(0) };
  assert.strictEqual(shouldSendRescueNudge(workout, baseClient, goodWorkouts, NOW), false);
});

test('no FCM token: no nudge', () => {
  const client = { ...baseClient, fcmToken: null };
  assert.strictEqual(shouldSendRescueNudge(baseWorkout, client, goodWorkouts, NOW), false);
});

test('rest day marked today: no nudge', () => {
  const today = NOW.toISOString().slice(0, 10) + 'T00:00:00Z';
  const client = { ...baseClient, restDayMarkedAt: today };
  assert.strictEqual(shouldSendRescueNudge(baseWorkout, client, goodWorkouts, NOW), false);
});

test(`attendance below ${ATTENDANCE_THRESHOLD * 100}%: no nudge`, () => {
  const lowAttendance = [
    { scheduledAt: daysAgo(2) },                           // missed
    { scheduledAt: daysAgo(3) },                           // missed
    { scheduledAt: daysAgo(4) },                           // missed
    { scheduledAt: daysAgo(5), completedAt: daysAgo(5) },  // done
  ]; // 25% — below threshold
  assert.strictEqual(shouldSendRescueNudge(baseWorkout, baseClient, lowAttendance, NOW), false);
});

test('exactly 70% attendance: nudge sends', () => {
  const workouts = [
    { scheduledAt: daysAgo(2), completedAt: daysAgo(2) },
    { scheduledAt: daysAgo(3), completedAt: daysAgo(3) },
    { scheduledAt: daysAgo(4), completedAt: daysAgo(4) },
    { scheduledAt: daysAgo(5), completedAt: daysAgo(5) },
    { scheduledAt: daysAgo(6), completedAt: daysAgo(6) },
    { scheduledAt: daysAgo(7), completedAt: daysAgo(7) },
    { scheduledAt: daysAgo(8), completedAt: daysAgo(8) },
    { scheduledAt: daysAgo(9) },                           // missed
    { scheduledAt: daysAgo(10) },                          // missed
    { scheduledAt: daysAgo(11) },                          // missed
  ]; // 70% exactly
  assert.strictEqual(shouldSendRescueNudge(baseWorkout, baseClient, workouts, NOW), true);
});
