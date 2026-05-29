/**
 * Rescue Nudge — Phase C.1
 *
 * Hourly Firebase Function that fires a gentle push to clients whose
 * scheduled workout was 1 hour ago and hasn't been completed yet.
 *
 * Guards (all must pass to send):
 *   1. Workout is scheduled 45–75 min ago with no completedAt
 *   2. Client hasn't already received a rescue nudge for this workout
 *   3. Client has ≥70% attendance in the last 30 days (reliable trainer, not ghost)
 *   4. Client hasn't marked today as a rest day
 *
 * Deployment:
 *   firebase deploy --only functions:rescueNudge
 */

const { onSchedule }    = require('firebase-functions/v2/scheduler');
const { getFirestore }  = require('firebase-admin/firestore');
const { getMessaging }  = require('firebase-admin/messaging');
const admin             = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const db = getFirestore();

const WINDOW_MIN = 45;   // minutes after scheduledAt — lower bound
const WINDOW_MAX = 75;   // minutes after scheduledAt — upper bound
const ATTENDANCE_THRESHOLD = 0.70;
const LOOKBACK_DAYS = 30;

/** Returns true if the client marked today as a rest day. */
function isRestDay(client) {
  const marked = client.restDayMarkedAt;
  if (!marked) return false;
  const today = new Date().toISOString().slice(0, 10);
  return marked.slice(0, 10) === today;
}

/** Returns attendance rate (0–1) over the last LOOKBACK_DAYS days. */
function attendanceRate(workouts, now) {
  const cutoff = now - LOOKBACK_DAYS * 86400000;
  const recent = workouts.filter(w => w.scheduledAt && new Date(w.scheduledAt).getTime() >= cutoff);
  if (recent.length === 0) return 1; // no scheduled data → don't gate
  const completed = recent.filter(w => w.completedAt).length;
  return completed / recent.length;
}

exports.rescueNudge = onSchedule(
  { schedule: 'every 60 minutes', timeZone: 'UTC', region: 'us-central1' },
  async () => {
    const now    = Date.now();
    const minAgo = new Date(now - WINDOW_MIN * 60 * 1000).toISOString();
    const maxAgo = new Date(now - WINDOW_MAX * 60 * 1000).toISOString();

    // All workouts in the time window that haven't been completed or nudged yet
    const workoutsSnap = await db.collection('workouts')
      .where('scheduledAt', '<=', minAgo)
      .where('scheduledAt', '>=', maxAgo)
      .get();

    let sent = 0;

    for (const wDoc of workoutsSnap.docs) {
      const workout = wDoc.data();

      // Already completed — skip
      if (workout.completedAt) continue;

      // Already nudged for this workout — skip
      if (workout.rescueNudgeSentAt) continue;

      const clientId = workout.clientId;
      if (!clientId) continue;

      // Load client
      const clientSnap = await db.collection('users').doc(clientId).get();
      if (!clientSnap.exists) continue;
      const client = clientSnap.data();

      // No FCM token — can't push
      if (!client.fcmToken) continue;

      // Rest day — respect it
      if (isRestDay(client)) continue;

      // Attendance gate — only nudge reliable clients
      const allWorkouts = await db.collection('workouts')
        .where('clientId', '==', clientId)
        .get()
        .then(s => s.docs.map(d => d.data()));

      if (attendanceRate(allWorkouts, now) < ATTENDANCE_THRESHOLD) continue;

      // Get coach name for white-label push
      let coachName = 'Your Coach';
      if (client.coachId) {
        const coachSnap = await db.collection('users').doc(client.coachId).get();
        if (coachSnap.exists) {
          const coach = coachSnap.data();
          coachName = coach.displayName || coach.name || coachName;
        }
      }

      const firstName = (client.name || '').split(' ')[0] || 'there';

      try {
        await getMessaging().send({
          token: client.fcmToken,
          notification: {
            title: 'Training time? ⚡',
            body: `${coachName}: Your workout is ready, ${firstName}. Let's go!`,
          },
          data: { type: 'rescue-nudge', workoutId: wDoc.id, clientId },
          android: { priority: 'high' },
          apns:    { payload: { aps: { sound: 'default' } } },
        });

        // Mark this workout as nudged so we don't double-send
        await db.collection('workouts').doc(wDoc.id).update({
          rescueNudgeSentAt: new Date().toISOString(),
        });

        sent++;
        console.log(`rescueNudge: sent to ${client.name || clientId}`);
      } catch (err) {
        console.warn(`rescueNudge send failed for ${clientId}:`, err.message);
      }
    }

    console.log(`rescueNudge: sent ${sent} nudges`);
  }
);
