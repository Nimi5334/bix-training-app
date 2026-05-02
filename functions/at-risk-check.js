/**
 * Netlify Scheduled Function: Daily At-Risk Client Check
 * Runs every day at 9am UTC. Sends an automated check-in message
 * to any client who hasn't logged a workout in 3+ days.
 * Throttled: no more than one auto message per client per 48 hours.
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

function convId(userA, userB) {
  return [userA, userB].sort().join('__');
}

async function ensureConversation(coachId, clientId) {
  const cid = convId(coachId, clientId);
  const ref = db.collection('conversations').doc(cid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      id: cid,
      participants: [coachId, clientId],
      lastMessage: '',
      lastMessageAt: null,
      unreadCount: { [coachId]: 0, [clientId]: 0 },
      createdAt: new Date().toISOString(),
    });
  }
  return cid;
}

async function sendAutoMessage(coachId, clientId, clientName) {
  const cid = await ensureConversation(coachId, clientId);
  const msgRef = db.collection('conversations').doc(cid).collection('messages').doc();
  const text = `Hey ${clientName.split(' ')[0]}, just checking in — haven't seen you log a session in a few days. Everything alright? Your program is ready when you are 💪`;

  await msgRef.set({
    id: msgRef.id,
    senderId: coachId,
    text,
    timestamp: new Date().toISOString(),
    read: false,
    isAutoMessage: true,
  });

  // Update conversation preview + unread count for client
  const convRef = db.collection('conversations').doc(cid);
  const convSnap = await convRef.get();
  const unread = convSnap.exists ? (convSnap.data().unreadCount || {}) : {};
  unread[clientId] = (unread[clientId] || 0) + 1;

  await convRef.update({
    lastMessage: text.slice(0, 120),
    lastMessageAt: new Date().toISOString(),
    unreadCount: unread,
  });
}

exports.handler = async () => {
  try {
    const now = Date.now();
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const throttleMs = 48 * 60 * 60 * 1000; // 48 hours

    // Get all coaches
    const coachSnap = await db.collection('users').where('role', '==', 'coach').get();
    const coaches = coachSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let sent = 0;

    for (const coach of coaches) {
      // Get this coach's clients
      const clientSnap = await db.collection('users')
        .where('role', '==', 'client')
        .where('coachId', '==', coach.id)
        .get();
      const clients = clientSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      for (const client of clients) {
        // Skip expired memberships
        if (client.membershipExpiry && new Date(client.membershipExpiry) < new Date()) continue;

        // Check last workout
        const logSnap = await db.collection('workoutLogs')
          .where('clientId', '==', client.id)
          .orderBy('date', 'desc')
          .limit(1)
          .get();

        const lastLog = logSnap.docs[0]?.data();
        const lastWorkoutDate = lastLog?.date || '2000-01-01';
        const daysSinceWorkout = Math.floor((now - new Date(lastWorkoutDate).getTime()) / 86400000);

        if (daysSinceWorkout < 3) continue; // Not at risk

        // Throttle: skip if we sent a message within the last 48 hours
        const lastMsgAt = client.lastAtRiskMessageAt;
        if (lastMsgAt) {
          const msSinceLast = now - new Date(lastMsgAt).getTime();
          if (msSinceLast < throttleMs) continue;
        }

        // Send auto message
        await sendAutoMessage(coach.id, client.id, client.name || 'there');

        // Update throttle timestamp
        await db.collection('users').doc(client.id).update({
          lastAtRiskMessageAt: new Date().toISOString(),
        });

        sent++;
        console.log(`Auto message sent to ${client.name} (${client.id})`);
      }
    }

    console.log(`At-risk check complete. Messages sent: ${sent}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, sent }) };
  } catch (err) {
    console.error('at-risk-check error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
