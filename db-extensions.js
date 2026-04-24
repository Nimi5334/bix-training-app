/**
 * Database Extensions
 * Adds new methods needed by coach-members, preservation, tasks, billing,
 * client-program, client-analytics, client-billing, notifications, admin-testing
 *
 * These methods extend the existing DB object from db-firebase.js
 * Maps new API calls to existing methods where possible, provides stubs otherwise
 */

import { DB } from './db-firebase.js';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, addDoc, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const db = getFirestore();

/**
 * Coach Members
 */
DB.getCoachMembers = async function(coachId) {
  try {
    // Reuse existing method
    const clients = await DB.getClientsByCoach(coachId);

    // Enrich with activity data
    const enriched = await Promise.all(clients.map(async (c) => {
      const workoutLogs = await DB.getWorkoutLogsByClient(c.id).catch(() => []);
      const lastWorkout = workoutLogs.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      const streak = await DB.computeClientStreak(c.id).catch(() => 0);

      return {
        ...c,
        lastActive: c.lastActive || c.lastLoginAt || new Date(0).toISOString(),
        lastWorkoutDate: lastWorkout?.date || new Date(0).toISOString(),
        membershipExpiry: c.membershipExpiry || c.expiryDate || new Date(Date.now() + 30*86400*1000).toISOString(),
        workoutStreak: streak,
        recentWorkouts: workoutLogs.slice(-7),
        recentPowerRecords: c.powerRecords || []
      };
    }));

    return enriched;
  } catch (err) {
    console.error('getCoachMembers error:', err);
    return [];
  }
};

DB.updateMember = async function(memberId, patch) {
  return DB.updateUser(memberId, patch);
};

/**
 * Messaging Helpers
 */
DB.sendAutoMessage = async function(recipientId, text, category = 'auto') {
  try {
    const session = DB.getSession();
    if (!session) return null;

    const convId = await DB.getOrCreateConversation(session.id, recipientId);
    return await DB.sendMessage(convId, session.id, recipientId, text);
  } catch (err) {
    console.error('sendAutoMessage error:', err);
    return null;
  }
};

