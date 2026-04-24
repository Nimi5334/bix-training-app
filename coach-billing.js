/**
 * Coach Billing Management
 * Displays pending/upcoming client renewals and payment management
 */

export class CoachBilling {
  constructor() {
    this.renewals = [];
    this.history = [];
  }

  async init() {
    document.addEventListener('sessionReady', () => this.loadBillingData());
    window.addEventListener('paymentProcessed', () => this.loadBillingData());
  }

  async loadBillingData() {
    if (!window.session) return;
    try {
      this.renewals = await window.DB.getPendingRenewals(window.session.id);
      this.history = await window.DB.getPaymentHistory(window.session.id);
      this.renderRenewals();
      this.renderHistory();
    } catch (err) {
      console.error('Failed to load billing data:', err);
    }
  }

  renderRenewals() {
    const container = document.getElementById('coach-renewals-list') || this.createRenewalsContainer();

    if (this.renewals.length === 0) {
      container.innerHTML = '<p style="padding:24px 0;text-align:center;color:var(--text-muted)">No pending renewals</p>';
      return;
    }

    container.innerHTML = this.renewals.map(renewal => `
      <div class="renewal-card">
        <div class="renewal-info">
          <div class="renewal-client">${renewal.clientName}</div>
          <div class="renewal-date">Expires: ${this.formatDate(renewal.expiryDate)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="renewal-amount">$${renewal.amount.toFixed(2)}</div>
          <button class="btn btn-primary" style="padding:8px 14px;font-size:12px" onclick="sendRenewalReminder('${renewal.clientId}')">Send Reminder</button>
        </div>
      </div>
    `).join('');
  }

  renderHistory() {
    const container = document.getElementById('coach-payment-history') || this.createHistoryContainer();

    if (this.history.length === 0) {
      container.innerHTML = '<p style="padding:24px 0;text-align:center;color:var(--text-muted)">No payment history</p>';
      return;
    }

    container.innerHTML = this.history.map(payment => `
      <div class="renewal-card">
        <div class="renewal-info">
          <div class="renewal-client">${payment.clientName}</div>
          <div class="renewal-date">${this.formatDate(payment.date)} · ${payment.status.toUpperCase()}</div>
        </div>
        <div class="renewal-amount" style="color: ${payment.status === 'completed' ? 'var(--green)' : 'var(--amber)'}">${payment.status === 'completed' ? '+' : ''}$${payment.amount.toFixed(2)}</div>
      </div>
    `).join('');
  }

  createRenewalsContainer() {
    const section = document.createElement('div');
    section.id = 'coach-renewals-list';
    const billingPage = document.getElementById('page-billing');
    if (billingPage) {
      const heading = document.createElement('h3');
      heading.style.cssText = 'font-size:14px;font-weight:700;letter-spacing:1px;color:var(--text-muted);text-transform:uppercase;margin:24px 0 12px';
      heading.textContent = 'Pending Renewals';
      billingPage.appendChild(heading);
      billingPage.appendChild(section);
    }
    return section;
  }

  createHistoryContainer() {
    const section = document.createElement('div');
    section.id = 'coach-payment-history';
    const billingPage = document.getElementById('page-billing');
    if (billingPage) {
      const heading = document.createElement('h3');
      heading.style.cssText = 'font-size:14px;font-weight:700;letter-spacing:1px;color:var(--text-muted);text-transform:uppercase;margin:32px 0 12px';
      heading.textContent = 'Payment History';
      billingPage.appendChild(heading);
      billingPage.appendChild(section);
    }
    return section;
  }

  formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

// Global functions
window.sendRenewalReminder = async (clientId) => {
  try {
    const message = 'Your membership is about to expire. Please renew your membership to continue accessing Bix training features.';
    await window.DB.sendAutoMessage(clientId, message, 'renewal-reminder');
    window.toast('Renewal reminder sent! 📨');

    if (window.coachBilling) {
      await window.coachBilling.loadBillingData();
    }
  } catch (err) {
    console.error('Failed to send reminder:', err);
    window.toast('Failed to send reminder', 'error');
  }
};

// Initialize on load
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CoachBilling };
}
