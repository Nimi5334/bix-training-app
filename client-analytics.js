/**
 * Client Analytics — Phase 6
 * Weight tracking, goal setting, SVG line graph, monthly reminder, goal-reached alert
 */

export class ClientAnalytics {
  constructor() {
    this.weightData   = [];
    this.goal         = {};
    this.currentWeight = 0;
  }

  async init() {
    document.addEventListener('sessionReady', () => this.loadAnalytics());
    window.addEventListener('weightUpdated',  () => this.loadAnalytics());
  }

  async loadAnalytics() {
    if (!window.session) return;
    try {
      const data = await window.DB.getClientAnalytics(window.session.id);
      this.weightData    = (data.weightHistory || []).sort((a, b) => new Date(a.date) - new Date(b.date));
      this.goal          = data.goal || {};
      this.currentWeight = data.currentWeight || 0;

      this._render();
      this._checkMonthlyReminder();
    } catch (err) {
      console.error('ClientAnalytics error:', err);
    }
  }

  _render() {
    const host = document.getElementById('analytics-host');
    if (!host) return;

    const stats = this._calcStats();
    const purposeOptions = [
      { key: 'lose',     label: 'Lose Weight' },
      { key: 'gain',     label: 'Gain Weight' },
      { key: 'maintain', label: 'Maintain' },
    ];
    const currentPurpose = this.goal.purpose || '';

    host.innerHTML = `
      <!-- Goal settings -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px">My Goal</div>

        <div style="display:flex;gap:8px;margin-bottom:16px">
          ${purposeOptions.map(p => `
            <button class="btn ${currentPurpose === p.key ? 'btn-primary' : 'btn-secondary'}"
              style="flex:1;padding:9px 6px;font-size:12px"
              onclick="window.clientAnalytics.setPurpose('${p.key}')">${p.label}</button>
          `).join('')}
        </div>

        <div style="display:flex;gap:10px;align-items:flex-end">
          <div style="flex:1">
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:6px">Goal Weight (kg)</label>
            <input type="number" id="goal-weight-input" value="${this.goal.targetWeight || ''}"
              placeholder="e.g. 75" step="0.1" inputmode="decimal"
              style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--r-md);background:var(--surface2);color:var(--text);font-size:14px" />
          </div>
          <button class="btn btn-primary" style="padding:10px 18px" onclick="window.saveGoalWeight()">Save</button>
        </div>
      </div>

      <!-- Stats tiles -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
        <div style="background:rgba(120,80,255,.07);border:1px solid rgba(120,80,255,.2);border-radius:var(--r-md);padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Current</div>
          <div style="font-size:22px;font-weight:800;color:#a488ff">${stats.current}</div>
          <div style="font-size:11px;color:var(--text-muted)">kg</div>
        </div>
        <div style="background:rgba(52,211,153,.07);border:1px solid rgba(52,211,153,.2);border-radius:var(--r-md);padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Goal</div>
          <div style="font-size:22px;font-weight:800;color:#34d399">${this.goal.targetWeight || '—'}</div>
          <div style="font-size:11px;color:var(--text-muted)">kg</div>
        </div>
        <div style="background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.2);border-radius:var(--r-md);padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">To Go</div>
          <div style="font-size:22px;font-weight:800;color:#fbbf24">${stats.remaining}</div>
          <div style="font-size:11px;color:var(--text-muted)">kg</div>
        </div>
      </div>

      <!-- SVG chart -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);margin-bottom:14px">Weight History</div>
        ${this._renderSvgChart()}
      </div>

      <!-- Update weight -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px">
        <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px">Log Weight</div>
        <div style="display:flex;gap:8px">
          <input type="number" id="weight-input-field" placeholder="kg" step="0.1" inputmode="decimal"
            value="${this.currentWeight || ''}"
            style="flex:1;padding:10px;border:1px solid var(--border);border-radius:var(--r-md);background:var(--surface2);color:var(--text);font-size:14px" />
          <button class="btn btn-primary" onclick="window.updateWeight()" style="padding:10px 20px;font-weight:700">Update</button>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin-top:8px">Monthly reminder to keep your progress up to date.</p>
      </div>
    `;
  }

