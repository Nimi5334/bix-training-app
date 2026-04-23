/**
 * Netlify Function: Capture PayPal Order
 * Called after user approves payment — captures funds and updates Firestore membership
 */

const admin = require('firebase-admin');

const PAYPAL_API = process.env.PAYPAL_SANDBOX === 'true'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

// Initialize Firebase Admin (use service account or default credentials)
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    admin.initializeApp(); // Uses GOOGLE_APPLICATION_CREDENTIALS env var
  }
}

const db = admin.firestore();

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret   = process.env.PAYPAL_CLIENT_SECRET;

  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${secret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) throw new Error('Failed to get PayPal access token');
  const data = await response.json();
  return data.access_token;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { orderId, memberId, memberName, amount, duration } = JSON.parse(event.body);

    if (!orderId || !memberId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Capture the PayPal order (take the money)
    const token = await getAccessToken();

    const captureResponse = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!captureResponse.ok) {
      const err = await captureResponse.json();
      throw new Error(err.message || 'PayPal capture failed');
    }

    const captureData = await captureResponse.json();

    if (captureData.status !== 'COMPLETED') {
      throw new Error(`Payment not completed. Status: ${captureData.status}`);
    }

    const capture = captureData.purchase_units[0]?.payments?.captures[0];

    // Log transaction to Firestore
    const txRef = db.collection('transactions').doc();
    await txRef.set({
      id: txRef.id,
      paypalOrderId: orderId,
      paypalCaptureId: capture?.id || null,
      memberId,
      memberName,
      amount: parseFloat(amount),
      duration: parseInt(duration) || 12,
      currency: 'USD',
      status: 'completed',
      method: 'paypal',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Calculate new membership expiry
    const userRef = db.collection('users').doc(memberId);
    const userSnap = await userRef.get();
    const user = userSnap.exists ? userSnap.data() : {};

    const base = user.membershipExpiry && new Date(user.membershipExpiry) > new Date()
      ? new Date(user.membershipExpiry)
      : new Date();

    const newExpiry = new Date(base);
    newExpiry.setMonth(newExpiry.getMonth() + (parseInt(duration) || 12));
    const newExpiryStr = newExpiry.toISOString().split('T')[0];

    // Update user membership in Firestore
    await userRef.update({
      membershipExpiry: newExpiryStr,
      lastPaymentDate: new Date().toISOString().split('T')[0],
      lastPaymentAmount: parseFloat(amount),
      lastPaymentMethod: 'paypal',
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        transactionId: txRef.id,
        newExpiry: newExpiryStr,
      }),
    };
  } catch (error) {
    console.error('capture-paypal-order error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
