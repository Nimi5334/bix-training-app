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
      const user = await window.DB.getUserById(window.session.id);
      this.isPro  = user?.tier === 'pro';
      this.brand  = user?.brand || { name: '', accent: '#7850ff' };
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
      // Apply immediately to this coach session too
      if (accent) document.documentElement.style.setProperty('--primary', accent);
    } catch {
      window.toast('Failed to save brand', 'error');
    }
  }
}
