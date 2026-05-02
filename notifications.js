/**
 * Centralized Notifications System
 * Handles push notifications and in-app notifications for all triggers
 */

export class Notifications {
  constructor() {
    this.pushPermission = 'default';
    this.queue = [];
  }

  async init() {
    // Request push notification permission
    if ('Notification' in window) {
      this.pushPermission = Notification.permission;
      if (this.pushPermission === 'default') {
        await this.requestPermission();
      }
    }

    // Start periodic check for triggers
    this.startTriggerChecks();
  }

  async requestPermission() {
    try {
      this.pushPermission = await Notification.requestPermission();
    } catch (err) {
      console.error('Notification permission error:', err);
    }
  }

  startTriggerChecks() {
    // Run checks every 5 minutes
    setInterval(() => this.runAllChecks(), 5 * 60 * 1000);
    // Initial check
    setTimeout(() => this.runAllChecks(), 3000);
  }

  async runAllChecks() {
    if (!window.session) return;

    if (window.session.role === 'coach') {
      await this.checkCoachTriggers();
    } else if (window.session.role === 'client') {
      await this.checkClientTriggers();
    }
  }

  /**
   * COACH TRIGGERS
   */
  async checkCoachTriggers() {
    try {
      const members = await window.DB.getCoachMembers(window.session.id);

      for (const member of members) {
        // 1. Overtraining check
        await this.checkOvertraining(member);

        // 2. At-risk check
        await this.checkAtRisk(member);

        // 3. Expiring membership
        await this.checkExpiringMembership(member);

        // 4. New technique check submission
        // Handled by real-time listener in task module
      }
    } catch (err) {
      console.error('Coach trigger check error:', err);
    }
  }

  async checkOvertraining(member) {
    const recentWorkouts = (member.recentWorkouts || []).slice(-6);
    if (recentWorkouts.length < 6) return;

    const allHighRPE = recentWorkouts.every(w => (w.avgRPE || 0) >= 9);
    const totalVolume = recentWorkouts.reduce((sum, w) => sum + (w.totalReps || 0), 0);
    const highVolume = totalVolume > 600; // 100 reps/day avg

    if (allHighRPE && highVolume) {
      // Check if we already notified recently
      const lastNotified = member.lastOvertainingNotification || 0;
      const daysSince = (Date.now() - new Date(lastNotified).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince >= 2) {
        this.send({
          title: '⚠️ Overtraining Alert',
          message: `${member.name} is overtraining - high RPE (9-10) and volume for 6+ days`,
          type: 'warning',
          category: 'overtraining',
          targetUser: window.session.id
        });

        await window.DB.updateMember(member.id, {
          lastOvertainingNotification: new Date()
        });
      }
    }
  }

  async checkAtRisk(member) {
    const now = Date.now();
    const lastActive = new Date(member.lastActive || 0).getTime();
    const lastWorkout = new Date(member.lastWorkoutDate || 0).getTime();
    const daysSinceActive = (now - lastActive) / (1000 * 60 * 60 * 24);
    const daysSinceWorkout = (now - lastWorkout) / (1000 * 60 * 60 * 24);

    const isAtRisk = daysSinceActive >= 5 || daysSinceWorkout >= 3;

    if (isAtRisk) {
      const lastNotified = member.lastAtRiskNotification || 0;
      const daysSince = (now - new Date(lastNotified).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince >= 1) {
        // Notify coach (in-app only — actual auto-message is sent server-side by at-risk-check.js)
        this.send({
          title: '🚨 Client At-Risk',
          message: `${member.name} is at-risk - offline 5+ days or no workout data 3+ days`,
          type: 'warning',
          category: 'at-risk',
          targetUser: window.session.id
        });

        await window.DB.updateMember(member.id, {
          lastAtRiskNotification: new Date()
        });
      }
    }
  }

  async checkExpiringMembership(member) {
    const now = Date.now();
    const expiryDate = new Date(member.membershipExpiry).getTime();
    const daysUntilExpiry = (expiryDate - now) / (1000 * 60 * 60 * 24);

    if (daysUntilExpiry > 0 && daysUntilExpiry <= 7) {
      const lastNotified = member.lastExpiryNotification || 0;
      const daysSince = (now - new Date(lastNotified).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince >= 1) {
        // Notify coach
        this.send({
          title: '📅 Membership Expiring',
          message: `${member.name}'s membership expires in ${Math.ceil(daysUntilExpiry)} days`,
          type: 'info',
          category: 'expiring',
          targetUser: window.session.id
        });

        // Send auto-message to client in chat
        const message = `Hi ${member.name}, your membership is about to expire, make sure to renew it!`;
        await window.DB.sendAutoMessage(member.id, message, 'expiry-reminder');

        await window.DB.updateMember(member.id, {
          lastExpiryNotification: new Date()
        });
      }
    }
  }

