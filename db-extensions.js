/**
 * Database Extensions
 * Adds new methods needed by coach-members, preservation, tasks, billing,
 * client-program, client-analytics, client-billing, notifications, admin-testing
 *
 * These methods extend the existing DB object from db-firebase.js
 * Maps new API calls to existing methods where possible, provides stubs otherwise
 */

import { DB, auth } from './db-firebase.js';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, addDoc, serverTimestamp, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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

// ── COACH BRAND (white-label) ──
import { mergeCoachBrand } from './coach-brand.js';

DB.getCoachBrand = async function(coachId) {
  const coach = await DB.getUserById(coachId);
  return mergeCoachBrand(coach?.coachBrand);
};

DB.setCoachBrand = async function(coachId, brand) {
  await DB.updateUser(coachId, { coachBrand: brand });
};

// ── COACH TIER (free / pro / studio) ──
DB.getCoachTier = async function(coachId) {
  const coach = await DB.getUserById(coachId);
  if (!coach) return 'free';
  // Trial check: if trialEndsAt has passed and tier is still pro without paid flag, downgrade view
  if (coach.tier === 'pro' && coach.trialEndsAt) {
    const trialEnd = new Date(coach.trialEndsAt);
    if (trialEnd < new Date() && !coach.paidPro) {
      return 'free';
    }
  }
  const tier = coach.tier || 'free';
  // Studio is now Pro — silently upgrade existing coaches
  return tier === 'studio' ? 'pro' : tier;
};

DB.setCoachTier = async function(coachId, tier) {
  const validTier = tier === 'studio' ? 'pro' : tier;
  await DB.updateUser(coachId, { tier: validTier, paidPro: validTier === 'pro' });
};

// ── PRODUCTION SAFEGUARD: v1 feature gate ──
// Returns true only if the coach has explicitly opted into the v1 build.
// Every v1 client-facing feature (white-label header, at-risk surfaces, save flow,
// 30-day trial countdown, new onboarding) MUST check this before rendering or writing.
DB.isV1Enabled = async function(coachId) {
  if (!coachId) return false;
  const coach = await DB.getUserById(coachId);
  return !!(coach && coach.v1Enabled === true);
};

// For client-side checks where we already have the user object:
DB.isV1EnabledFor = function(coach) {
  return !!(coach && coach.v1Enabled === true);
};

// ── COACH INVITE SLUGS ──
DB.createInviteSlug = async function(coachId, clientName) {
  const slugBase = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slug = `${slugBase}-${Date.now().toString(36)}`;
  await setDoc(doc(db, 'invites', slug), {
    coachId,
    clientName,
    createdAt: serverTimestamp(),
    consumed: false
  });
  return slug;
};

DB.getCoachIdByInviteSlug = async function(slug) {
  const snap = await getDoc(doc(db, 'invites', slug));
  if (!snap.exists()) return null;
  return snap.data().coachId;
};

DB.consumeInvite = async function(slug, clientUserId) {
  await updateDoc(doc(db, 'invites', slug), {
    consumed: true,
    consumedBy: clientUserId,
    consumedAt: serverTimestamp()
  });
};

