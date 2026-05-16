// functions/at-risk-cron.js
// Runs daily at 06:00 UTC. For every client, recomputes churnRiskScore + triggered rules
// and writes back to that user's doc as `atRiskScore` and `atRiskTriggered`.

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try { initializeApp(); } catch (_) { /* already initialized */ }
const db = getFirestore();

// Inline the pure rules (Cloud Functions runtime can't import the browser ES module)
const AT_RISK_RULES = [
  { id: 'no_app_open_5d',  weight: 20 },
  { id: 'no_workout_3d',   weight: 25 },
  { id: 'skipped_2_in_7d', weight: 25 },
  { id: 'rpe_creep',       weight: 15 },
  { id: 'no_chat_reply_4d',weight: 15 }
];

function daysBetween(iso, now) {
  if (!iso) return Infinity;
  return (now.getTime() - new Date(iso).getTime()) / 86400000;
}

function calculateChurnRisk(signals, now) {
  const triggered = [];
  if (daysBetween(signals.lastAppOpenAt, now) >= 5)        triggered.push('no_app_open_5d');
  if (daysBetween(signals.lastWorkoutEnteredAt, now) >= 3) triggered.push('no_workout_3d');
  if ((signals.skippedWorkoutsLast7Days || 0) >= 2)        triggered.push('skipped_2_in_7d');
  if ((signals.avgRpeLast6Days - signals.baselineRpe) >= 1.5) triggered.push('rpe_creep');
  if (daysBetween(signals.lastChatReplyAt, now) >= 4)      triggered.push('no_chat_reply_4d');
  let score = triggered.map(id => AT_RISK_RULES.find(r => r.id === id).weight).reduce((a,b)=>a+b,0);
  if (score > 100) score = 100;
  return { score, triggered };
}

async function collectSignals(clientId) {
  const userSnap = await db.collection('users').doc(clientId).get();
  const user = userSnap.data() || {};
  const workoutsSnap = await db.collection('workouts').where('clientId', '==', clientId).get();
  const messagesSnap = await db.collection('messages').where('fromId', '==', clientId).get();

  const workouts = workoutsSnap.docs.map(d => d.data());
  const sortedCompleted = workouts.filter(w => w.completedAt).sort((a,b) => new Date(b.completedAt) - new Date(a.completedAt));
  const skipped = workouts.filter(w => w.scheduledAt && new Date(w.scheduledAt).getTime() > Date.now() - 7*86400000 && new Date(w.scheduledAt) < new Date() && !w.completedAt).length;
  const allRpe = workouts.flatMap(w => (w.exercises || []).flatMap(e => e.sets || [])).map(s => s.rpe).filter(r => typeof r === 'number');
  const recentRpe = sortedCompleted.slice(0, 6).flatMap(w => (w.exercises || []).flatMap(e => e.sets || [])).map(s => s.rpe).filter(r => typeof r === 'number');
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

  const replies = messagesSnap.docs.map(d => d.data()).sort((a,b) => new Date(b.sentAt) - new Date(a.sentAt));

  return {
    lastAppOpenAt: user.lastSeenAt || null,
    lastWorkoutEnteredAt: sortedCompleted[0]?.completedAt || null,
    skippedWorkoutsLast7Days: skipped,
    avgRpeLast6Days: avg(recentRpe),
    baselineRpe: avg(allRpe) || 7,
    lastChatReplyAt: replies[0]?.sentAt || null
  };
}

exports.recalculateAtRiskDaily = onSchedule('every day 06:00', async () => {
  const now = new Date();

  // ── PRODUCTION SAFEGUARD ──
  // Only process clients whose coach has opted into v1. Existing coaches
  // (v1Enabled !== true) and their clients are completely skipped.
  const optedInCoachesSnap = await db.collection('users')
    .where('role', '==', 'coach')
    .where('v1Enabled', '==', true)
    .get();

  if (optedInCoachesSnap.empty) {
    console.log('[at-risk-cron] No v1-enabled coaches. Skipping.');
    return;
  }

  const optedInCoachIds = optedInCoachesSnap.docs.map(d => d.id);
  console.log(`[at-risk-cron] Processing clients for ${optedInCoachIds.length} v1-enabled coaches.`);

  let processed = 0;
  let errors = 0;

  for (const coachId of optedInCoachIds) {
    const clientsSnap = await db.collection('users')
      .where('role', '==', 'client')
      .where('coachId', '==', coachId)
      .get();

    for (const docSnap of clientsSnap.docs) {
      const id = docSnap.id;
      try {
        const signals = await collectSignals(id);
        const result = calculateChurnRisk(signals, now);
        await db.collection('users').doc(id).update({
          atRiskScore: result.score,
          atRiskTriggered: result.triggered,
          atRiskUpdatedAt: now.toISOString()
        });
        processed++;
      } catch (e) {
        errors++;
        console.error(`At-risk calc failed for ${id}:`, e);
      }
    }
  }

  console.log(`[at-risk-cron] Done. Processed: ${processed}, Errors: ${errors}.`);
});
