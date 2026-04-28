/**
 * Coach Members Management
 * Displays members with status cards, member cards with activity badges,
 * and handles at-risk/expiring membership detection
 */

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