  /**
   * CLIENT TRIGGERS
   */
  async checkClientTriggers() {
    try {
      // Monthly weight update reminder
      await this.checkMonthlyWeightReminder();

      // Power record check (new PR announcement)
      // Handled by workout completion flow

      // Goal reached check
      await this.checkGoalReached();
    } catch (err) {
      console.error('Client trigger check error:', err);
    }
  }

  async checkMonthlyWeightReminder() {
    const now = Date.now();
    const lastWeightUpdate = new Date(window.session.lastWeightUpdate || 0).getTime();
    const daysSinceUpdate = (now - lastWeightUpdate) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate >= 30) {
      const lastReminder = window.session.lastWeightReminder || 0;
      const daysSinceReminder = (now - new Date(lastReminder).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceReminder >= 7) {
        this.send({
          title: '⚖️ Time to Weigh In',
          message: 'Time to update your weight for progress tracking',
          type: 'info',
          category: 'weight-reminder',
          targetUser: window.session.id
        });

        await window.DB.updateUser(window.session.id, {
          lastWeightReminder: new Date()
        });
      }
    }
  }

  async checkGoalReached() {
    const currentWeight = window.session.currentWeight;
    const goalWeight = window.session.goalWeight;
    const goalPurpose = window.session.goalPurpose;

    if (!currentWeight || !goalWeight || window.session.goalReached) return;

    let goalReached = false;

    if (goalPurpose === 'Losing weight' && currentWeight <= goalWeight) {
      goalReached = true;
    } else if (goalPurpose === 'Gaining weight' && currentWeight >= goalWeight) {
      goalReached = true;
    } else if (goalPurpose === 'Maintaining weight' && Math.abs(currentWeight - goalWeight) <= 1) {
      goalReached = true;
    }

    if (goalReached) {
      // Announce in global chat
      const message = `🎉 ${window.session.name} reached their weight goal! Amazing work!`;
      await window.DB.sendGlobalMessage(message, 'goal-reached');

      // Notify coach
      if (window.session.coachId) {
        this.send({
          title: '🎯 Goal Reached!',
          message: `${window.session.name} reached their weight goal`,
          type: 'success',
          category: 'goal-reached',
          targetUser: window.session.coachId
        });
      }

      // Mark goal as reached
      await window.DB.updateUser(window.session.id, { goalReached: true });

      // Notify client
      this.send({
        title: '🎉 Goal Reached!',
        message: 'Congratulations on reaching your weight goal!',
        type: 'success',
        category: 'goal-reached',
        targetUser: window.session.id
      });
    }
  }

  /**
   * POWER RECORD (GLOBAL)
   */
  async announcePowerRecord(clientName, lift, weight) {
    const message = `🏆 ${clientName} just hit a new PR - ${lift} ${weight}kg! 🎉`;
    await window.DB.sendGlobalMessage(message, 'power-record');

    // Also notify client
    this.send({
      title: '🏆 New PR!',
      message: `Incredible! ${lift} ${weight}kg is a new personal record!`,
      type: 'success',
      category: 'pr'
    });
  }

  /**
   * TASK COMPLETED (CLIENT)
   */
  async notifyTaskCompleted(clientId, taskType, feedback) {
    const message = taskType === 'technique'
      ? `Coach feedback on your technique: ${feedback}`
      : 'Your coach has reviewed your task';

    this.send({
      title: '📝 Coach Feedback',
      message,
      type: 'info',
      category: 'task-complete',
      targetUser: clientId
    });
  }

  /**
   * NEW TECHNIQUE CHECK (COACH)
   */
  async notifyNewTechniqueCheck(coachId, clientName, exercise) {
    this.send({
      title: '🎥 New Form Review',
      message: `${clientName} submitted a video for ${exercise}`,
      type: 'info',
      category: 'new-technique',
      targetUser: coachId
    });
  }

  /**
   * Send notification (both push + in-app)
   */
  send(notification) {
    // In-app notification via toast
    if (window.toast) {
      window.toast(notification.message, notification.type || 'info');
    }

    // Push notification
    if (this.pushPermission === 'granted' && 'Notification' in window) {
      try {
        const pushNotif = new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.category,
          requireInteraction: notification.type === 'warning'
        });

        pushNotif.onclick = () => {
          window.focus();
          pushNotif.close();
        };
      } catch (err) {
        console.error('Push notification error:', err);
      }
    }

    // Store in queue for UI display
    this.queue.push({
      ...notification,
      timestamp: new Date(),
      read: false
    });

    // Persist to DB if we have session
    if (window.session && notification.targetUser) {
      window.DB.saveNotification(notification).catch(console.error);
    }
  }

  /**
   * Get unread notifications
   */
  async getUnread() {
    if (!window.session) return [];
    try {
      return await window.DB.getUnreadNotifications(window.session.id);
    } catch (err) {
      return this.queue.filter(n => !n.read);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    try {
      await window.DB.markNotificationRead(notificationId);
    } catch (err) {
      const notif = this.queue.find(n => n.id === notificationId);
      if (notif) notif.read = true;
    }
  }
}

// Initialize
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Notifications };
}