  _renderSvgChart() {
    if (this.weightData.length < 2) {
      return `<p style="text-align:center;color:var(--text-muted);padding:20px 0;font-size:13px">Log at least 2 weight entries to see your chart.</p>`;
    }

    const W = 460, H = 160, PL = 38, PR = 12, PT = 10, PB = 28;
    const plotW = W - PL - PR, plotH = H - PT - PB;

    const weights = this.weightData.map(d => d.weight);
    const goal = this.goal.targetWeight;
    const allVals = [...weights, ...(goal ? [goal] : [])];
    const minY = Math.min(...allVals) - 1.5;
    const maxY = Math.max(...allVals) + 1.5;
    const rangeY = maxY - minY || 1;

    const toX = i => PL + (i / (this.weightData.length - 1)) * plotW;
    const toY = v => PT + plotH - ((v - minY) / rangeY) * plotH;

    // Line path
    const linePts = this.weightData.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.weight).toFixed(1)}`).join(' ');

    // Area fill path
    const areaPath = linePts + ` L${toX(this.weightData.length - 1).toFixed(1)},${(PT + plotH).toFixed(1)} L${PL},${(PT + plotH).toFixed(1)} Z`;

    // Goal line
    const goalLine = goal ? `
      <line x1="${PL}" y1="${toY(goal).toFixed(1)}" x2="${W - PR}" y2="${toY(goal).toFixed(1)}"
        stroke="#34d399" stroke-width="1.5" stroke-dasharray="5,4" opacity=".7"/>
      <text x="${W - PR - 2}" y="${(toY(goal) - 4).toFixed(1)}" fill="#34d399" font-size="9" text-anchor="end" opacity=".8">Goal ${goal}kg</text>
    ` : '';

    // Dots
    const dots = this.weightData.map((d, i) => `
      <circle cx="${toX(i).toFixed(1)}" cy="${toY(d.weight).toFixed(1)}" r="3"
        fill="${i === this.weightData.length - 1 ? '#a488ff' : '#7850ff'}"
        stroke="var(--surface)" stroke-width="1.5">
        <title>${d.weight}kg · ${new Date(d.date).toLocaleDateString()}</title>
      </circle>
    `).join('');

    // X-axis labels (first, middle, last)
    const labelIdxs = [0, Math.floor((this.weightData.length - 1) / 2), this.weightData.length - 1].filter((v, i, a) => a.indexOf(v) === i);
    const xLabels = labelIdxs.map(i => {
      const d = new Date(this.weightData[i].date);
      const lbl = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `<text x="${toX(i).toFixed(1)}" y="${H}" fill="rgba(255,255,255,.4)" font-size="9" text-anchor="middle">${lbl}</text>`;
    }).join('');

    // Y-axis labels (min, max)
    const yLabels = [minY + 1.5, maxY - 1.5].map(v => `
      <text x="${PL - 4}" y="${(toY(v) + 3).toFixed(1)}" fill="rgba(255,255,255,.4)" font-size="9" text-anchor="end">${v.toFixed(0)}</text>
    `).join('');

    return `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;overflow:visible" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#7850ff" stop-opacity=".25"/>
            <stop offset="100%" stop-color="#7850ff" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <!-- Grid lines -->
        <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT + plotH}" stroke="rgba(255,255,255,.06)" stroke-width="1"/>
        <line x1="${PL}" y1="${PT + plotH}" x2="${W - PR}" y2="${PT + plotH}" stroke="rgba(255,255,255,.06)" stroke-width="1"/>
        ${yLabels}
        ${xLabels}
        <!-- Area fill -->
        <path d="${areaPath}" fill="url(#wg)"/>
        <!-- Line -->
        <path d="${linePts}" fill="none" stroke="#7850ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ${goalLine}
        ${dots}
      </svg>
    `;
  }

  _calcStats() {
    const current = this.currentWeight || this.weightData[this.weightData.length - 1]?.weight || 0;
    const goal = this.goal.targetWeight || current;
    return {
      current: current.toFixed(1),
      remaining: Math.abs(current - goal).toFixed(1),
    };
  }

  _checkMonthlyReminder() {
    if (!this.weightData.length) return;
    const lastEntry = new Date(this.weightData[this.weightData.length - 1].date);
    const daysSince = Math.floor((Date.now() - lastEntry.getTime()) / 86400000);
    if (daysSince >= 28) {
      setTimeout(() => window.toast?.('Time to update your weight! 📊 It\'s been over a month.', 'info'), 1500);
    }
  }

  async setPurpose(key) {
    this.goal.purpose = key;
    await window.DB.updateClientGoal(window.session.id, { purpose: key });
    this._render();
  }
}

// Global functions
window.saveGoalWeight = async () => {
  const weight = parseFloat(document.getElementById('goal-weight-input')?.value || 0);
  if (!weight || weight <= 0) { window.toast('Enter a valid weight', 'error'); return; }
  try {
    await window.DB.updateClientGoal(window.session.id, { targetWeight: weight });
    window.toast('Goal saved! 🎯', 'success');
    await window.clientAnalytics?.loadAnalytics();
  } catch { window.toast('Failed to save goal', 'error'); }
};

window.updateWeight = async () => {
  const weight = parseFloat(document.getElementById('weight-input-field')?.value || 0);
  if (!weight || weight <= 0) { window.toast('Enter a valid weight', 'error'); return; }
  try {
    await window.DB.addWeightRecord(window.session.id, weight);
    window.toast('Weight logged! 📊', 'success');

    // Goal-reached check
    const analytics = window.clientAnalytics;
    if (analytics) {
      const goal = analytics.goal.targetWeight;
      const purpose = analytics.goal.purpose;
      const prevWeight = analytics.currentWeight;
      if (goal && purpose) {
        const reached = (purpose === 'lose' && weight <= goal && prevWeight > goal)
          || (purpose === 'gain' && weight >= goal && prevWeight < goal);
        if (reached && window.session?.coachId) {
          const firstName = (window.session.name || '').split(' ')[0];
          await window.DB.postToGlobalChannel?.(window.session.coachId, window.session.id,
            `🏆 ${firstName} reached their goal weight of ${goal}kg!`);
        }
      }
    }

    await analytics?.loadAnalytics();
  } catch { window.toast('Failed to log weight', 'error'); }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ClientAnalytics };
}
