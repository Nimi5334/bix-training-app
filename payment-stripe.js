/**
 * Stripe Payment Integration Module
 * Handles secure payment processing with Stripe Payment Elements
 */

let stripe = null;
let elements = null;

// Initialize Stripe (call this once on page load)
export async function initStripe(publicKey = null) {
  if (stripe) return stripe; // Already initialized

  // Load Stripe.js
  const stripePromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => {
      resolve(window.Stripe);
    };
    script.onerror = () => {
      console.error('Failed to load Stripe.js');
      resolve(null);
    };
    document.head.appendChild(script);
  });

  const StripeClass = await stripePromise;
  if (!StripeClass) {
    throw new Error('Stripe.js failed to load');
  }

  // Try to get public key from multiple sources
  const key = publicKey
    || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STRIPE_PUBLIC_KEY)
    || localStorage.getItem('stripe_public_key')
    || 'pk_test_51234567890'; // Fallback (will show error if wrong key)

  if (!key.startsWith('pk_')) {
    throw new Error('Invalid Stripe public key format');
  }

  stripe = StripeClass(key);
  return stripe;
}

// Create Payment Elements UI
export async function createPaymentElements(containerId) {
  if (!stripe) {
    await initStripe();
  }

  if (elements) {
    elements.unmount();
  }

  const appearance = {
    theme: 'night',
    variables: {
      colorPrimary: '#e8442a',
      colorBackground: '#1a1a1a',
      colorText: '#ffffff',
      colorTextSecondary: '#a0a0a0',
      borderRadius: '8px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
  };

  elements = stripe.elements({ appearance });

  // Create and mount Payment Element
  const paymentElement = elements.create('payment');
  paymentElement.mount(`#${containerId}`);

  return elements;
}

// Create a payment intent on the backend
export async function createPaymentIntent(amount, description = 'Bix Membership') {
  try {
    const response = await fetch('/.netlify/functions/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        currency: 'usd',
        description,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create payment intent');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('createPaymentIntent error:', error);
    throw error;
  }
}

// Confirm payment and update membership
export async function confirmPayment(paymentIntentId, memberId, memberName, amount, duration) {
  try {
    // Confirm the payment with Stripe client-side
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      throw new Error(error.message);
    }

    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment failed with status: ${paymentIntent.status}`);
    }

    // Payment succeeded, now update membership on backend
    const response = await fetch('/.netlify/functions/confirm-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentIntentId: paymentIntent.id,
        memberId,
        memberName,
        amount,
        duration,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to confirm payment on server');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('confirmPayment error:', error);
    throw error;
  }
}

// Clean up elements
export function unmountElements() {
  if (elements) {
    elements.unmount();
    elements = null;
  }
}
