/**
 * Database Extensions
 * Adds new methods needed by coach-members, preservation, tasks, billing,
 * client-program, client-analytics, client-billing, notifications, admin-testing
 *
 * These methods extend the existing DB object from db-firebase.js
 * Maps new API calls to existing methods where possible, provides stubs otherwise
 */

import { DB } from './db-firebase.js';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, addDoc, serverTimestamp, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
 * Global Channel (per-coach group chat)
 * Doc: conversations/global_{coachId}
 */
DB.ensureGlobalChannel = async function(coachId) {
  const ref = doc(db, 'conversations', `global_${coachId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { coachId, type: 'global', participants: [coachId], createdAt: serverTimestamp(), lastMessage: '', lastMessageAt: null });
  }
  return `global_${coachId}`;
};

DB.postToGlobalChannel = async function(coachId, senderId, text) {
  try {
    const convId = `global_${coachId}`;
    const msgRef = doc(collection(db, 'conversations', convId, 'messages'));
    await setDoc(msgRef, { senderId, text, createdAt: serverTimestamp() });
    await updateDoc(doc(db, 'conversations', convId), { lastMessage: text, lastMessageAt: serverTimestamp() });
    return msgRef.id;
  } catch (err) {
    console.error('postToGlobalChannel error:', err);
    return null;
  }
};

DB.subscribeToGlobalChannel = function(coachId, callback) {
  const q = query(
    collection(db, 'conversations', `global_${coachId}`, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString() })));
  });
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
    const snap = await getDoc(doc(db, 'paymentRequests', paymentId));
    if (!snap.exists()) throw new Error('Payment not found');
    const data = snap.data();

    // Capture PayPal order if orderId present
    if (data.orderId) {
      const res = await fetch('/.netlify/functions/capture-paypal-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID: data.orderId })
      });
      if (!res.ok) throw new Error('PayPal capture failed');
    }

    // Activate membership — extend from today or current expiry
    const client = await DB.getUserById(data.clientId);
    const base = client?.membershipExpiry && new Date(client.membershipExpiry) > new Date()
      ? new Date(client.membershipExpiry) : new Date();
    base.setMonth(base.getMonth() + (data.months || 1));

    await updateDoc(doc(db, 'users', data.clientId), {
      membershipStatus: 'active',
      membershipExpiry: base.toISOString().split('T')[0]
    });

    await updateDoc(doc(db, 'paymentRequests', paymentId), {
      status: 'completed',
      processedAt: serverTimestamp()
    });

    // Fire webhook (non-blocking)
    DB.fireWebhook('payment.received', { clientId: data.clientId, amount: data.amount, coachId: data.coachId });

    return true;
  } catch (err) {
    console.error('acceptPayment error:', err);
    return false;
  }
};

DB.declinePayment = async function(paymentId) {
  try {
    const snap = await getDoc(doc(db, 'paymentRequests', paymentId));
    const data = snap.exists() ? snap.data() : {};

    await updateDoc(doc(db, 'paymentRequests', paymentId), {
      status: 'declined',
      processedAt: serverTimestamp()
    });

    // Polite decline message to client
    if (data.clientId) {
      const session = DB.getSession();
      await DB.sendAutoMessage(data.clientId,
        'Hi, your renewal request could not be processed at this time. Please contact your coach.',
        'payment-declined');
    }
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

/**
 * Intake Forms (PAR-Q + waiver)
 */
DB.getIntakeForm = async function(userId) {
  try {
    const snap = await getDoc(doc(db, 'intakeForms', userId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.error('getIntakeForm error:', err);
    return null;
  }
};

DB.saveIntakeForm = async function(userId, data) {
  try {
    await setDoc(doc(db, 'intakeForms', userId), { ...data, savedAt: serverTimestamp() });
    return true;
  } catch (err) {
    console.error('saveIntakeForm error:', err);
    throw err;
  }
};

/**
 * Nutrition / Macro Tracking
 */
DB.getMacroTargets = async function(clientId) {
  try {
    const snap = await getDoc(doc(db, 'macroTargets', clientId));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('getMacroTargets error:', err);
    return null;
  }
};

DB.saveMacroTargets = async function(clientId, targets) {
  try {
    await setDoc(doc(db, 'macroTargets', clientId), { ...targets, updatedAt: serverTimestamp() });
    return true;
  } catch (err) {
    console.error('saveMacroTargets error:', err);
    throw err;
  }
};

DB.getNutritionLog = async function(clientId, date) {
  try {
    const snap = await getDoc(doc(db, 'nutritionLogs', clientId, 'daily', date));
    return snap.exists() ? snap.data() : { date, meals: [], totals: { protein: 0, carbs: 0, fats: 0, calories: 0 } };
  } catch (err) {
    console.error('getNutritionLog error:', err);
    return null;
  }
};

DB.logNutrition = async function(clientId, date, meals) {
  try {
    const totals = meals.reduce((acc, m) => ({
      protein:  acc.protein  + (m.protein  || 0),
      carbs:    acc.carbs    + (m.carbs    || 0),
      fats:     acc.fats     + (m.fats     || 0),
      calories: acc.calories + (m.calories || 0),
    }), { protein: 0, carbs: 0, fats: 0, calories: 0 });

    const data = { date, meals, totals, updatedAt: serverTimestamp() };
    await setDoc(doc(db, 'nutritionLogs', clientId, 'daily', date), data);
    return data;
  } catch (err) {
    console.error('logNutrition error:', err);
    throw err;
  }
};

DB.getNutritionLogs = async function(clientId, days = 7) {
  try {
    const results = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const snap = await getDoc(doc(db, 'nutritionLogs', clientId, 'daily', dateStr));
      if (snap.exists()) results.push({ date: dateStr, ...snap.data() });
    }
    return results.reverse();
  } catch (err) {
    console.error('getNutritionLogs error:', err);
    return [];
  }
};

/**
 * Group Classes
 */
DB.createClass = async function(classData) {
  try {
    const ref = doc(collection(db, 'classes'));
    const data = { id: ref.id, ...classData, createdAt: serverTimestamp() };
    await setDoc(ref, data);
    return ref.id;
  } catch (err) {
    console.error('createClass error:', err);
    throw err;
  }
};

DB.getClassesByCoach = async function(coachId) {
  try {
    const snap = await getDocs(query(collection(db, 'classes'), where('coachId', '==', coachId)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('getClassesByCoach error:', err);
    return [];
  }
};

DB.getUpcomingClassesForClient = async function(clientSession) {
  try {
    const coachId = clientSession.coachId;
    if (!coachId) return [];
    const snap = await getDocs(query(
      collection(db, 'classes'),
      where('coachId', '==', coachId),
      where('status', '!=', 'cancelled')
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('getUpcomingClassesForClient error:', err);
    return [];
  }
};

DB.bookClass = async function(classId, userId) {
  try {
    const ref = doc(db, 'classes', classId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Class not found');
    const data = snap.data();
    const bookings = data.bookings || [];
    if (bookings.includes(userId)) return true; // already booked
    if (bookings.length >= (data.capacity || 10)) throw new Error('Class is full');
    const updated = [...bookings, userId];
    await updateDoc(ref, {
      bookings: updated,
      status: updated.length >= (data.capacity || 10) ? 'full' : 'open',
    });
    return true;
  } catch (err) {
    console.error('bookClass error:', err);
    throw err;
  }
};

DB.cancelBooking = async function(classId, userId) {
  try {
    const ref = doc(db, 'classes', classId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const updated = (data.bookings || []).filter(id => id !== userId);
    await updateDoc(ref, {
      bookings: updated,
      status: updated.length >= (data.capacity || 10) ? 'full' : 'open',
    });
  } catch (err) {
    console.error('cancelBooking error:', err);
    throw err;
  }
};

DB.cancelClass = async function(classId) {
  try {
    await updateDoc(doc(db, 'classes', classId), { status: 'cancelled' });
  } catch (err) {
    console.error('cancelClass error:', err);
    throw err;
  }
};

/**
 * Webhooks — fire outbound event to coach's configured URL
 */
DB.fireWebhook = async function(eventName, payload) {
  try {
    const session = DB.getSession();
    const coachId = window.session?.role === 'coach' ? window.session?.id
      : window.session?.coachId || null;

    fetch('/.netlify/functions/fire-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: eventName, payload, coachId }),
    }).catch(() => {}); // fire-and-forget
  } catch (err) {
    // Never block on webhook failures
    console.warn('fireWebhook error:', err);
  }
};

// Export the extended DB
export { DB };
