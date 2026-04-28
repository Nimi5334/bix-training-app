/**
 * Client Billing — real PayPal payments
 */

export class ClientBilling {
  constructor() {
    this.membership = null;
    this.sdkReady   = false;
  }

  async init() {
    document.addEventListener('sessionReady', () => this.loadBillingData());
  }

  async loadBillingData() {
    if (!window.session) return;
    try {
      const user = await window.DB.getUserById(window.session.id);
      this.membership = {
        expiry:        user?.membershipExpiry || null,
        lastPayment:   user?.lastPaymentDate  || null,
        lastMethod:    user?.lastPaymentMethod || null,
      };
      this._renderStatus();
    } catch (err) {
      console.error('ClientBilling.loadBillingData error:', err);
    }
  }

  _renderStatus() {
    const host = document.getElementById('billing-host');
    if (!host) return;

    const expiry       = this.membership.expiry ? new Date(this.membership.expiry) : null;
    const now          = new Date();
    const daysLeft     = expiry ? Math.ceil((expiry - now) / 86400000) : null;
    const isExpired    = expiry ? expiry < now : true;
    const isExpiring   = !isExpired && daysLeft !== null && daysLeft <= 7;

    const statusColor  = isExpired ? '#f87171' : isExpiring ? '#fbbf24' : '#34d399';
    const statusLabel  = isExpired ? 'Expired' : isExpiring ? `Expires in ${daysLeft}d` : 'Active';
    const expiryStr    = expiry ? expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

    host.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:6px">Membership</div>
            <div style="font-size:24px;font-weight:800;color:${statusColor}">${statusLabel}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Expiry</div>
            <div style="font-size:15px;font-weight:600">${expiryStr}</div>
          </div>
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:16px;padding:12px;font-weight:700;font-size:15px"
          onclick="window.clientBilling.openPayment()">
          💳 ${isExpired ? 'Renew Membership' : 'Extend Membership'}
        </button>
      </div>

      <!-- Payment panel (hidden until Renew clicked) -->
      <div id="billing-payment-panel" style="display:none">

        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px;margin-bottom:12px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px">Select Plan</div>
          <div style="display:flex;flex-direction:column;gap:8px" id="billing-plan-selector">
            ${[
              { months: 1, price: 29.99, label: '1 Month' },
              { months: 3, price: 79.99, label: '3 Months' },
              { months: 12, price: 249.99, label: '1 Year — Best Value' },
            ].map((p, i) => `
              <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid ${i === 2 ? 'var(--primary)' : 'var(--border)'};border-radius:var(--r-md);cursor:pointer;transition:border .15s"
                onclick="window.clientBilling.selectPlan(${p.months}, ${p.price}, this)">
                <input type="radio" name="plan" value="${p.months}" ${i === 2 ? 'checked' : ''} style="accent-color:var(--primary)" />
                <span style="flex:1;font-weight:600">${p.label}</span>
                <span style="font-weight:800;color:var(--primary)">$${p.price}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px" id="billing-buttons-wrap">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px">Pay with</div>
          <div id="paypal-wallet-btn" style="margin-bottom:10px"></div>
          <div id="paypal-google-btn" style="margin-bottom:16px"></div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
            <div style="flex:1;height:1px;background:var(--border)"></div>
            <span style="font-size:11px;color:var(--text-muted)">or pay by card</span>
            <div style="flex:1;height:1px;background:var(--border)"></div>
          </div>
          <div id="card-number"  style="padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:8px;min-height:44px"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
            <div id="card-expiry" style="padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);min-height:44px"></div>
            <div id="card-cvv"    style="padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);min-height:44px"></div>
          </div>
          <button id="card-submit-btn" class="btn btn-primary" style="width:100%;padding:13px;font-weight:700;font-size:15px">
            Pay Now
          </button>
          <button class="btn btn-secondary" style="width:100%;margin-top:8px;padding:10px" onclick="window.clientBilling.closePayment()">Cancel</button>
        </div>

        <div id="billing-error" style="color:#f87171;font-size:13px;margin-top:10px;display:none"></div>
        <div id="billing-success" style="color:#34d399;font-size:13px;margin-top:10px;display:none"></div>
      </div>
    `;

    // Store selected plan defaults
    this._selectedMonths = 12;
    this._selectedAmount = 249.99;
  }

  selectPlan(months, price, labelEl) {
    this._selectedMonths = months;
    this._selectedAmount = price;
    document.querySelectorAll('#billing-plan-selector label').forEach(l => {
      l.style.borderColor = 'var(--border)';
    });
    if (labelEl) labelEl.style.borderColor = 'var(--primary)';
    // Re-init payment buttons for new amount
    this._mountButtons();
  }

  async openPayment() {
    const panel = document.getElementById('billing-payment-panel');
    if (!panel) return;
    panel.style.display = 'block';

    if (!this.sdkReady) {
      try {
        await window.PaymentModule.initPayPal();
        this.sdkReady = true;
      } catch (err) {
        this._showError('Failed to load payment system: ' + err.message);
        return;
      }
    }
    this._mountButtons();
  }

  _mountButtons() {
    const uid  = window.session?.id   || '';
    const name = window.session?.name || '';
    const amount   = this._selectedAmount || 249.99;
    const duration = this._selectedMonths  || 12;

    const onSuccess = (result) => {
      this._showSuccess(`Payment successful! Membership extended to ${result.newExpiry || 'updated'}.`);
      document.getElementById('billing-payment-panel').style.display = 'none';
      this.loadBillingData();
      window.toast?.('Membership renewed!', 'success');
    };
    const onError = (msg) => this._showError(msg);

    window.PaymentModule.renderPayPalWalletButton('paypal-wallet-btn',
      { amount, duration, memberId: uid, memberName: name, onSuccess, onError });

    window.PaymentModule.renderGooglePayButton('paypal-google-btn',
      { amount, duration, memberId: uid, memberName: name, onSuccess, onError });

    window.PaymentModule.initHostedFields('card-form',
      { amount, duration, memberId: uid, memberName: name, onSuccess, onError });
  }

  closePayment() {
    const panel = document.getElementById('billing-payment-panel');
    if (panel) panel.style.display = 'none';
  }

  _showError(msg) {
    const el = document.getElementById('billing-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 6000);
  }

  _showSuccess(msg) {
    const el = document.getElementById('billing-success');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ClientBilling };
}
