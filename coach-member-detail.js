/**
 * Coach Member Detail
 * Single page: thin status header strip + the member's program(s).
 */

export class CoachMemberDetail {
  constructor() {
    this.member = null;
    this.plans  = [];
    this.logs   = [];
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
      await this._render();
      window.showPage('member-detail');
    } catch (err) {
      console.error('CoachMemberDetail.open error:', err);
    }
  }

  async _render() {
    const host = document.getElementById('member-detail-host');
    if (!host || !this.member) return;
    const c = this.member;

    const initials = (c.name || '').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    const [grad1, grad2] = window.coachMembers?.getAvatarGradient?.(c.id) || ['#a78bfa', '#6d28d9'];

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
    if (isAtRisk && !isExpired) warnings.push(`<div class="mdd-alert amber">⏳ ${daysSince === null ? 'No workouts logged yet' : `Silent for ${daysSince} day${daysSince === 1 ? '' : 's'}`}</div>`);

    const cards = this.plans.length
      ? await Promise.all(this.plans.map(p => window.renderPlanCard?.(p) || ''))
      : [];

    host.innerHTML = `
      <!-- Header strip -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="showPage('members')">← Back</button>
        <div class="member-avatar" style="width:48px;height:48px;font-size:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;background:linear-gradient(135deg,${grad1},${grad2})">${initials}</div>
        <div style="flex:1;min-width:160px">
          <div style="font-size:18px;font-weight:700">${c.name || 'Unknown'}</div>
          <div style="font-size:12px;color:var(--text-muted)">
            ${c.username ? '@' + c.username + ' · ' : ''}
            🔥 ${streak}d streak · ${daysSince === null ? 'no workouts yet' : daysSince === 0 ? 'active today' : `last workout ${daysSince}d ago`}
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="window.MessagingUI?.openChat(window.session?.id,'${c.id}','${(c.name || '').replace(/'/g, "\\'")}');showPage('messages')">💬 Message</button>
      </div>

      ${warnings.join('')}

      <!-- Program section -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0 12px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted)">Program</div>
        <button class="btn btn-primary btn-sm" onclick="openCreatePlanFor('${c.id}')">+ New Program</button>
      </div>
      ${this.plans.length ? cards.join('') : `
        <div style="text-align:center;padding:40px 20px;background:var(--surface);border:1px dashed var(--border);border-radius:12px">
          <div style="font-size:36px;margin-bottom:12px">📋</div>
          <p style="color:var(--text-muted);font-size:14px">No programs assigned yet — click "+ New Program" above.</p>
        </div>`}
    `;
  }
}
