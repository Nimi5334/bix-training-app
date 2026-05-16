// at-risk.js
// Pure-logic engine: takes a client signal snapshot, returns churn risk
// score (0-100) plus list of triggered rule IDs. UI reads triggered IDs
// and shows the human-readable label from AT_RISK_RULES.

export const AT_RISK_RULES = [
  { id: 'no_app_open_5d',  label: '5+ days no app open',                weight: 20 },
  { id: 'no_workout_3d',   label: '3+ days no workout entered',         weight: 25 },
  { id: 'skipped_2_in_7d', label: '2+ scheduled workouts skipped',      weight: 25 },
  { id: 'rpe_creep',       label: 'Possible overtraining (RPE creep)',  weight: 15 },
  { id: 'no_chat_reply_4d',label: '4+ days no chat reply',              weight: 15 }
];

function daysBetween(iso, now) {
  if (!iso) return Infinity;
  return (now.getTime() - new Date(iso).getTime()) / 86400000;
}

export function calculateChurnRisk(signals, now = new Date()) {
  const triggered = [];

  if (daysBetween(signals.lastAppOpenAt, now) >= 5)        triggered.push('no_app_open_5d');
  if (daysBetween(signals.lastWorkoutEnteredAt, now) >= 3) triggered.push('no_workout_3d');
  if ((signals.skippedWorkoutsLast7Days || 0) >= 2)        triggered.push('skipped_2_in_7d');
  if ((signals.avgRpeLast6Days - signals.baselineRpe) >= 1.5) triggered.push('rpe_creep');
  if (daysBetween(signals.lastChatReplyAt, now) >= 4)      triggered.push('no_chat_reply_4d');

  let score = triggered
    .map(id => AT_RISK_RULES.find(r => r.id === id).weight)
    .reduce((a, b) => a + b, 0);

  if (score > 100) score = 100;

  return { score, triggered };
}

// ── SIGNAL COLLECTION (impure — reads Firestore) ──
import { DB } from './db-extensions.js';

export async function collectClientSignals(clientId) {
  const client = await DB.getUserById(clientId);
  if (!client) return null;

  // Pull from existing Firestore collections — adapt names to actual schema.
  const workouts = await DB.getWorkoutsByClient?.(clientId) || [];
  const messages = await DB.getMessagesByClient?.(clientId) || [];
  const sessions = await DB.getAppSessionsByClient?.(clientId) || [];

  const sortedWorkouts = workouts
    .filter(w => w.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const skipped = workouts.filter(w =>
    w.scheduledAt &&
    new Date(w.scheduledAt).getTime() > sevenDaysAgo &&
    new Date(w.scheduledAt) < new Date() &&
    !w.completedAt
  ).length;

  const recentRpe = sortedWorkouts.slice(0, 6)
    .flatMap(w => (w.exercises || []).flatMap(e => e.sets || []))
    .map(s => s.rpe).filter(r => typeof r === 'number');
  const avgRpeLast6 = recentRpe.length
    ? recentRpe.reduce((a, b) => a + b, 0) / recentRpe.length
    : 0;

  const allRpe = workouts.flatMap(w => (w.exercises || []).flatMap(e => e.sets || []))
    .map(s => s.rpe).filter(r => typeof r === 'number');
  const baselineRpe = allRpe.length
    ? allRpe.reduce((a, b) => a + b, 0) / allRpe.length
    : 7;

  const clientReplies = messages.filter(m => m.fromId === clientId)
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

  return {
    lastAppOpenAt: sessions[0]?.openedAt || client.lastSeenAt || null,
    lastWorkoutEnteredAt: sortedWorkouts[0]?.completedAt || null,
    skippedWorkoutsLast7Days: skipped,
    avgRpeLast6Days: avgRpeLast6,
    baselineRpe,
    lastChatReplyAt: clientReplies[0]?.sentAt || null
  };
}