DB.sendGlobalMessage = async function(text, category = 'global') {
  try {
    const session = DB.getSession();
    if (!session) return null;

    // Add to global announcements collection
    return await addDoc(collection(db, 'globalMessages'), {
      text,
      category,
      senderId: session.id,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error('sendGlobalMessage error:', err);
    return null;
  }
};

/**
 * Tasks — Technique Checks & Payments
 */
DB.getPendingTechniqueChecks = async function(coachId) {
  try {
    // Reuse existing video reviews method
    const videos = await DB.getVideoReviewsByCoach(coachId);
    const pending = videos.filter(v => !v.feedback && !v.rating);

    // Enrich with client names
    return await Promise.all(pending.map(async (v) => {
      const client = await DB.getUserById(v.clientId).catch(() => null);
      return {
        id: v.id,
        clientId: v.clientId,
        clientName: client?.name || 'Unknown',
        exercise: v.exercise || 'Unknown Exercise',
        submittedAt: v.uploadedAt || v.createdAt || new Date()
      };
    }));
  } catch (err) {
    console.error('getPendingTechniqueChecks error:', err);
    return [];
  }
};

DB.submitTechniqueReview = async function(checkId, feedback, rating) {
  return DB.reviewFormVideo(checkId, feedback, rating);
};

DB.getPendingPayments = async function(coachId) {
  try {
    const snap = await getDocs(query(
      collection(db, 'paymentRequests'),
      where('coachId', '==', coachId),
      where('status', '==', 'pending')
    ));

    return await Promise.all(snap.docs.map(async (d) => {
      const data = d.data();
      const client = await DB.getUserById(data.clientId).catch(() => null);
      return {
        id: d.id,
        clientId: data.clientId,
        clientName: client?.name || 'Unknown',
        amount: data.amount || 29.99,
        createdAt: data.createdAt?.toDate?.() || new Date()
      };
    }));
  } catch (err) {
    console.error('getPendingPayments error:', err);
    return [];
  }
};

DB.acceptPayment = async function(paymentId) {
  try {
    await updateDoc(doc(db, 'paymentRequests', paymentId), {
      status: 'completed',
      processedAt: serverTimestamp()
    });
    return true;
  } catch (err) {
    console.error('acceptPayment error:', err);
    return false;
  }
};

DB.declinePayment = async function(paymentId) {
  try {
    await updateDoc(doc(db, 'paymentRequests', paymentId), {
      status: 'declined',
      processedAt: serverTimestamp()
    });
    return true;
  } catch (err) {
    console.error('declinePayment error:', err);
    return false;
  }
};

/**
 * Billing — Coach Side
 */
DB.getPendingRenewals = async function(coachId) {
  try {
    const members = await DB.getCoachMembers(coachId);
    const now = Date.now();

    return members
      .filter(m => {
        const expiry = new Date(m.membershipExpiry).getTime();
        const days = (expiry - now) / (1000 * 60 * 60 * 24);
        return days <= 7;
      })
      .map(m => ({
        clientId: m.id,
        clientName: m.name,
        expiryDate: m.membershipExpiry,
        amount: m.renewalAmount || 29.99
      }));
  } catch (err) {
    console.error('getPendingRenewals error:', err);
    return [];
  }
};

DB.getPaymentHistory = async function(coachId) {
  try {
    const snap = await getDocs(query(
      collection(db, 'paymentRequests'),
      where('coachId', '==', coachId),
      orderBy('processedAt', 'desc'),
      limit(50)
    ));

    return await Promise.all(snap.docs.map(async (d) => {
      const data = d.data();
      const client = await DB.getUserById(data.clientId).catch(() => null);
      return {
        id: d.id,
        clientName: client?.name || 'Unknown',
        amount: data.amount || 0,
        status: data.status || 'pending',
        date: data.processedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date()
      };
    }));
  } catch (err) {
    console.error('getPaymentHistory error:', err);
    return [];
  }
};

/**
 * Client Program
 */
DB.getClientProgram = async function(clientId) {
  try {
    const plans = await DB.getPlansByClient(clientId);
    const activePlan = plans.find(p => p.status === 'active') || plans[0];
    if (!activePlan) return null;

    return {
      ...activePlan,
      durationWeeks: activePlan.weeks || activePlan.durationWeeks || 5,
      weeks: activePlan.programData?.weeks || this.generateEmptyWeeks(activePlan.weeks || 5)
    };
  } catch (err) {
    console.error('getClientProgram error:', err);
    return null;
  }
};

DB.generateEmptyWeeks = function(count) {
  return Array.from({ length: count }, (_, i) => ({
    weekNumber: i + 1,
    days: []
  }));
};

/**
 * Client Analytics
 */
DB.getClientAnalytics = async function(clientId) {
  try {
    const weightHistory = await DB.getWeightHistoryByClient(clientId);
    const user = await DB.getUserById(clientId);

    return {
      weightHistory: weightHistory.map(w => ({
        weight: w.weightKg || w.weight,
        date: w.date || w.createdAt
      })),
      currentWeight: user?.currentWeight || weightHistory[weightHistory.length - 1]?.weightKg || 0,
      goal: {
        purpose: user?.goalPurpose || 'Maintaining weight',
        targetWeight: user?.goalWeight || 0
      }
    };
  } catch (err) {
    console.error('getClientAnalytics error:', err);
    return { weightHistory: [], currentWeight: 0, goal: {} };
  }
};

DB.updateClientGoal = async function(clientId, patch) {
  const updates = {};
  if (patch.purpose) updates.goalPurpose = patch.purpose;
  if (patch.targetWeight) updates.goalWeight = patch.targetWeight;
  return DB.updateUser(clientId, updates);
};

DB.addWeightRecord = async function(clientId, weight) {
  return DB.logWeight(clientId, weight);
};

/**
 * Client Billing
 */
DB.getClientBilling = async function(clientId) {
  try {
    const user = await DB.getUserById(clientId);
    const history = await DB.getTransactionsByMember(clientId);

    return {
      membership: {
        status: user?.membershipStatus || 'active',
        expiryDate: user?.membershipExpiry || new Date(Date.now() + 30*86400*1000).toISOString(),
        renewalAmount: user?.renewalAmount || 29.99
      },
      history: history.map(t => ({
        id: t.id,
        description: t.description || 'Membership Renewal',
        amount: t.amount || 0,
        status: t.status || 'completed',
        date: t.date || t.createdAt || new Date()
      }))
    };
  } catch (err) {
    console.error('getClientBilling error:', err);
    return { membership: {}, history: [] };
  }
};

/**
 * Notifications
 */
DB.saveNotification = async function(notification) {
  try {
    return await addDoc(collection(db, 'notifications'), {
      ...notification,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error('saveNotification error:', err);
    return null;
  }
};

DB.getUnreadNotifications = async function(userId) {
  try {
    const snap = await getDocs(query(
      collection(db, 'notifications'),
      where('targetUser', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(50)
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('getUnreadNotifications error:', err);
    return [];
  }
};

DB.markNotificationRead = async function(notificationId) {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      readAt: serverTimestamp()
    });
    return true;
  } catch (err) {
    console.error('markNotificationRead error:', err);
    return false;
  }
};

/**
 * Admin Testing Agents
 */
DB.getTestAgents = async function() {
  try {
    const snap = await getDocs(query(
      collection(db, 'users'),
      where('isTestAgent', '==', true)
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('getTestAgents error:', err);
    return [];
  }
};

DB.createTestAgent = async function(agent) {
  try {
    return await DB.addUser(agent);
  } catch (err) {
    console.error('createTestAgent error:', err);
    return null;
  }
};

DB.updateTestAgent = async function(id, patch) {
  return DB.updateUser(id, patch);
};

DB.deleteTestAgent = async function(id) {
  return DB.deleteUser(id);
};

DB.getBugReports = async function() {
  try {
    const snap = await getDocs(query(
      collection(db, 'bugReports'),
      orderBy('detectedAt', 'desc'),
      limit(100)
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('getBugReports error:', err);
    return [];
  }
};

DB.createBugReport = async function(bug) {
  try {
    return await addDoc(collection(db, 'bugReports'), {
      ...bug,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error('createBugReport error:', err);
    return null;
  }
};

DB.updateBugReport = async function(id, patch) {
  try {
    await updateDoc(doc(db, 'bugReports', id), patch);
    return true;
  } catch (err) {
    console.error('updateBugReport error:', err);
    return false;
  }
};

DB.getTestResults = async function() {
  try {
    const snap = await getDocs(query(
      collection(db, 'testResults'),
      orderBy('createdAt', 'desc'),
      limit(100)
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('getTestResults error:', err);
    return [];
  }
};

// Export the extended DB
export { DB };
