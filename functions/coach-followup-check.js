/**
 * Netlify Scheduled Function: 24h Coach Follow-Up Check
 * Runs daily at 10am UTC.
 * Flags coaches who signed up 24-48h ago with 0 clients so Nimrod
 * can do a manual white-glove follow-up (first 50 coaches).
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;
  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

exports.handler = async () => {
  try {
    const now = Date.now();
    const oneDayAgo  = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000).toISOString();

    // Coaches who signed up 24-48h ago (window so we don't re-flag old coaches)
    const coachSnap = await db.collection('users')
      .where('role', '==', 'coach')
      .where('createdAt', '<=', oneDayAgo)
      .where('createdAt', '>=', twoDaysAgo)
      .get();

    let flagged = 0;

    for (const doc of coachSnap.docs) {
      const coach = { id: doc.id, ...doc.data() };

      // Already flagged or already followed up — skip
      if (coach.needsFollowUp || coach.followedUp) continue;

      // Check if they have any clients
      const clientSnap = await db.collection('users')
        .where('role', '==', 'client')
        .where('coachId', '==', coach.id)
        .limit(1)
        .get();

      if (!clientSnap.empty) continue; // Has clients — no follow-up needed

      // Flag for manual follow-up
      await db.collection('users').doc(coach.id).update({
        needsFollowUp: true,
        needsFollowUpAt: new Date().toISOString(),
      });

      flagged++;
      console.log(`Flagged coach for follow-up: ${coach.name || coach.email} (${coach.id})`);
    }

    console.log(`Coach follow-up check complete. Flagged: ${flagged}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, flagged }) };
  } catch (err) {
    console.error('coach-followup-check error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
