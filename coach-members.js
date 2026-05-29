/**
 * Coach Members Management
 * Displays members with status cards, member cards with activity badges,
 * and handles at-risk/expiring membership detection
 */

import { AT_RISK_RULES } from './at-risk.js';
import { draftSaveMessage } from './at-risk-templates.js';

export class CoachMembers {
  constructor() {
    this.members = [];
    this.currentFilter = 'all';
  }

  async init() {
    document.addEventListener('sessionReady', () => this.loadMembers());
    window.addEventListener('memberDataUpdated', () => this.loadMembers());
  }

  async loadMembers() {
    if (!window.session) return;
    try {
      this.members = await window.DB.getCoachMembers(window.session.id);
      this.updateStatusCards();
      this.renderMembers();
      this.checkAtRiskMembers();
      this.checkExpiringMemberships();
      await renderAtRiskWidget();
      await renderWeeklyLeaderboard(this.members);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  }

  updateStatusCards() {
    const active = this.members.filter(m => this.getStatus(m) === 'active').length;
    const atRisk = this.members.filter(m => this.getStatus(m) === 'at-risk').length;
    const expired = this.members.filter(m => this.getStatus(m) === 'expired').length;

    document.getElementById('status-active-count').textContent = active;
    document.getElementById('status-atrisk-count').textContent = atRisk;
    document.getElementById('status-expired-count').textContent = expired;
  }

  getStatus(member) {
    const now = new Date();
    const expiryDate = new Date(member.membershipExpiry);

    // Check if expired
    if (expiryDate < now) return 'expired';

    // Check if at-risk (offline 5+ days OR no workout data 3+ days)
    const lastActiveTime = new Date(member.lastActive || 0);
    const lastWorkoutTime = new Date(member.lastWorkoutDate || 0);
    const daysSinceActive = Math.floor((now - lastActiveTime) / (1000 * 60 * 60 * 24));
    const daysSinceWorkout = Math.floor((now - lastWorkoutTime) / (1000 * 60 * 60 * 24));

    if (daysSinceActive >= 5 || daysSinceWorkout >= 3) return 'at-risk';

    return 'active';
  }

  getActivityBadge(member, maxStreak) {
    const now = Date.now();
    const lastWorkout = new Date(member.lastWorkoutDate || 0).getTime();
    const daysSinceWorkout = Math.floor((now - lastWorkout) / 86400000);
    const expiry = new Date(member.membershipExpiry || 0).getTime();
    const daysUntilExpiry = Math.floor((expiry - now) / 86400000);
    const streak = member.workoutStreak || 0;
    const status = this.getStatus(member);

    if (status === 'expired' || (daysUntilExpiry <= 7 && daysUntilExpiry >= 0)) {
      return { badge: 'Renew', color: 'badge-renew' };
    }
    if (member.recentPowerRecords && member.recentPowerRecords.length > 0) {
      return { badge: 'New PR', color: 'badge-pr' };
    }
    if (status === 'at-risk') {
      const days = Math.max(daysSinceWorkout, 1);
      return { badge: `${days}d silent`, color: 'badge-silent' };
    }
    if (streak > 0 && streak === maxStreak && maxStreak >= 7) {
      return { badge: 'Best streak', color: 'badge-streak' };
    }
    if (streak >= 7) {
      return { badge: 'On fire', color: 'badge-on-fire' };
    }
    if (streak > 0) {
      return { badge: `${streak}d streak`, color: 'badge-streak' };
    }
    return { badge: '—', color: 'badge-silent' };
  }

  getAvatarGradient(uid) {
    const pairs = [
      ['#a78bfa', '#6d28d9'], // purple
      ['#5eead4', '#0d9488'], // teal
      ['#c084fc', '#6b21a8'], // magenta
      ['#60a5fa', '#1e40af'], // blue
      ['#fb7185', '#be123c'], // pink
    ];
    const key = String(uid || '');
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return pairs[hash % pairs.length];
  }

  renderMembers() {
    const container = document.getElementById('members-list-container');
    const filtered = this.currentFilter === 'all'
      ? this.members
      : this.members.filter(m => this.getStatus(m) === this.currentFilter);

    if (filtered.length === 0) {
      container.innerHTML = '';
      document.getElementById('no-members').style.display = 'block';
      return;
    }

    document.getElementById('no-members').style.display = 'none';

    const maxStreak = this.members.reduce((m, x) => Math.max(m, x.workoutStreak || 0), 0);
    const now = Date.now();

    container.innerHTML = filtered.map(member => {
      const status = this.getStatus(member);
      const { badge, color } = this.getActivityBadge(member, maxStreak);
      const [c1, c2] = this.getAvatarGradient(member.id);
      const name = member.name || '';
      const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
      const showWarning = status === 'at-risk' || status === 'expired';

      const lastWorkout = new Date(member.lastWorkoutDate || 0).getTime();
      const daysSinceWorkout = Math.floor((now - lastWorkout) / 86400000);
      const streak = member.workoutStreak || 0;
      const activityLine = streak > 0
        ? `🔥 ${streak}d streak`
        : (daysSinceWorkout > 365 ? '— no activity' : `— offline ${daysSinceWorkout}d`);

      return `
        <div class="member-card" onclick="openMemberDetail('${member.id}')">
          <div class="member-avatar" style="background:linear-gradient(135deg,${c1},${c2})">
            ${initials}
            ${showWarning ? '<span class="warning-overlay">!</span>' : ''}
          </div>
          <div class="member-info">
            <div class="member-name">${name}</div>
            <div class="member-activity"><span id="streak-${member.id}">${activityLine}</span></div>
          </div>
          <div class="member-badge ${color}">${badge}</div>
        </div>
      `;
    }).join('');
  }

  async checkAtRiskMembers() {
    const atRiskMembers = this.members.filter(m => this.getStatus(m) === 'at-risk');
    for (const member of atRiskMembers) {
      // Check if we already sent the message today
      const lastMessageSent = member.lastAtRiskNotification || 0;
      const daysSinceSent = Math.floor((Date.now() - new Date(lastMessageSent)) / (1000 * 60 * 60 * 24));

      if (daysSinceSent >= 1) {
        // Send auto-message to client
        await window.DB.sendAutoMessage(member.id, 'Hi, how are you doing?', 'at-risk-check');
        // Update notification timestamp
        await window.DB.updateMember(member.id, { lastAtRiskNotification: new Date() });
      }
    }
  }

  async checkExpiringMemberships() {
    const now = new Date();
    const expiringMembers = this.members.filter(m => {
      const expiryDate = new Date(m.membershipExpiry);
      const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
    });

    for (const member of expiringMembers) {
      // Check if we already sent the message today
      const lastMessageSent = member.lastExpiryNotification || 0;
      const daysSinceSent = Math.floor((Date.now() - new Date(lastMessageSent)) / (1000 * 60 * 60 * 24));

      if (daysSinceSent >= 1) {
        // Send auto-message to client
        const message = `Hi ${member.name}, your membership is about to expire, make sure to renew it!`;
        await window.DB.sendAutoMessage(member.id, message, 'expiry-reminder');
        // Update notification timestamp
        await window.DB.updateMember(member.id, { lastExpiryNotification: new Date() });
      }
    }
  }

  checkOvertaining() {
    const overtainingMembers = this.members.filter(m => {
      const recentWorkouts = (m.recentWorkouts || []).slice(-6);
      const hasHighRPE = recentWorkouts.some(w => w.avgRPE >= 9);
      const hasHighVolume = recentWorkouts.reduce((sum, w) => sum + (w.totalReps || 0), 0) > 100;
      return hasHighRPE && hasHighVolume && recentWorkouts.length >= 6;
    });

    overtainingMembers.forEach(member => {
      window.toast(`⚠️ ${member.name} is overtraining - high RPE and volume for 6+ days`, 'warning');
    });
  }
}

// ── AT-RISK WIDGET ──
async function renderAtRiskWidget() {
  const coachId = window.DB?.getSession?.()?.id;
  if (!coachId) return;

  const clients = await window.DB.getClientsByCoach(coachId);
  const atRisk = clients
    .filter(c => (c.atRiskScore || 0) >= 30)
    .sort((a, b) => (b.atRiskScore || 0) - (a.atRiskScore || 0));

  const root = document.getElementById('at-risk-list');
  const widget = document.getElementById('at-risk-widget');

  if (atRisk.length === 0) {
    widget.style.display = 'none';
    return;
  }

  widget.style.display = 'block';
  root.innerHTML = atRisk.map(c => `
    <div class="at-risk-row" style="padding:12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="flex:1">
        <strong style="display:block;margin-bottom:4px">${c.name}</strong>
        <span style="font-size:12px;color:var(--text-muted)">${(c.atRiskTriggered || []).map(t => AT_RISK_RULES.find(r => r.id === t)?.label).filter(Boolean).join(' · ')}</span>
      </div>
      <span style="font-weight:700;color:var(--primary)">${c.atRiskScore}%</span>
      <button class="btn btn-secondary save-action" data-client-id="${c.id}" style="font-size:12px;padding:6px 12px">Save</button>
    </div>
  `).join('');

  root.querySelectorAll('.save-action').forEach(btn => {
    btn.addEventListener('click', () => openSaveDialog(btn.dataset.clientId));
  });
}

async function openSaveDialog(clientId) {
  const tier = await window.DB?.getCoachTier?.(window.DB?.getSession?.()?.id);
  if (tier === 'free') {
    window.showUpgradeModal?.('save-the-client');
    return;
  }

  const client = await window.DB.getUserById(clientId);
  const draft = draftSaveMessage(client.atRiskTriggered || [], { clientName: client.name });

  const dialog = document.createElement('dialog');
  dialog.style.cssText = 'border:1px solid var(--border);border-radius:12px;padding:20px;max-width:500px;background:var(--bg);color:var(--text)';
  dialog.innerHTML = `
    <h3 style="margin-top:0">Save ${client.name}</h3>
    <textarea id="save-msg" rows="5" style="width:100%;padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;box-sizing:border-box">${draft}</textarea>
    <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
      <button id="save-cancel" style="padding:8px 16px;background:var(--surface);border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--text)">Cancel</button>
      <button id="save-send" style="padding:8px 16px;background:var(--primary);border:none;border-radius:6px;cursor:pointer;color:#fff;font-weight:600">Send</button>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.querySelector('#save-send').addEventListener('click', async () => {
    const msg = dialog.querySelector('#save-msg').value;
    await window.DB.sendMessage?.(window.DB.getSession().id, clientId, msg);
    dialog.close();
    dialog.remove();
    window.toast?.('Save message sent.', 'success');
  });
  dialog.querySelector('#save-cancel').addEventListener('click', () => {
    dialog.close();
    dialog.remove();
  });
}

// ── WEEKLY LEADERBOARD (Studio tier only) ──
async function renderWeeklyLeaderboard(members) {
  const section = document.getElementById('weekly-leaderboard');
  if (!section) return;

  const coachId = window.DB?.getSession?.()?.id;
  if (!coachId) return;

  const tier = await window.DB.getCoachTier(coachId);
  if (tier !== 'studio') { section.style.display = 'none'; return; }
  if (!members || members.length === 0) { section.style.display = 'none'; return; }

  const lastMonday = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const stats = members.map(m => {
    const thisWeek = (m.recentWorkouts || []).filter(w => (w.date || '') >= lastMonday);
    const volume   = thisWeek.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    const sessions = thisWeek.length;
    const prs      = (m.powerRecords || []).filter(p => (p.date || '') >= lastMonday).length;
    return { name: m.name || '—', volume, sessions, prs };
  });

  function topThree(arr, key) {
    return [...arr]
      .sort((a, b) => b[key] - a[key])
      .slice(0, 3)
      .filter(s => s[key] > 0);
  }

  function medal(i) { return ['🥇','🥈','🥉'][i] || ''; }

  function renderCategory(title, rows, unit) {
    if (rows.length === 0) return '';
    const items = rows.map((r, i) =>
      `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:18px;width:24px">${medal(i)}</span>
        <span style="flex:1;font-size:13px;font-weight:600">${r.name}</span>
        <span style="font-size:12px;color:var(--text-muted)">${unit === 'kg' ? r.volume.toFixed(0) + ' kg' : r[unit === 'sessions' ? 'sessions' : 'prs']}</span>
      </div>`
    ).join('');
    return `
      <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:var(--r-md);padding:14px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);margin-bottom:10px">${title}</div>
        ${items}
      </div>`;
  }

  const grid = document.getElementById('leaderboard-grid');
  grid.innerHTML = [
    renderCategory('Volume', topThree(stats, 'volume'), 'kg'),
    renderCategory('Sessions', topThree(stats, 'sessions'), 'sessions'),
    renderCategory('PRs', topThree(stats, 'prs'), 'prs'),
  ].join('');

  section.style.display = grid.innerHTML.trim() ? 'block' : 'none';
}

// Global functions for HTML onclick handlers
window.filterMembers = (filter) => {
  if (window.coachMembers) {
    window.coachMembers.currentFilter = filter;
    window.coachMembers.renderMembers();
    // Update button states
    document.querySelectorAll('#page-members [id^="filter-"]').forEach(btn => {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
    });
    document.getElementById(`filter-${filter}`).classList.remove('btn-secondary');
    document.getElementById(`filter-${filter}`).classList.add('btn-primary');
  }
};

// Initialize on load
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CoachMembers };
}
