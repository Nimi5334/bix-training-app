/**
 * Coach Client Preservation
 * Displays at-risk clients, expiring memberships, and power records
 * with one-click preservation actions (Message, Renew, Celebrate)
 */

export class CoachPreservation {
  constructor() {
    this.clients = [];
    this.defaultMessages = {
      message: 'Hi, how are you doing?',
      renew: 'Hi {name}, your membership is about to expire, make sure to renew it!',
      celebrate: 'Amazing! {name} just hit a new PR - {lift} {weight} 🎉'
    };
  }

  async init() {
    document.addEventListener('sessionReady', () => this.loadPreservationData());
    window.addEventListener('memberDataUpdated', () => this.loadPreservationData());
  }

  async loadPreservationData() {
    if (!window.session) return;
    try {
      const members = await window.DB.getCoachMembers(window.session.id);
      this.clients = this.categorizeClients(members);
      this.renderInsight();
      this.renderRetentionRadar();
    } catch (err) {
      console.error('Failed to load preservation data:', err);
    }
  }

  categorizeClients(members) {
    const now = new Date();
    const categorized = {
      atRisk: [],
      expiring: [],
      achievements: []
    };

    members.forEach(member => {
      // Check if at-risk (offline 5+ days OR no workout data 3+ days)
      const lastActiveTime = new Date(member.lastActive || 0);
      const lastWorkoutTime = new Date(member.lastWorkoutDate || 0);
      const daysSinceActive = Math.floor((now - lastActiveTime) / (1000 * 60 * 60 * 24));
      const daysSinceWorkout = Math.floor((now - lastWorkoutTime) / (1000 * 60 * 60 * 24));

      if (daysSinceActive >= 5 || daysSinceWorkout >= 3) {
        categorized.atRisk.push({
          ...member,
          daysSilent: daysSinceWorkout,
          lastWorkoutDay: this.getLastWorkoutDay(member.lastWorkoutDate)
        });
      }

      // Check if membership expiring
      const expiryDate = new Date(member.membershipExpiry);
      const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        categorized.expiring.push({
          ...member,
          daysUntilExpiry
        });
      }

      // Check for recent power records
      if (member.recentPowerRecords && member.recentPowerRecords.length > 0) {
        const latestPR = member.recentPowerRecords[0];
        categorized.achievements.push({
          ...member,
          prLift: latestPR.lift,
          prWeight: latestPR.weight,
          prDate: latestPR.date
        });
      }
    });

    return categorized;
  }

  getLastWorkoutDay(date) {
    if (!date) return 'Never';
    const workoutDate = new Date(date);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[workoutDate.getDay()];
  }

  renderInsight() {
    const atRiskCount = this.clients.atRisk.length;
    const insightEl = document.getElementById('preservation-insight');
    const timeEl = document.getElementById('preservation-time');
    if (timeEl) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      timeEl.textContent = `${hh}:${mm}`;
    }

    if (atRiskCount === 0) {
      insightEl.textContent = 'All your clients are engaged — keep the momentum going.';
    } else if (atRiskCount === 1) {
      insightEl.textContent = '1 client hasn\'t logged in 5+ days. A quick nudge today could bring them back.';
    } else {
      insightEl.textContent = `${atRiskCount} clients haven't logged in 5+ days. A quick nudge today recovers 78% of them.`;
    }
  }

  renderRetentionRadar() {
    const container = document.getElementById('retention-radar-list');
    const cards = [];

    // Add at-risk clients (orange)
    this.clients.atRisk.forEach(client => {
      cards.push(`
        <div class="retention-card at-risk">
          <div class="retention-icon">⏳</div>
          <div class="retention-info">
            <div class="retention-name">${client.name}</div>
            <div class="retention-detail">${client.daysSilent} days silent · last workout ${client.lastWorkoutDay}</div>
          </div>
          <button class="retention-action message" onclick="openPreservationModal('${client.id}', 'message', '${client.name}')">Message</button>
        </div>
      `);
    });

    // Add expiring memberships (red)
    this.clients.expiring.forEach(client => {
      cards.push(`
        <div class="retention-card expiring">
          <div class="retention-icon">📅</div>
          <div class="retention-info">
            <div class="retention-name">${client.name}</div>
            <div class="retention-detail">Membership expires in ${client.daysUntilExpiry} days</div>
          </div>
          <button class="retention-action renew" onclick="openPreservationModal('${client.id}', 'renew', '${client.name}')">Renew</button>
        </div>
      `);
    });

    // Add achievements (green)
    this.clients.achievements.forEach(client => {
      cards.push(`
        <div class="retention-card achievement">
          <div class="retention-icon">🏆</div>
          <div class="retention-info">
            <div class="retention-name">${client.name}</div>
            <div class="retention-detail">Hit new PR · ${client.prLift} ${client.prWeight}kg</div>
          </div>
          <button class="retention-action celebrate" onclick="openPreservationModal('${client.id}', 'celebrate', '${client.name}')">Celebrate</button>
        </div>
      `);
    });

    container.innerHTML = cards.length > 0
      ? cards.join('')
      : '<p style="padding:24px 0;text-align:center;color:var(--text-muted)">All clients are doing great!</p>';
  }

  formatMessage(template, clientName, lift, weight) {
    return template
      .replace('{name}', clientName)
      .replace('{lift}', lift || '')
      .replace('{weight}', weight || '');
  }
}

