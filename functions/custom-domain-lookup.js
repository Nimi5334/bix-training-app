/**
 * Custom Domain Lookup — Phase D (Netlify Function)
 * Maps a custom domain to its gym and owner coach.
 * Called on page load when running on a non-bix.app hostname.
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null;
  if (serviceAccount) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  else admin.initializeApp();
}

const db = admin.firestore();

exports.handler = async (event) => {
  const domain = event.headers['x-forwarded-host'] || event.headers.host || '';

  // Pass through for bix.app and Netlify preview URLs
  if (!domain || domain.includes('bix.app') || domain.includes('netlify')) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCustomDomain: false }),
    };
  }

  try {
    const snap = await db.collection('gyms').where('customDomain', '==', domain).limit(1).get();
    if (snap.empty) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Domain not configured' }) };
    }
    const gymSnap = snap.docs[0];
    const gym = gymSnap.data();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        isCustomDomain: true,
        gymId: gymSnap.id,
        coachId: gym.ownerId,
        gymName: gym.name,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
