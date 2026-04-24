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

  getActivityBadge(member) {
    const now = new Date();
    const lastWorkoutTime = new Date(member.lastWorkoutDate || 0);
    const daysSinceWorkout = Math.floor((now - lastWorkoutTime) / (1000 * 60 * 60 * 24));

    // Check for power records (this would be tracked in member data)
    if (member.recentPowerRecords && member.recentPowerRecords.length > 0) {
      return { badge: 'New PR', color: 'badge-pr' };
    }

    // Calculate streak
    if (member.workoutStreak) {
      if (member.workoutStreak >= 7) {
        return { badge: 'On fire', color: 'badge-on-fire' };
      }
      return { badge: `${member.workoutStreak}d streak`, color: 'badge-streak' };
    }

    // At-risk status
    if (this.getStatus(member) === 'at-risk') {
      return { badge: `${daysSinceWorkout}d silent`, color: 'badge-silent' };
    }

    // Check membership expiring
    const expiryDate = new Date(member.membershipExpiry);
    const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= 7) {
      return { badge: 'Renew', color: 'badge-renew' };
    }

    return { badge: 'Best streak', color: 'badge-streak' };
  }

  getAvatarColor(name) {
    const colors = ['#7c3aed', '#3498db', '#2ecc71', '#f59e0b', '#ef4444', '#06b6d4'];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
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
    container.innerHTML = filtered.map(member => {
      const status = this.getStatus(member);
      const { badge, color } = this.getAvatarColor(member.name);
      const { badge: activityBadge, color: badgeColor } = this.getActivityBadge(member);
      const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase();
      const shouldShowWarning = status === 'at-risk' || status === 'expired';

      return `
        <div class="member-card" onclick="openMemberDetail('${member.id}')">
          ${shouldShowWarning ? `<div class="warning-icon">⚠️</div>` : ''}
          <div class="member-avatar" style="background:${this.getAvatarColor(member.name)}">${initials}</div>
          <div class="member-info">
            <div class="member-name">${member.name}</div>
            <div class="member-activity">
              <span>🔥</span>
              <span id="streak-${member.id}">${member.workoutStreak || 0}d streak</span>
            </div>
          </div>
          <div class="member-badge ${badgeColor}">${activityBadge}</div>
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

window.openMemberDetail = async (memberId) => {
  if (!window.coachMembers) return;
  const member = window.coachMembers.members.find(m => m.id === memberId);
  if (!member) return;

  // TODO: Open member detail modal with program, status, warnings
  window.toast(`Opening ${member.name}'s details...`);
};

// Initialize on load
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CoachMembers };
}
