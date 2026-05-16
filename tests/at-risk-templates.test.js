import { test } from 'node:test';
import assert from 'node:assert';
import { draftSaveMessage, SAVE_TEMPLATES } from '../at-risk-templates.js';

test('SAVE_TEMPLATES has one template per rule', () => {
  const ruleIds = ['no_app_open_5d','no_workout_3d','skipped_2_in_7d','rpe_creep','no_chat_reply_4d'];
  ruleIds.forEach(id => {
    assert.ok(SAVE_TEMPLATES[id], `missing template for ${id}`);
  });
});

test('draftSaveMessage substitutes client name', () => {
  const msg = draftSaveMessage(['no_workout_3d'], { clientName: 'Sarah' });
  assert.ok(msg.includes('Sarah'));
});

test('draftSaveMessage picks the highest-priority rule when multiple', () => {
  const msg = draftSaveMessage(['no_app_open_5d', 'no_workout_3d'], { clientName: 'Sarah' });
  assert.ok(msg.length > 0);
  assert.ok(msg.includes('Sarah'));
});

test('draftSaveMessage with no triggers returns generic check-in', () => {
  const msg = draftSaveMessage([], { clientName: 'Sarah' });
  assert.ok(msg.toLowerCase().includes('how'));
});
