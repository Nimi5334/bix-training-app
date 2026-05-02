/**
 * Coach Design — Phase 7 (Pro tier)
 * Brand name + accent color, persisted to Firestore and applied on client login
 */

const PRESETS = [
  { label: 'Purple', value: '#7850ff' },
  { label: 'Teal',   value: '#00d4aa' },
  { label: 'Blue',   value: '#3b82f6' },
  { label: 'Orange', value: '#f97316' },
];

export class CoachDesign {
  constructor() {
    this.brand = { name: '', accent: '#7850ff' };
    this.isPro = false;
  }

  async init() {
    document.addEventListener('sessionReady', () => this.load());
  }

  async load() {
    if (!window.session) return;
    try {
      const [user, settings] = await Promise.all([
        window.DB.getUserById(window.session.id),
        window.DB.getSettings(),
      ]);
      this.isPro        = user?.tier === 'pro';
      this.brand        = user?.brand || { name: '', accent: '#7850ff' };
      this._webhookUrl  = user?.webhookUrl || '';
      this._waiverText  = settings?.waiverText || '';
      this._render();
    } catch (err) {
      console.error('CoachDesign.load error:', err);
    }
  }

  _render() {
    const host = document.getElementById('design-host');
    if (!host) return;

    if (!this.isPro) {
      host.innerHTML = `
        <div style="text-align:center;padding:60px 20px;max-width:480px;margin:0 auto">
          <div style="font-size:48px;margin-bottom:16px">✨</div>
          <h2 style="font-size:18px;font-weight:700;margin-bottom:8px">Pro Feature</h2>
          <p style="color:var(--text-muted);font-size:14px;line-height:1.6;margin-bottom:20px">
            Custom branding lets you replace "Bix" with your own gym name and apply your brand color to client dashboards. Available on the Pro plan.
          </p>
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px;text-align:left">
            <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Pro includes</div>
            ${['Custom gym brand name','Custom accent color on client dashboards','Priority support'].map(f => `<div style="font-size:13px;margin-bottom:8px">✅ ${f}</div>`).join('')}
          </div>
        </div>`;
      return;
    }

    const presetBtns = PRESETS.map(p => `
      <button onclick="window.coachDesign._selectPreset('${p.value}')"
        style="width:36px;height:36px;border-radius:50%;border:3px solid ${this.brand.accent === p.value ? '#fff' : 'transparent'};
               background:${p.value};cursor:pointer;transition:border-color .15s"
        title="${p.label}"></button>
    `).join('');

    host.innerHTML = `
      <div style="max-width:480px">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px">Brand Name</div>
          <input id="design-brand-name" type="text" value="${this.brand.name || ''}" placeholder="Your Gym Name"
            style="width:100%;padding:12px;border:1px solid var(--border);border-radius:var(--r-md);background:var(--surface2);color:var(--text);font-size:15px;margin-bottom:8px" />
          <p style="font-size:12px;color:var(--text-muted)">Replaces "Bix" in your clients' dashboards.</p>
        </div>

        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;margin-bottom:20px">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px">Accent Color</div>

          <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px">
            ${presetBtns}
            <input type="color" id="design-color-custom" value="${this.brand.accent}"
              style="width:36px;height:36px;border-radius:50%;border:2px solid var(--border);padding:0;cursor:pointer;background:none"
              oninput="window.coachDesign._selectPreset(this.value)" title="Custom" />
          </div>

          <!-- Live preview -->
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Preview</div>
            <button id="design-preview-btn" style="background:${this.brand.accent};color:#fff;border:none;border-radius:var(--r-md);padding:10px 20px;font-weight:700;font-size:13px;cursor:default">
              ${this.brand.name || 'Your Gym'} — Primary Button
            </button>
          </div>
        </div>

        <button class="btn btn-primary btn-block" style="padding:14px" onclick="window.coachDesign.save()">Save Branding</button>
      </div>

      <!-- Waiver Text -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;margin-top:16px">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Client Waiver Text</div>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">New clients will see and sign this waiver before accessing their dashboard. Leave blank to use the default.</p>
        <textarea id="design-waiver-text" rows="6" placeholder="Leave blank to use the default waiver text…"
          style="width:100%;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-size:13px;resize:vertical;font-family:inherit;line-height:1.6">${this._waiverText || ''}</textarea>
        <button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="window.coachDesign.saveWaiver()">Save Waiver</button>
      </div>

      <!-- Webhook / Zapier Integration -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;margin-top:16px">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Webhook / Zapier Integration</div>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
          Paste a Zapier webhook URL (or any endpoint) to receive events when a new member joins, a payment is received, or a workout is logged.
          <br/><span style="color:var(--primary)">Events: member.created · payment.received · workout.logged</span>
        </p>
        <input id="design-webhook-url" type="url" value="${this._webhookUrl || ''}" placeholder="https://hooks.zapier.com/hooks/catch/…"
          style="width:100%;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);font-size:13px;margin-bottom:10px" />
        <div style="display:flex;gap:10px">
          <button class="btn btn-secondary btn-sm" onclick="window.coachDesign.saveWebhook()">Save URL</button>
          <button class="btn btn-secondary btn-sm" onclick="window.coachDesign.testWebhook()">Send Test</button>
        </div>
        <div id="design-webhook-msg" style="display:none;font-size:12px;margin-top:8px;color:#10b981"></div>
      </div>
    `;
  }

