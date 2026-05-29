import { test } from 'node:test';
import assert from 'node:assert';

// Pure helper — mirrors DB.joinGymByInviteCode validation logic
function validateGymJoin(gym, coachId) {
  if (!gym) return { ok: false, error: 'Invalid invite code' };
  if (gym.coachIds.includes(coachId)) return { ok: false, error: 'Already in this gym' };
  if (gym.coachIds.length >= 5) return { ok: false, error: 'Gym is full (max 5 coaches)' };
  return { ok: true };
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

test('validateGymJoin: valid join succeeds', () => {
  const result = validateGymJoin({ coachIds: ['coach1'] }, 'coach2');
  assert.strictEqual(result.ok, true);
});

test('validateGymJoin: null gym = invalid invite code', () => {
  const result = validateGymJoin(null, 'coach1');
  assert.strictEqual(result.ok, false);
  assert.ok(result.error.includes('Invalid'));
});

test('validateGymJoin: already member returns error', () => {
  const result = validateGymJoin({ coachIds: ['coach1', 'coach2'] }, 'coach1');
  assert.strictEqual(result.ok, false);
  assert.ok(result.error.includes('Already'));
});

test('validateGymJoin: gym full at 5 coaches', () => {
  const result = validateGymJoin({ coachIds: ['c1','c2','c3','c4','c5'] }, 'c6');
  assert.strictEqual(result.ok, false);
  assert.ok(result.error.includes('full'));
});

test('validateGymJoin: exactly 4 coaches can accept 5th', () => {
  const result = validateGymJoin({ coachIds: ['c1','c2','c3','c4'] }, 'c5');
  assert.strictEqual(result.ok, true);
});

test('generateInviteCode: 6 chars uppercase', () => {
  const code = generateInviteCode();
  assert.strictEqual(code.length, 6);
  assert.strictEqual(code, code.toUpperCase());
});
