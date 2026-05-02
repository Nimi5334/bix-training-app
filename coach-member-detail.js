/**
 * Coach Member Detail
 * Tabs: Program · Nutrition · Intake
 */
import { renderCoachNutritionTab } from './nutrition.js';
import { openLibraryModal } from './exercise-library.js';

export class CoachMemberDetail {
  constructor() {
    this.member  = null;
    this.plans   = [];
    this.logs    = [];
    this.intake  = null;
    this.activeTab = 'program';
  }

  async open(memberId) {
    if (!window.session) return;
    try {
      const [member, plans, logs, intake] = await Promise.all([
        window.DB.getUserById(memberId),
        window.DB.getPlansByClient(memberId),
        window.DB.getWorkoutLogsByClient(memberId).catch(() => []),
        window.DB.getIntakeForm(memberId).catch(() => null),
      ]);
      this.member = member;
      this.plans  = plans || [];
      this.logs   = (logs || []).sort((a, b) => new Date(b.date) - new Date(a.date));
      this.intake = intake;
      this.activeTab = 'program';
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

    const intakeBadge = this.intake?.completed
      ? '<span style="font-size:11px;background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.25);border-radius:20px;padding:2px 8px">✓ Intake Done</span>'
      : '<span style="font-size:11px;background:rgba(245,158,11,.12);color:#fbbf24;border:1px solid rgba(245,158,11,.25);border-radius:20px;padding:2px 8px">⚠ Intake Pending</span>';

    const cards = this.plans.length
      ? await Promise.all(this.plans.map(p => window.renderPlanCard?.(p) || ''))
      : [];

    host.innerHTML = `
      <!-- Header strip -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="showPage('members')">← Back</button>
        <div class="member-avatar" style="width:48px;height:48px;font-size:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;background:linear-gradient(135deg,${grad1},${grad2})">${initials}</div>
        <div style="flex:1;min-width:160px">
          <div style="font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${c.name || 'Unknown'} ${intakeBadge}
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:3px">
            ${c.username ? '@' + c.username + ' · ' : ''}
            🔥 ${streak}d streak · ${daysSince === null ? 'no workouts yet' : daysSince === 0 ? 'active today' : `last workout ${daysSince}d ago`}
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="window.MessagingUI?.openChat(window.session?.id,'${c.id}','${(c.name || '').replace(/'/g, "\\'")}');showPage('messages')">💬 Message</button>
      </div>

      ${warnings.join('')}

      <!-- Tabs -->
      <div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:20px">
        <button class="mdd-tab ${this.activeTab === 'program' ? 'active' : ''}" onclick="window.coachMemberDetail._tab('program')">📋 Program</button>
        <button class="mdd-tab ${this.activeTab === 'nutrition' ? 'active' : ''}" onclick="window.coachMemberDetail._tab('nutrition')">🥗 Nutrition</button>
        <button class="mdd-tab ${this.activeTab === 'intake' ? 'active' : ''}" onclick="window.coachMemberDetail._tab('intake')">📝 Intake</button>
      </div>

      <!-- Program Tab -->
      <div id="mdd-tab-program" style="display:${this.activeTab === 'program' ? 'block' : 'none'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted)">Program</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-sm" onclick="window.coachMemberDetail._openLibrary()">📚 Browse Exercises</button>
            <button class="btn btn-primary btn-sm" onclick="openCreatePlanFor('${c.id}')">+ New Program</button>
          </div>
        </div>
        ${this.plans.length ? cards.join('') : `
          <div style="text-align:center;padding:40px 20px;background:var(--surface);border:1px dashed var(--border);border-radius:12px">
            <div style="font-size:36px;margin-bottom:12px">📋</div>
            <p style="color:var(--text-muted);font-size:14px">No programs assigned yet — click "+ New Program" above.</p>
          </div>`}
      </div>

      <!-- Nutrition Tab -->
      <div id="mdd-tab-nutrition" style="display:${this.activeTab === 'nutrition' ? 'block' : 'none'}">
        <div id="mdd-nutrition-host"></div>
      </div>

      <!-- Intake Tab -->
      <div id="mdd-tab-intake" style="display:${this.activeTab === 'intake' ? 'block' : 'none'}">
        ${this._renderIntakeTab()}
      </div>
    `;

    // Mount nutrition tab if active
    if (this.activeTab === 'nutrition') this._mountNutrition(c.id);
  }

  _tab(name) {
    this.activeTab = name;
    ['program', 'nutrition', 'intake'].forEach(t => {
      const el = document.getElementById('mdd-tab-' + t);
      if (el) el.style.display = t === name ? 'block' : 'none';
    });
    document.querySelectorAll('.mdd-tab').forEach((btn, i) => {
      const tabs = ['program', 'nutrition', 'intake'];
      btn.classList.toggle('active', tabs[i] === name);
    });
    if (name === 'nutrition') this._mountNutrition(this.member.id);
  }

  _mountNutrition(clientId) {
    const host = document.getElementById('mdd-nutrition-host');
    if (!host) return;
    host.innerHTML = '';
    const el = renderCoachNutritionTab(clientId);
    host.appendChild(el);
  }

  _openLibrary() {
    openLibraryModal((exercise) => {
      window.toast?.(`"${exercise.name}" copied — paste into a program`, 'info');
    });
  }

  _renderIntakeTab() {
    if (!this.intake?.completed) {
      return `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
        <div style="font-size:36px;margin-bottom:12px">📝</div>
        <p style="font-size:14px">Client hasn't completed the intake form yet.</p>
      </div>`;
    }
    const parq = this.intake.parq || {};
    const waiver = this.intake.waiver || {};
    const answers = parq.answers || {};
    const yesAnswers = Object.entries(answers).filter(([, v]) => v === 'yes');

    return `
      <div style="max-width:540px">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px;margin-bottom:14px">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px">PAR-Q Results</div>
          <div style="font-size:13px;margin-bottom:10px">
            Completed: <strong>${new Date(parq.completedAt || '').toLocaleDateString()}</strong>
            ${parq.anyYes ? ' · <span style="color:#fbbf24;font-weight:700">⚠ Yes answers present</span>' : ' · <span style="color:#10b981">✓ All clear</span>'}
          </div>
          ${yesAnswers.length ? `<div style="font-size:12px;color:#fbbf24;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:10px">
            Client answered "Yes" to: ${yesAnswers.map(([k]) => 'Q' + k.replace('q','')).join(', ')}
          </div>` : ''}
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:10px">Waiver</div>
          <div style="font-size:13px;color:var(--text-muted)">
            Signed by <strong style="color:var(--text)">${waiver.signatureName || '—'}</strong>
            on <strong style="color:var(--text)">${waiver.signedAt ? new Date(waiver.signedAt).toLocaleDateString() : '—'}</strong>
          </div>
        </div>
      </div>`;
  }
}
