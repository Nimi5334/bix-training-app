/**
 * PayPal Payment Integration Module
 * Handles secure payment processing using PayPal JavaScript SDK
 * Supports: PayPal Wallet, Google Pay, Credit Card (via Hosted Fields)
 * Works from Israel — free account, pay per transaction only
 */

let paypalLoaded = false;
let hostedFieldsInstance = null;

async function fetchClientId() {
  try {
    const res = await fetch('/.netlify/functions/paypal-config');
    if (!res.ok) return 'sb';
    const data = await res.json();
    return data.clientId || 'sb';
  } catch {
    return 'sb';
  }
}

// Load PayPal SDK script dynamically
export async function initPayPal(clientId) {
  if (paypalLoaded) return;
  if (!clientId) clientId = await fetchClientId();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-paypal-sdk]');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons,hosted-fields`;
    script.setAttribute('data-paypal-sdk', 'true');
    script.async = true;
    script.onload = () => { paypalLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
    document.head.appendChild(script);
  });
}

/**
 * Render PayPal Wallet Button into a container element
 * @param {string} containerId - ID of the container div
 * @param {object} options - { amount, duration, memberId, memberName, onSuccess, onError }
 */
export async function renderPayPalWalletButton(containerId, options) {
  const { amount, duration, memberId, memberName, onSuccess, onError } = options;

  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  window.paypal.Buttons({
    style: {
      layout: 'vertical',
      color: 'gold',
      shape: 'rect',
      label: 'pay',
      height: 45,
    },

    createOrder: async () => {
      try {
        const response = await fetch('/.netlify/functions/create-paypal-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, duration, memberId, memberName }),
        });
        if (!response.ok) throw new Error('Failed to create order');
        const data = await response.json();
        return data.id;
      } catch (err) {
        onError && onError(err.message);
        throw err;
      }
    },

    onApprove: async (data) => {
      try {
        const response = await fetch('/.netlify/functions/capture-paypal-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: data.orderID,
            memberId,
            memberName,
            amount,
            duration,
          }),
        });
        if (!response.ok) throw new Error('Failed to capture payment');
        const result = await response.json();
        onSuccess && onSuccess(result);
      } catch (err) {
        onError && onError(err.message);
      }
    },

    onError: (err) => {
      console.error('PayPal error:', err);
      onError && onError('Payment failed. Please try again.');
    },

    onCancel: () => {
      onError && onError('Payment cancelled.');
    },

  }).render(`#${containerId}`);
}

/**
 * Render Google Pay Button using PayPal's native Google Pay integration
 * @param {string} containerId - ID of the container div
 * @param {object} options - { amount, duration, memberId, memberName, onSuccess, onError }
 */
export async function renderGooglePayButton(containerId, options) {
  const { amount, duration, memberId, memberName, onSuccess, onError } = options;

  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  // Create a PayPal button with Google Pay as the primary funding source
  window.paypal.Buttons({
    fundingSource: window.paypal.FUNDING.GOOGLEPAY,

    style: {
      layout: 'vertical',
      shape: 'rect',
      label: 'pay',
      height: 45,
    },

    createOrder: async () => {
      try {
        const response = await fetch('/.netlify/functions/create-paypal-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, duration, memberId, memberName }),
        });
        if (!response.ok) throw new Error('Failed to create order');
        const data = await response.json();
        return data.id;
      } catch (err) {
        onError && onError(err.message);
        throw err;
      }
    },

    onApprove: async (data) => {
      try {
        const response = await fetch('/.netlify/functions/capture-paypal-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: data.orderID,
            memberId,
            memberName,
            amount,
            duration,
          }),
        });
        if (!response.ok) throw new Error('Failed to capture payment');
        const result = await response.json();
        onSuccess && onSuccess(result);
      } catch (err) {
        onError && onError(err.message);
      }
    },

    onError: (err) => {
      console.error('Google Pay error:', err);
      onError && onError('Payment failed. Please try again.');
    },

    onCancel: () => {
      onError && onError('Payment cancelled.');
    },

  }).render(`#${containerId}`);
}

/**
 * Initialize PayPal Hosted Fields for credit card collection
 * @param {string} containerId - ID of container with card form inputs
 * @param {object} options - { amount, duration, memberId, memberName, onSuccess, onError }
 */
export async function initHostedFields(containerId, options) {
  const { amount, duration, memberId, memberName, onSuccess, onError } = options;

  try {
    // Create the order first so HostedFields can reference it
    const orderResponse = await fetch('/.netlify/functions/create-paypal-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, duration, memberId, memberName }),
    });
    if (!orderResponse.ok) throw new Error('Failed to create order');
    const orderData = await orderResponse.json();
    const orderId = orderData.id;

    hostedFieldsInstance = await window.paypal.HostedFields.render({
      createOrder: () => orderId,
      fields: {
        number:         { selector: '#card-number' },
        expirationDate: { selector: '#card-expiry' },
        cvv:            { selector: '#card-cvv' },
      },
      styles: {
        input: { 'font-family': 'inherit', 'font-size': '14px', color: '#fff' },
        '.valid': { color: '#34d399' },
        '.invalid': { color: '#f87171' },
      },
    });

    const submitBtn = document.getElementById('card-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        try {
          await hostedFieldsInstance.submit({});
          const captureResponse = await fetch('/.netlify/functions/capture-paypal-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, memberId, memberName, amount, duration }),
          });
          if (!captureResponse.ok) throw new Error('Failed to capture payment');
          const result = await captureResponse.json();
          onSuccess && onSuccess(result);
        } catch (err) {
          console.error('Card payment error:', err);
          onError && onError(err.message || 'Card payment failed. Please try again.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Pay Now';
        }
      });
    }
  } catch (err) {
    console.error('Hosted Fields init error:', err);
    onError && onError('Failed to initialize card form');
  }
}

/**
 * Render PayPal Buttons (legacy - kept for backward compatibility)
 * @deprecated Use renderPayPalWalletButton instead
 */
export async function renderPayPalButtons(containerId, options) {
  return renderPayPalWalletButton(containerId, options);
}
