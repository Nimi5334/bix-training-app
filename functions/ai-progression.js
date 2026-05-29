/**
 * RPE Progression Suggester — Phase A
 * Callable Cloud Function. Reads last week's workoutLogs, returns
 * per-exercise load adjustment suggestions based on RPE data.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = getFirestore();

/**
 * Pure progression logic — separated for testability.
 * RPE 6 → +5kg | RPE 7 → +2.5kg | RPE 8 → hold | RPE 9-10 → deload
 */
function suggestAdjustment(avgRpe) {
  if (avgRpe <= 6)  return { kg: 5,    label: '+5kg',    reason: 'RPE well below target — room to progress' };
  if (avgRpe <= 7)  return { kg: 2.5,  label: '+2.5kg',  reason: 'RPE on target — standard progression' };
  if (avgRpe <= 8)  return { kg: 0,    label: 'Hold',    reason: 'RPE high — consolidate this weight' };
  return              { kg: -2.5, label: 'Deload',  reason: 'RPE critically high — reduce load' };
}

module.exports.suggestAdjustment = suggestAdjustment;

exports.suggestProgression = onCall(
  { region: 'us-central1' },
  async (request) => {
    const { clientId, coachId } = request.data;
    if (!clientId || !coachId) throw new HttpsError('invalid-argument', 'clientId and coachId required');
    if (request.auth?.uid !== coachId) throw new HttpsError('permission-denied', 'Not authorized');

    const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const logsSnap = await db.collection('workoutLogs')
      .where('clientId', '==', clientId)
      .where('date', '>=', oneWeekAgo)
      .get();

    const logs = logsSnap.docs.map(d => d.data());
    if (logs.length === 0) return { suggestions: [], message: 'No workout data from last week' };

    // Aggregate RPE and weight by exercise
    const byExercise = {};
    logs.forEach(log => {
      (log.exercises || []).forEach(ex => {
        if (!byExercise[ex.name]) byExercise[ex.name] = { rpes: [], weights: [], allReps: true };
        (ex.sets || []).forEach(set => {
          if (typeof set.rpe === 'number') byExercise[ex.name].rpes.push(set.rpe);
          if (typeof set.weight === 'number') byExercise[ex.name].weights.push(set.weight);
          if (set.missedReps) byExercise[ex.name].allReps = false;
        });
      });
    });

    const suggestions = Object.entries(byExercise).map(([name, data]) => {
      const avgRpe = data.rpes.length
        ? data.rpes.reduce((a, b) => a + b, 0) / data.rpes.length
        : 7;
      const lastWeight = data.weights[data.weights.length - 1] || 0;
      const adj = suggestAdjustment(avgRpe);
      return {
        exercise: name,
        lastWeight,
        suggestedWeight: Math.max(0, lastWeight + adj.kg),
        adjustment: adj.label,
        reason: adj.reason,
        avgRpe: Math.round(avgRpe * 10) / 10,
      };
    });

    return { suggestions, generatedAt: new Date().toISOString() };
  }
);