  _selectPreset(color) {
    this.brand.accent = color;
    const preview = document.getElementById('design-preview-btn');
    if (preview) preview.style.background = color;
    const custom  = document.getElementById('design-color-custom');
    if (custom)  custom.value = color;
    // Update preset button borders
    document.querySelectorAll('#design-host button[title]').forEach(btn => {
      if (btn.style.background === color) btn.style.borderColor = '#fff';
      else btn.style.borderColor = 'transparent';
    });
  }

  async save() {
    const name   = document.getElementById('design-brand-name')?.value.trim() || '';
    const accent = this.brand.accent;
    this.brand = { name, accent };
    try {
      await window.DB.updateUser(window.session.id, { brand: { name, accent } });
      window.toast('Brand saved! Clients will see it on next login.', 'success');
      if (accent) document.documentElement.style.setProperty('--primary', accent);
    } catch {
      window.toast('Failed to save brand', 'error');
    }
  }

  async saveWaiver() {
    const text = document.getElementById('design-waiver-text')?.value.trim() || '';
    try {
      const settings = await window.DB.getSettings();
      await window.DB.saveSettings({ ...settings, waiverText: text });
      window.toast('Waiver text saved!', 'success');
    } catch {
      window.toast('Failed to save waiver', 'error');
    }
  }

  async saveWebhook() {
    const url = document.getElementById('design-webhook-url')?.value.trim() || '';
    const msg = document.getElementById('design-webhook-msg');
    try {
      await window.DB.updateUser(window.session.id, { webhookUrl: url });
      this._webhookUrl = url;
      msg.style.display = 'block';
      msg.textContent = '✅ Webhook URL saved!';
      setTimeout(() => { msg.style.display = 'none'; }, 3000);
    } catch {
      window.toast('Failed to save webhook URL', 'error');
    }
  }

  async testWebhook() {
    const url = document.getElementById('design-webhook-url')?.value.trim() || this._webhookUrl;
    const msg = document.getElementById('design-webhook-msg');
    if (!url) { window.toast('Enter a webhook URL first', 'warning'); return; }
    msg.style.display = 'block';
    msg.textContent = 'Sending test…';
    try {
      const res = await fetch('/.netlify/functions/fire-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'webhook.test',
          payload: { message: 'Test event from Bix', coachId: window.session.id },
          coachId: window.session.id,
        }),
      });
      if (res.ok) {
        msg.textContent = '✅ Test event sent successfully!';
      } else {
        msg.textContent = '⚠ Sent but got status ' + res.status;
      }
    } catch (e) {
      msg.textContent = '❌ Failed to send test event';
    }
    setTimeout(() => { msg.style.display = 'none'; }, 4000);
  }
}