// ── AT-RISK SIGNAL HELPERS ──
DB.getWorkoutsByClient = async function(clientId) {
  try {
    const q = query(collection(db, 'workouts'), where('clientId', '==', clientId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
};

DB.getMessagesByClient = async function(clientId) {
  try {
    const q = query(collection(db, 'messages'), where('fromId', '==', clientId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
};

DB.getAppSessionsByClient = async function(clientId) {
  try {
    const q = query(collection(db, 'sessions'), where('clientId', '==', clientId), orderBy('openedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
};

// ── ONBOARDING HELPERS ──
DB.signUp = async function(email, password, profile) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const newUser = { id: cred.user.uid, email, ...profile };
  await DB.addUser(newUser);
  return newUser;
};

DB.sendPasswordResetEmail = async function(email) {
  await sendPasswordResetEmail(auth, email);
};

DB.createDemoClient = async function(coachId) {
  const fakeId = 'demo-' + Math.random().toString(36).slice(2, 10);
  await DB.addUser({
    id: fakeId,
    name: 'Demo Sarah',
    role: 'client',
    coachId,
    isDemo: true,
    email: `${fakeId}@demo.bix`
  });
};

DB.setCoachStarterProgramChoice = async function(coachId, programId) {
  await DB.updateUser(coachId, { starterProgramChoice: programId });
};

// ── SMART PUSH TIMING ──
// Record workout start timestamp per client per day-of-week.
// A daily Cloud Function reads this to compute each client's optimal push time.
DB.recordWorkoutStart = async function(clientId) {
  try {
    const now = new Date();
    await addDoc(collection(db, 'workoutStartTimes'), {
      clientId,
      dayOfWeek: now.getDay(),           // 0=Sun … 6=Sat
      hour:      now.getHours(),
      minute:    now.getMinutes(),
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    // Non-blocking — never surface this error to the client
    console.warn('recordWorkoutStart error:', err);
  }
};

// ── AI PROGRAM DRAFTS ──

DB.saveProgramDraft = async function(draft) {
  const id = draft.id || `draft_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  await setDoc(doc(db, 'programDrafts', id), { ...draft, id, updatedAt: serverTimestamp() });
  return id;
};

DB.getProgramDraft = async function(draftId) {
  const snap = await getDoc(doc(db, 'programDrafts', draftId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

DB.getPendingDraftsForCoach = async function(coachId) {
  const q = query(
    collection(db, 'programDrafts'),
    where('coachId', '==', coachId),
    where('status', '==', 'pending_review'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

DB.updateDraftStatus = async function(draftId, status, edits) {
  const patch = { status, updatedAt: serverTimestamp() };
  if (edits) patch.coachEdits = edits;
  await updateDoc(doc(db, 'programDrafts', draftId), patch);
};

// ── COACH EDIT HISTORY (for style learning) ──

DB.recordCoachEdit = async function(coachId, original, edited, context) {
  await addDoc(collection(db, 'coachEditHistory'), {
    coachId, original, edited, context,
    createdAt: serverTimestamp()
  });
};

DB.getCoachEditHistory = async function(coachId, limitN = 50) {
  const q = query(
    collection(db, 'coachEditHistory'),
    where('coachId', '==', coachId),
    orderBy('createdAt', 'desc'),
    limit(limitN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

DB.getCoachStyleFingerprint = async function(coachId) {
  const history = await DB.getCoachEditHistory(coachId, 100);
  if (history.length < 20) return { confidence: history.length / 20, patterns: [] };

  const subs = {};
  history.forEach(edit => {
    const key = `${edit.original?.exercise}→${edit.edited?.exercise}`;
    if (edit.original?.exercise !== edit.edited?.exercise) {
      subs[key] = (subs[key] || 0) + 1;
    }
  });

  const patterns = Object.entries(subs)
    .filter(([, count]) => count >= 3)
    .map(([pattern, count]) => ({ pattern, count, confidence: Math.min(count / 10, 1) }))
    .sort((a, b) => b.count - a.count);

  return { confidence: Math.min(history.length / 50, 1), patterns, editCount: history.length };
};

// ── FORM CHECK ──

DB.saveFormCheckResult = async function(result) {
  const id = result.id || `fc_${Date.now()}`;
  await setDoc(doc(db, 'formChecks', id), {
    ...result, id,
    status: result.status || 'pending_coach_review',
    createdAt: result.createdAt || serverTimestamp(),
  });
  return id;
};

DB.getFormChecksByClient = async function(clientId, limitN = 20) {
  const q = query(
    collection(db, 'formChecks'),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'desc'),
    limit(limitN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

DB.getPendingFormChecksForCoach = async function(coachId) {
  const q = query(
    collection(db, 'formChecks'),
    where('coachId', '==', coachId),
    where('status', '==', 'pending_coach_review'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

DB.approveFormCheck = async function(formCheckId, coachNote, drillIds = []) {
  await updateDoc(doc(db, 'formChecks', formCheckId), {
    status: 'reviewed',
    coachNote,
    prescribedDrills: drillIds,
    reviewedAt: serverTimestamp(),
  });
};

DB.getFormDrillLibrary = async function(coachId) {
  const [customSnap, defaultSnap] = await Promise.all([
    getDocs(query(collection(db, 'formDrills'), where('coachId', '==', coachId))),
    getDocs(query(collection(db, 'formDrills'), where('coachId', '==', 'default'))),
  ]);
  return [
    ...defaultSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    ...customSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  ];
};

DB.saveFormDrill = async function(drill) {
  const id = drill.id || `drill_${Date.now()}`;
  await setDoc(doc(db, 'formDrills', id), { ...drill, id });
  return id;
};

// ── C.3 QUIET DAY ──

DB.markRestDay = async function(clientId) {
  const today = new Date().toISOString().slice(0, 10);
  await DB.updateUser(clientId, { restDayMarkedAt: today });
};

DB.getRestDayStatus = async function(clientId) {
  const user = await DB.getUserById(clientId);
  const marked = user?.restDayMarkedAt;
  if (!marked) return false;
  const today = new Date().toISOString().slice(0, 10);
  return marked.slice(0, 10) === today;
};

// ── C.3 ANNIVERSARY ──

DB.getAnniversaryData = async function(clientId) {
  const user = await DB.getUserById(clientId);
  if (!user?.createdAt) return null;
  const startDate = new Date(user.createdAt);
  const now = new Date();
  const years = now.getFullYear() - startDate.getFullYear();
  const todayMD = `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const startMD = `${String(startDate.getMonth()+1).padStart(2,'0')}-${String(startDate.getDate()).padStart(2,'0')}`;
  const isAnniversary = todayMD === startMD && years >= 1;
  return { startDate: startDate.toISOString(), years, isAnniversary };
};

// ── GYM / MULTI-COACH ──

DB.createGym = async function(ownerId, gymName) {
  const gymId = `gym_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();

  await setDoc(doc(db, 'gyms', gymId), {
    id: gymId,
    name: gymName,
    ownerId,
    coachIds: [ownerId],
    inviteCode,
    customDomain: null,
    createdAt: serverTimestamp(),
  });

  await DB.updateUser(ownerId, { gymId, gymRole: 'owner' });
  return { gymId, inviteCode };
};

DB.getGym = async function(gymId) {
  const snap = await getDoc(doc(db, 'gyms', gymId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

DB.getGymByCoach = async function(coachId) {
  const coach = await DB.getUserById(coachId);
  if (!coach?.gymId) return null;
  return DB.getGym(coach.gymId);
};

DB.joinGymByInviteCode = async function(coachId, inviteCode) {
  const snap = await getDocs(query(collection(db, 'gyms'), where('inviteCode', '==', inviteCode)));
  if (snap.empty) throw new Error('Invalid invite code');

  const gymDoc = snap.docs[0];
  const gym = gymDoc.data();

  if (gym.coachIds.includes(coachId)) throw new Error('Already in this gym');
  if (gym.coachIds.length >= 5) throw new Error('Gym is full (max 5 coaches)');

  await updateDoc(gymDoc.ref, { coachIds: [...gym.coachIds, coachId] });
  await DB.updateUser(coachId, { gymId: gymDoc.id, gymRole: 'coach' });
  return { gymId: gymDoc.id, gymName: gym.name };
};

DB.getGymCoaches = async function(gymId) {
  const gym = await DB.getGym(gymId);
  if (!gym) return [];
  const coaches = await Promise.all(gym.coachIds.map(id => DB.getUserById(id)));
  return coaches.filter(Boolean);
};

DB.getGymClients = async function(gymId) {
  const gym = await DB.getGym(gymId);
  if (!gym || !gym.coachIds.length) return [];

  const chunks = [];
  for (let i = 0; i < gym.coachIds.length; i += 10) chunks.push(gym.coachIds.slice(i, i + 10));

  const allClients = [];
  for (const chunk of chunks) {
    const snap = await getDocs(query(
      collection(db, 'users'),
      where('coachId', 'in', chunk),
      where('role', '==', 'client')
    ));
    snap.docs.forEach(d => allClients.push({ id: d.id, ...d.data() }));
  }
  return allClients;
};

DB.setCustomDomain = async function(gymId, domain) {
  await updateDoc(doc(db, 'gyms', gymId), { customDomain: domain || null });
};

DB.getGymByDomain = async function(domain) {
  const snap = await getDocs(query(collection(db, 'gyms'), where('customDomain', '==', domain)));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

// ── GYM INTERNAL CHAT ──

DB.sendGymChatMessage = async function(gymId, senderId, senderName, text) {
  const convoId = `gym_${gymId}`;
  const convoRef = doc(db, 'conversations', convoId);
  const snap = await getDoc(convoRef);
  if (!snap.exists()) {
    await setDoc(convoRef, { type: 'gym-internal', gymId, createdAt: serverTimestamp() });
  }
  await addDoc(collection(db, 'conversations', convoId, 'messages'), {
    senderId, senderName, text,
    timestamp: serverTimestamp(),
  });
  await updateDoc(convoRef, { lastMessage: text.slice(0, 120), lastMessageAt: serverTimestamp() });
};

DB.getGymChatMessages = async function(gymId, limitN = 50) {
  const convoId = `gym_${gymId}`;
  const q = query(
    collection(db, 'conversations', convoId, 'messages'),
    orderBy('timestamp', 'asc'),
    limit(limitN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Export the extended DB
export { DB };
