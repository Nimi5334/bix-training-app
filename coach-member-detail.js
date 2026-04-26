/**
 * Coach Member Detail
 * Full-screen detail view for a single member: Program + Status sub-tabs
 */

export class CoachMemberDetail {
  constructor() {
    this.member   = null;
    this.plans    = [];
    this.logs     = [];
    this.activeTab = 'program';
  }

  async open(memberId) {
    if (!window.session) return;
    try {
      const [member, plans, logs] = await Promise.all([
        window.DB.getUserById(memberId),
        window.DB.getPlansByClient(memberId),
        window.DB.getWorkoutLogsByClient(memberId).catch(() => []),
      ]);
      this.member = member;
      this.plans  = plans || [];
      this.logs   = (logs || []).sort((a, b) => new Date(b.date) - new Date(a.date));
      this.activeTab = 'program';
      this._render();
      window.showPage('member-detail');
    } catch (err) {
      console.error('CoachMemberDetail.open error:', err);
    }
  }

  _render() {
    const c = this.member;
    if (!c) return;

    const initials = (c.name || '').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    const [grad1, grad2] = window.coachMembers?.getAvatarGradient(c.id) || ['#a78bfa', '#6d28d9'];

    const now = Date.now();
    const lastWorkoutDate = this.logs[0]?.date ? new Date(this.logs[0].date).getTime() : 0;
    const daysSince = lastWorkoutDate ? Math.floor((now - lastWorkoutDate) / 86400000) : null;
    const streak = c.workoutStreak || 0;
    const expiry = c.membershipExpiry ? new Date(c.membershipExpiry) : null;
    const daysUntilExpiry = expiry ? Math.ceil((expiry.getTime() - now) / 86400000) : null;
    const isExpired = expiry && expiry < new Date();
    const isAtRisk  = !isExpired && (daysSince === null || daysSince >= 3);
    const isExpiring = !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= 7;

    document.getElementById('mdd-avatar').style.background = `linear-gradient(135deg,${grad1},${grad2})`;
    document.getElementById('mdd-initials').textContent  = initials;
    document.getElementById('mdd-name').textContent      = c.name || 'Unknown';
    document.getElementById('mdd-username').textContent  = c.username ? '@' + c.username : '';

    this._renderTab(this.activeTab);
  }

  _renderTab(tab) {
    this.activeTab = tab;
    document.getElementById('mdd-tab-program').classList.toggle('active', tab === 'program');
    document.getElementById('mdd-tab-status').classList.toggle('active', tab === 'status');
    document.getElementById('mdd-panel-program').style.display = tab === 'program' ? '' : 'none';
    document.getElementById('mdd-panel-status').style.display  = tab === 'status'  ? '' : 'none';

    if (tab === 'program') this._renderProgram();
    if (tab === 'status')  this._renderStatus();
  }

  async _renderProgram() {
    const host = document.getElementById('mdd-program-content');
    host.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Loading…</p>';

    if (!this.plans.length) {
      host.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:36px;margin-bottom:12px">📋</div>
          <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px">No programs assigned yet.</p>
          <button class="btn btn-primary btn-sm" onclick="openCreatePlanFor('${this.member.id}')">+ New Program</button>
        </div>`;
      return;
    }

    const cards = await Promise.all(this.plans.map(p => window.renderPlanCard(p)));
    host.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
        <button class="btn btn-primary btn-sm" onclick="openCreatePlanFor('${this.member.id}')">+ New Program</button>
      </div>
      ${cards.join('')}`;
  }

  _renderStatus() {
    const host = document.getElementById('mdd-status-content');
    const c = this.member;
    const now = Date.now();

    const lastLog = this.logs[0];
    const daysSince = lastLog?.date ? Math.floor((now - new Date(lastLog.date).getTime()) / 86400000) : null;
    const streak = c.workoutStreak || 0;
    const expiry = c.membershipExpiry ? new Date(c.membershipExpiry) : null;
    const daysUntilExpiry = expiry ? Math.ceil((expiry.getTime() - now) / 86400000) : null;
    const isExpired  = expiry && expiry < new Date();
    const isExpiring = !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= 7;
    const isAtRisk   = !isExpired && (daysSince === null || daysSince >= 3);

    const warnings = [];
    if (isExpired)  warnings.push(`<div class="mdd-alert red">❌ Membership expired on ${expiry.toLocaleDateString()}</div>`);
    if (isExpiring) warnings.push(`<div class="mdd-alert amber">⚠ Membership expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}</div>`);
    if (isAtRisk && !isExpired)   warnings.push(`<div class="mdd-alert amber">⏳ ${daysSince === null ? 'No workouts logged yet' : `Silent for ${daysSince} day${daysSince === 1 ? '' : 's'}`}</div>`);

    const recentRows = this.logs.slice(0, 5).map(l => {
      const d = new Date(l.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const sets = Array.isArray(l.exercises) ? l.exercises.length : '—';
      const dur  = l.durationMin ? `${l.durationMin}m` : '—';
      return `<tr style="border-bottom:1px solid rgba(255,255,255,.05)">
        <td style="padding:9px 8px 9px 0;font-size:13px">${d}</td>
        <td style="padding:9px 6px;font-size:13px;color:var(--text-muted)">${sets} sets</td>
        <td style="padding:9px 0 9px 6px;font-size:13px;color:var(--text-muted)">${dur}</td>
      </tr>`;
    }).join('');

    host.innerHTML = `
      ${warnings.join('')}

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
        <div class="mdd-stat">
          <div class="mdd-stat-num">${streak}</div>
          <div class="mdd-stat-label">Day Streak</div>
        </div>
        <div class="mdd-stat">
          <div class="mdd-stat-num">${daysSince === null ? '—' : daysSince + 'd'}</div>
          <div class="mdd-stat-label">Since Last Workout</div>
        </div>
        <div class="mdd-stat">
          <div class="mdd-stat-num">${this.logs.length}</div>
          <div class="mdd-stat-label">Total Workouts</div>
        </div>
      </div>

      ${this.logs.length ? `
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:10px">Recent Workouts</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead><tr style="font-size:11px;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:5px 8px 5px 0;font-weight:600">Date</th>
            <th style="text-align:left;padding:5px 6px;font-weight:600">Volume</th>
            <th style="text-align:left;padding:5px 0 5px 6px;font-weight:600">Duration</th>
          </tr></thead>
          <tbody>${recentRows}</tbody>
        </table>` : ''}

      <button class="btn btn-primary" style="width:100%;margin-top:4px"
        onclick="window.MessagingUI?.openChat(window.session?.id,'${c.id}','${(c.name || '').replace(/'/g, "\\'")}');showPage('messages')">
        💬 Send Message
      </button>`;
  }

  switchTab(tab) { this._renderTab(tab); }
}
