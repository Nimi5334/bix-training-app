/**
 * Smart Push Timing — Phase C.1
 *
 * Daily Cloud Function (06:00 UTC) that:
 *  1. Groups each client's `workoutStartTimes` by day-of-week
 *  2. Computes the median start hour per client per weekday
 *  3. Schedules a push notification 30 min before the predicted start time
 *
 * Firestore reads:
 *   workoutStartTimes — { clientId, dayOfWeek, hour, minute, timestamp }
 *   users             — { fcmToken, coachId, name }
 *
 * Minimum data requirement: a client needs ≥5 workouts before we personalise.
 * Fallback: use coach-configured push time (users/{clientId}.defaultPushHour) or skip.
 *
 * Deployment:
 *   firebase deploy --only functions:scheduleSmartPush
 */

const { onSchedule }  = require('firebase-functions/v2/scheduler');
const { getFirestore, collection, getDocs, query, where, orderBy, limit } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const admin           = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const db = getFirestore();

/** Median of a sorted array of numbers. */
function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Returns today's predicted start hour for a client based on
 * their historical workoutStartTimes. Returns null if insufficient data.
 */
async function getPredictedStartHour(clientId, dayOfWeek) {
  const snap = await getDocs(query(
    collection(db, 'workoutStartTimes'),
    where('clientId', '==', clientId),
    where('dayOfWeek', '==', dayOfWeek),
    orderBy('timestamp', 'desc'),
    limit(20)
  ));

  const hours = snap.docs.map(d => d.data().hour);
  if (hours.length < 5) return null;   // not enough data yet

  return median(hours);
}

exports.scheduleSmartPush = onSchedule(
  { schedule: '0 6 * * *', timeZone: 'UTC', region: 'us-central1' },
  async () => {
    const now = new Date();
    const dayOfWeek = now.getDay();          // 0=Sun … 6=Sat

    // Fetch all clients who have an FCM token
    const usersSnap = await getDocs(query(
      collection(db, 'users'),
      where('role', '==', 'client'),
      where('fcmToken', '!=', null)
    ));

    let pushed = 0;
    for (const userDoc of usersSnap.docs) {
      const client = userDoc.data();
      const fcmToken = client.fcmToken;
      if (!fcmToken) continue;

      const predictedHour = await getPredictedStartHour(userDoc.id, dayOfWeek)
        .catch(() => null);

      // Fallback to coach-configured push hour if no prediction
      const targetHour = predictedHour ?? client.defaultPushHour ?? null;
      if (targetHour === null) continue;    // no data + no fallback → skip

      // We want to fire the push 30 min before workout
      const pushHour   = targetHour;
      const pushMinute = 30;   // send at HH:30 — 30 min before the hour they usually start

      // Only send if "now" is within the current push window (±5 min of scheduled push time)
      const nowHour   = now.getUTCHours();
      const nowMinute = now.getUTCMinutes();
      const nowTotal  = nowHour * 60 + nowMinute;
      const pushTotal = pushHour * 60 + pushMinute;
      if (Math.abs(nowTotal - pushTotal) > 5) continue;

      try {
        await getMessaging().send({
          token: fcmToken,
          notification: {
            title: 'Time to train 💪',
            body:  `Your workout window is coming up. Let's go, ${client.name?.split(' ')[0] || 'champ'}!`,
          },
          data: { type: 'smart-push', clientId: userDoc.id },
          android: { priority: 'high' },
          apns:    { payload: { aps: { sound: 'default' } } },
        });
        pushed++;
      } catch (err) {
        console.warn(`smartPush send failed for ${userDoc.id}:`, err.message);
      }
    }

    console.log(`scheduleSmartPush: sent ${pushed} notifications for dayOfWeek=${dayOfWeek}`);
  }
);