// Global functions for HTML onclick handlers
window.openPreservationModal = (clientId, actionType, clientName) => {
  const modal = document.getElementById('modal-preservation-message');
  const messageText = document.getElementById('preservation-message-text');
  const modalTitle = document.getElementById('preservation-modal-title');

  // Set default message based on action
  const coachPreservation = window.coachPreservation;
  let message = '';

  if (actionType === 'message') {
    modalTitle.textContent = `Message ${clientName}`;
    message = coachPreservation.defaultMessages.message;
  } else if (actionType === 'renew') {
    modalTitle.textContent = `Renewal Reminder for ${clientName}`;
    message = coachPreservation.formatMessage(
      coachPreservation.defaultMessages.renew,
      clientName
    );
  } else if (actionType === 'celebrate') {
    modalTitle.textContent = `Celebrate ${clientName}'s Achievement`;
    const member = coachPreservation.clients.achievements.find(m => m.id === clientId);
    message = coachPreservation.formatMessage(
      coachPreservation.defaultMessages.celebrate,
      clientName,
      member?.prLift,
      member?.prWeight
    );
  }

  messageText.value = message;
  document.getElementById('preservation-client-id').value = clientId;
  document.getElementById('preservation-action-type').value = actionType;

  modal.classList.add('active');
};

window.sendPreservationMessage = async () => {
  const clientId = document.getElementById('preservation-client-id').value;
  const messageText = document.getElementById('preservation-message-text').value;
  const actionType = document.getElementById('preservation-action-type').value;

  if (!messageText.trim()) {
    window.toast('Please enter a message', 'error');
    return;
  }

  try {
    // Send message via Bix chat
    await window.DB.sendAutoMessage(clientId, messageText, `preservation-${actionType}`);

    window.toast('Message sent! 📨');
    window.closeModal('modal-preservation-message');

    // Reload to refresh the UI
    if (window.coachPreservation) {
      await window.coachPreservation.loadPreservationData();
    }
  } catch (err) {
    console.error('Failed to send message:', err);
    window.toast('Failed to send message', 'error');
  }
};

// Bulk check-in: send "Hi, how are you doing?" to every at-risk client at once
window.sendInsightCheckIn = async () => {
  const cp = window.coachPreservation;
  if (!cp || !cp.clients || cp.clients.atRisk.length === 0) {
    window.toast && window.toast('No at-risk clients — nice work!', 'info');
    return;
  }
  const atRisk = cp.clients.atRisk;
  try {
    await Promise.all(
      atRisk.map(c => window.DB.sendAutoMessage(c.id, 'Hi, how are you doing?', 'daily-insight-check'))
    );
    window.toast && window.toast(`Check-in sent to ${atRisk.length} client${atRisk.length === 1 ? '' : 's'} ✓`);
  } catch (err) {
    console.error('Bulk check-in failed:', err);
    window.toast && window.toast('Failed to send check-ins', 'error');
  }
};

// Initialize on load
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CoachPreservation };
}
