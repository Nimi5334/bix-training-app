import { test } from 'node:test';
import assert from 'node:assert';
import { jointAngle, analyzeSquat, analyzeDeadlift, analyzeExercise } from '../form-rules.js';

const lm = (x, y, v = 1) => ({ x, y, visibility: v });

function makeLandmarks(overrides = {}) {
  const arr = Array(33).fill(null).map(() => lm(0.5, 0.5));
  Object.entries(overrides).forEach(([i, val]) => { arr[parseInt(i)] = val; });
  return arr;
}

test('jointAngle: 90 degrees', () => {
  const angle = jointAngle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 });
  assert.ok(Math.abs(angle - 90) < 1, `Expected ~90, got ${angle}`);
});

test('jointAngle: 180 degrees (straight line)', () => {
  const angle = jointAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 });
  assert.ok(Math.abs(angle - 180) < 1, `Expected ~180, got ${angle}`);
});

test('squat: flags depth when hip above knee', () => {
  const lms = makeLandmarks({
    23: lm(0.5, 0.3), 24: lm(0.5, 0.3), // hip high
    25: lm(0.5, 0.6), 26: lm(0.5, 0.6), // knee lower
    27: lm(0.5, 0.9), 28: lm(0.5, 0.9),
  });
  const flags = analyzeSquat(lms);
  assert.ok(flags.some(f => f.id === 'depth'), 'Should flag depth');
});

test('squat: flags knee cave when knees inside ankles', () => {
  const lms = makeLandmarks({
    25: lm(0.5, 0.6), 26: lm(0.5, 0.6),   // knees centered
    27: lm(0.4, 0.9), 28: lm(0.6, 0.9),   // ankles wider
    23: lm(0.5, 0.5), 24: lm(0.5, 0.5),
  });
  const flags = analyzeSquat(lms);
  assert.ok(flags.some(f => f.id === 'knee_cave'), 'Should flag knee cave');
});

test('squat: no flags for good form', () => {
  const lms = makeLandmarks({
    23: lm(0.5, 0.62), 24: lm(0.5, 0.62), // hip at knee level
    25: lm(0.4, 0.6),  26: lm(0.6, 0.6),  // knees wide
    27: lm(0.4, 0.9),  28: lm(0.6, 0.9),  // ankles under knees
  });
  const flags = analyzeSquat(lms);
  assert.strictEqual(flags.length, 0, 'Good form should have no flags');
});

test('analyzeExercise: dispatches squat by name', () => {
  const lms = makeLandmarks({ 23: lm(0.5, 0.3), 25: lm(0.5, 0.6), 27: lm(0.5, 0.9) });
  const flags = analyzeExercise('Barbell Back Squat', lms);
  assert.ok(Array.isArray(flags));
});

test('analyzeExercise: unknown exercise returns empty array', () => {
  const flags = analyzeExercise('Jumping Jacks', makeLandmarks());
  assert.deepStrictEqual(flags, []);
});
