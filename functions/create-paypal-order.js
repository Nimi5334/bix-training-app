/**
 * Netlify Function: Create PayPal Order
 * Called when user initiates payment — creates order on PayPal servers
 */

const PAYPAL_API = process.env.PAYPAL_SANDBOX === 'true'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

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
    const { amount, duration, memberId, memberName } = JSON.parse(event.body);

    if (!amount || amount < 1) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid amount' }) };
    }

    const token = await getAccessToken();

    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'PayPal-Request-Id': `bix-${Date.now()}-${memberId}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: parseFloat(amount).toFixed(2),
          },
          description: `Bix Coaching Platform – ${duration} month membership for ${memberName}`,
          custom_id: memberId,
        }],
        application_context: {
          brand_name: 'Bix Training',
          locale: 'en-US',
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'PayPal order creation failed');
    }

    const order = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({ id: order.id }),
    };
  } catch (error) {
    console.error('create-paypal-order error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
