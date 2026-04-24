/**
 * Client Billing & Payment
 * Membership renewal, payment processing, and transaction history
 */

export class ClientBilling {
  constructor() {
    this.membership = null;
    this.history = [];
  }

  async init() {
    document.addEventListener('sessionReady', () => this.loadBillingData());
    window.addEventListener('paymentProcessed', () => this.loadBillingData());
  }

  async loadBillingData() {
    if (!window.session) return;
    try {
      const data = await window.DB.getClientBilling(window.session.id);
      this.membership = data.membership || {};
      this.history = data.history || [];
      this.renderMembershipStatus();
      this.renderPaymentOptions();
      this.renderHistory();
    } catch (err) {
      console.error('Failed to load billing data:', err);
    }
  }

  renderMembershipStatus() {
    const container = document.getElementById('membership-status') || this.createStatusContainer();
    const now = new Date();
    const expiryDate = new Date(this.membership.expiryDate);
    const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));

    let statusColor = 'var(--green)';
    let statusText = 'Active';
    let actionBtnText = 'Renew Now';

    if (daysUntilExpiry <= 0) {
      statusColor = 'var(--red)';
      statusText = 'Expired';
      actionBtnText = 'Renew Now';
    } else if (daysUntilExpiry <= 7) {
      statusColor = 'var(--amber)';
      statusText = `Expires in ${daysUntilExpiry} days`;
      actionBtnText = 'Renew Now';
    }

    container.innerHTML = `
      <div style="background: var(--surface); border-radius: var(--r-lg); padding: 20px; margin-bottom: 20px">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px">
          <div>
            <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 8px">Your Membership</h3>
            <div style="font-size: 24px; font-weight: 700; color: ${statusColor}">${statusText}</div>
          </div>
          <div style="text-align: right">
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px">Expires</div>
            <div style="font-size: 16px; font-weight: 600">${this.formatDate(this.membership.expiryDate)}</div>
          </div>
        </div>

        <button class="btn btn-primary" style="width: 100%; padding: 12px; font-weight: 700; margin-top: 12px" onclick="openPaymentOptions()">
          💳 ${actionBtnText}
        </button>
      </div>
    `;
  }

  renderPaymentOptions() {
    const container = document.getElementById('payment-options') || this.createPaymentContainer();
    const amount = this.membership.renewalAmount || 29.99;

    container.innerHTML = `
      <div style="display: none" id="payment-methods-section">
        <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 12px">Payment Method</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px">
          <button class="btn btn-secondary payment-method-btn" onclick="selectPaymentMethod('stripe')" style="padding: 12px; border: 2px solid transparent; transition: all .2s" data-method="stripe">
            <div style="font-size: 18px; margin-bottom: 4px">💳</div>
            <div style="font-size: 12px; font-weight: 600">Credit Card</div>
            <div style="font-size: 11px; color: var(--text-muted)">Visa, Mastercard</div>
          </button>
          <button class="btn btn-secondary payment-method-btn" onclick="selectPaymentMethod('paypal')" style="padding: 12px; border: 2px solid transparent; transition: all .2s" data-method="paypal">
            <div style="font-size: 18px; margin-bottom: 4px">🅿️</div>
            <div style="font-size: 12px; font-weight: 600">PayPal</div>
            <div style="font-size: 11px; color: var(--text-muted)">Fast & Secure</div>
          </button>
        </div>

        <div style="background: var(--surface2); padding: 12px; border-radius: var(--r-md); margin-bottom: 16px">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px">
            <span>Renewal Amount</span>
            <span style="font-weight: 700">$${amount.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted)">
            <span>Duration</span>
            <span>1 Month</span>
          </div>
        </div>

        <div style="display: flex; gap: 10px">
          <button class="btn btn-secondary" style="flex: 1" onclick="closePaymentOptions()">Cancel</button>
          <button class="btn btn-primary" style="flex: 1; display: none" id="process-payment-btn" onclick="processPayment()">
            Complete Payment
          </button>
        </div>
      </div>
    `;
  }

  renderHistory() {
    const container = document.getElementById('payment-history') || this.createHistoryContainer();

    if (this.history.length === 0) {
      container.innerHTML = '<p style="padding: 24px 0; text-align: center; color: var(--text-muted)">No payment history yet</p>';
      return;
    }

    container.innerHTML = `
      <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 12px">Payment History</h3>
      <div style="display: flex; flex-direction: column; gap: 8px">
        ${this.history.map(payment => `
          <div style="background: var(--surface); padding: 12px; border-radius: var(--r-md); display: flex; justify-content: space-between; align-items: center">
            <div>
              <div style="font-size: 13px; font-weight: 600">${payment.description || 'Membership Renewal'}</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px">${this.formatDate(payment.date)}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px">
              <div style="font-weight: 600; color: ${payment.status === 'completed' ? 'var(--green)' : 'var(--amber)'}">
                ${payment.status === 'completed' ? '+' : ''}$${payment.amount.toFixed(2)}
              </div>
              <div style="font-size: 11px; padding: 4px 8px; border-radius: 4px; background: ${payment.status === 'completed' ? 'rgba(52, 211, 153, .15)' : 'rgba(245, 158, 11, .15)'}; color: ${payment.status === 'completed' ? 'var(--green)' : 'var(--amber)'}; font-weight: 600">
                ${payment.status.toUpperCase()}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  createStatusContainer() {
    const container = document.createElement('div');
    container.id = 'membership-status';
    const billingPage = document.getElementById('page-billing') || this.createBillingPage();
    billingPage.insertBefore(container, billingPage.firstChild);
    return container;
  }

  createPaymentContainer() {
    const container = document.createElement('div');
    container.id = 'payment-options';
    const billingPage = document.getElementById('page-billing') || this.createBillingPage();
    billingPage.appendChild(container);
    return container;
  }

  createHistoryContainer() {
    const container = document.createElement('div');
    container.id = 'payment-history';
    const billingPage = document.getElementById('page-billing') || this.createBillingPage();
    billingPage.appendChild(container);
    return container;
  }

  createBillingPage() {
    const page = document.createElement('div');
    page.className = 'page';
    page.id = 'page-billing';
    page.style.cssText = 'max-width: 600px';
    const main = document.querySelector('main');
    if (main) main.appendChild(page);
    return page;
  }
}

let selectedPaymentMethod = null;

// Global functions
window.openPaymentOptions = () => {
  document.getElementById('payment-methods-section').style.display = 'block';
};

window.closePaymentOptions = () => {
  document.getElementById('payment-methods-section').style.display = 'none';
  selectedPaymentMethod = null;
};

window.selectPaymentMethod = (method) => {
  selectedPaymentMethod = method;
  document.querySelectorAll('.payment-method-btn').forEach(btn => {
    btn.style.borderColor = 'transparent';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
  });
  const selected = document.querySelector(`[data-method="${method}"]`);
  if (selected) {
    selected.style.borderColor = 'var(--purple)';
    selected.classList.remove('btn-secondary');
    selected.classList.add('btn-primary');
  }
  document.getElementById('process-payment-btn').style.display = 'block';
};

window.processPayment = async () => {
  if (!selectedPaymentMethod) {
    window.toast('Please select a payment method', 'error');
    return;
  }

  try {
    if (selectedPaymentMethod === 'stripe') {
      // TODO: Open Stripe payment modal
      window.toast('Opening payment...');
    } else if (selectedPaymentMethod === 'paypal') {
      // TODO: Open PayPal payment flow
      window.toast('Redirecting to PayPal...');
    }
  } catch (err) {
    window.toast('Payment failed', 'error');
  }
};

// Initialize on load
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ClientBilling };
}
