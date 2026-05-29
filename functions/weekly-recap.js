/**
 * Weekly Recap — Phase C.2
 *
 * Firebase Function running every Sunday at 18:00 UTC.
 * For each client with an FCM token, aggregates last week's stats and fires
 * a personalised push notification: sessions, total volume, PRs, next-week plan.
 *
 * Data sources:
 *   workoutLogs/{id}       — { clientId, date, totalVolume }
 *   workouts/{id}          — { clientId, scheduledAt, completedAt }
 *   users/{clientId}       — { powerRecords: [{date, exercise, weight, reps}] }
 *
 * Deployment:
 *   firebase deploy --only functions:weeklyRecap
 */

const { onSchedule }   = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const admin            = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const db = getFirestore();

/** Returns ISO date string for N days ago. */
function daysAgo(n, from = new Date()) {
  return new Date(from.getTime() - n * 86400000).toISOString().slice(0, 10);
}

/** Count power records hit in the last 7 days. */
function countRecentPRs(powerRecords, lastMonday) {
  if (!Array.isArray(powerRecords)) return 0;
  return powerRecords.filter(pr => pr.date && pr.date >= lastMonday).length;
}

/** Round to nearest sensible unit for display. */
function fmtVolume(kg) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)}kg`;
}

exports.weeklyRecap = onSchedule(
  { schedule: '0 18 * * 0', timeZone: 'UTC', region: 'us-central1' }, // Every Sunday 18:00 UTC
  async () => {
    const now       = new Date();
    const lastMonday = daysAgo(7, now);  // last 7 days
    const nextSunday = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);

    // All clients with FCM tokens
    const usersSnap = await db.collection('users')
      .where('role', '==', 'client')
      .where('fcmToken', '!=', null)
      .get();

    let sent = 0;

    for (const userDoc of usersSnap.docs) {
      const client    = userDoc.data();
      const clientId  = userDoc.id;
      const fcmToken  = client.fcmToken;
      if (!fcmToken) continue;

      try {
        // Last week's workout logs
        const logsSnap = await db.collection('workoutLogs')
          .where('clientId', '==', clientId)
          .where('date', '>=', lastMonday)
          .get();

        const logs       = logsSnap.docs.map(d => d.data());
        const sessions   = logs.length;
        const volume     = logs.reduce((sum, l) => sum + (l.totalVolume || 0), 0);

        // PRs from user doc (powerRecords[].date >= lastMonday)
        const prs = countRecentPRs(client.powerRecords, lastMonday);

        // Upcoming workouts this week (scheduled but not completed)
        const upcomingSnap = await db.collection('workouts')
          .where('clientId', '==', clientId)
          .where('scheduledAt', '>=', now.toISOString())
          .where('scheduledAt', '<=', nextSunday + 'T23:59:59Z')
          .get();

        const upcomingCount = upcomingSnap.docs.filter(d => !d.data().completedAt).length;

        // Skip if no activity at all last week — don't recap a dead account
        if (sessions === 0 && volume === 0) continue;

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

        // Build message copy
        const volumePart  = volume > 0 ? `, lifted ${fmtVolume(volume)}` : '';
        const prPart      = prs === 1 ? ', hit 1 PR 🏆' : prs > 1 ? `, hit ${prs} PRs 🏆` : '';
        const nextPart    = upcomingCount > 0
          ? ` This week: ${upcomingCount} workout${upcomingCount > 1 ? 's' : ''} planned.`
          : '';

        const body = `${coachName}: Last week you trained ${sessions}x${volumePart}${prPart}.${nextPart}`;

        await getMessaging().send({
          token: fcmToken,
          notification: {
            title: `Your week in review, ${firstName} 📊`,
            body,
          },
          data: { type: 'weekly-recap', clientId },
          android: { priority: 'normal' },
          apns:    { payload: { aps: { sound: 'default' } } },
        });

        sent++;
        console.log(`weeklyRecap: sent to ${client.name || clientId}`);
      } catch (err) {
        console.warn(`weeklyRecap failed for ${clientId}:`, err.message);
      }
    }

    console.log(`weeklyRecap: sent ${sent} recap notifications`);
  }
);
