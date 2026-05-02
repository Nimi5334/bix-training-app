/**
 * Netlify Function: Fire Webhook
 * Reads the coach's webhook URL from Firestore settings and POSTs an event payload.
 * Called by client-side code on key events: member.created, payment.received, workout.logged
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { event: eventName, payload, coachId } = JSON.parse(event.body || '{}');

    if (!eventName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing event name' }) };
    }

    // Get webhook URL — check coach-specific first, then global settings
    let webhookUrl = null;

    if (coachId) {
      const coachDoc = await db.collection('users').doc(coachId).get();
      if (coachDoc.exists) {
        webhookUrl = coachDoc.data().webhookUrl || null;
      }
    }

    if (!webhookUrl) {
      const settings = await db.collection('settings').doc('default').get();
      if (settings.exists) webhookUrl = settings.data().webhookUrl || null;
    }

    if (!webhookUrl) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'no webhook configured' }) };
    }

    // Validate URL
    try { new URL(webhookUrl); } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid webhook URL' }) };
    }

    // POST to webhook
    const body = JSON.stringify({
      event: eventName,
      data: payload || {},
      timestamp: new Date().toISOString(),
      source: 'bix-training',
    });

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Bix-Webhook/1.0' },
      body,
      signal: AbortSignal.timeout(10000),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, webhookStatus: res.status }),
    };
  } catch (err) {
    console.error('fire-webhook error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
