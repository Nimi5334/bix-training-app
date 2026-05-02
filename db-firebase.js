// ── Firebase Configuration & Initialization ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, addDoc, writeBatch, onSnapshot, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyArUPdo36Zwv33TIirn9AuOb_DUH4uG1ok",
  authDomain: "bix-training-2119e.firebaseapp.com",
  projectId: "bix-training-2119e",
  storageBucket: "bix-training-2119e.firebasestorage.app",
  messagingSenderId: "690027292761",
  appId: "1:690027292761:web:3026f241e44f1e1325e948"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// ── Session Management (Firebase Auth) ──
const DB = {
  getSession() {
    const user = auth.currentUser;
    if (!user) return null;
    // Store minimal session — full user data fetches from Firestore on demand
    return { id: user.uid, email: user.email };
  },

  setSession(user) {
    // Firebase Auth handles persistence automatically via onAuthStateChanged
    console.log('Session set:', user.email);
  },

  clearSession() {
    // Handled by signOut()
  },

  // ── USERS CRUD ──
  async getUsers() {
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('getUsers error:', e);
      return [];
    }
  },

  async getUserById(id) {
    try {
      const docSnap = await getDoc(doc(db, 'users', id));
      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (e) {
      console.error('getUserById error:', e);
      return null;
    }
  },

  async getUserByUsername(username) {
    try {
      const users = await DB.getUsers();
      return users.find(u => u.username?.toLowerCase() === username.toLowerCase()) || null;
    } catch (e) {
      console.error('getUserByUsername error:', e);
      return null;
    }
  },

  async getUserByEmail(email) {
    try {
      const users = await DB.getUsers();
      return users.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null;
    } catch (e) {
      console.error('getUserByEmail error:', e);
      return null;
    }
  },

  async addUser(user) {
    try {
      // If user doesn't have an id, generate one
      const id = user.id || 'u_' + Date.now();
      await setDoc(doc(db, 'users', id), { ...user, id });
      return id;
    } catch (e) {
      console.error('addUser error:', e);
      throw e;
    }
  },

  async updateUser(id, patch) {
    try {
      await updateDoc(doc(db, 'users', id), patch);
    } catch (e) {
      console.error('updateUser error:', e);
      throw e;
    }
  },

  async deleteUser(id) {
    try {
      await deleteDoc(doc(db, 'users', id));
      // Also delete all plans where this user is coach or client
      const plans = await DB.getPlansByCoach(id);
      for (const p of plans) {
        await DB.deletePlan(p.id);
      }
      const clientPlans = await getDocs(query(collection(db, 'plans'), where('clientId', '==', id)));
      for (const p of clientPlans.docs) {
        await deleteDoc(p.ref);
      }
    } catch (e) {
      console.error('deleteUser error:', e);
      throw e;
    }
  },

  async getClientsByCoach(coachId) {
    try {
      const users = await DB.getUsers();
      return users.filter(u => u.role === 'client' && u.coachId === coachId);
    } catch (e) {
      console.error('getClientsByCoach error:', e);
      return [];
    }
  },

  async getAllCoaches() {
    try {
      const users = await DB.getUsers();
      return users.filter(u => u.role === 'coach');
    } catch (e) {
      console.error('getAllCoaches error:', e);
      return [];
    }
  },

  async getAllClients() {
    try {
      const users = await DB.getUsers();
      return users.filter(u => u.role === 'client');
    } catch (e) {
      console.error('getAllClients error:', e);
      return [];
    }
  },

  // ── PLANS CRUD ──
  async getPlans() {
    try {
      const snap = await getDocs(collection(db, 'plans'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('getPlans error:', e);
      return [];
    }
  },

  async getPlanById(id) {
    try {
      const docSnap = await getDoc(doc(db, 'plans', id));
      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (e) {
      console.error('getPlanById error:', e);
      return null;
    }
  },

  async getPlansByCoach(coachId) {
    try {
      const plans = await DB.getPlans();
      return plans.filter(p => p.coachId === coachId);
    } catch (e) {
      console.error('getPlansByCoach error:', e);
      return [];
    }
  },

  async getPlansByCoachId(coachId) {
    // Alias
    return DB.getPlansByCoach(coachId);
  },

  async getPlansByClient(clientId) {
    try {
      const plans = await DB.getPlans();
      return plans.filter(p => p.clientId === clientId);
    } catch (e) {
      console.error('getPlansByClient error:', e);
      return [];
    }
  },

  async getAllPlans() {
    return DB.getPlans();
  },

  async addPlan(plan) {
    try {
      const id = plan.id || 'p_' + Date.now();
      await setDoc(doc(db, 'plans', id), { ...plan, id });
      return id;
    } catch (e) {
      console.error('addPlan error:', e);
      throw e;
    }
  },

  async updatePlan(id, patch) {
    try {
      await updateDoc(doc(db, 'plans', id), patch);
    } catch (e) {
      console.error('updatePlan error:', e);
      throw e;
    }
  },

  async deletePlan(id) {
    try {
      await deleteDoc(doc(db, 'plans', id));
    } catch (e) {
      console.error('deletePlan error:', e);
      throw e;
    }
  },

  // ── SETTINGS CRUD ──
  async getSettings() {
    try {
      const docSnap = await getDoc(doc(db, 'settings', 'default'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Migrate old GymPlan branding to Bix
        if (data.businessName === 'GymPlan') {
          data.businessName = 'Bix';
          await updateDoc(doc(db, 'settings', 'default'), { businessName: 'Bix' }).catch(() => {});
        }
        return data;
      }
      // Fallback defaults
      return {
        businessName: 'Bix',
        bgColor: '#0f0f0f',
        accentColor: '#e8442a'
      };
    } catch (e) {
      console.error('getSettings error:', e);
      return {
        businessName: 'Bix',
        bgColor: '#0f0f0f',
        accentColor: '#e8442a'
      };
    }
  },

  async saveSettings(s) {
    try {
      await setDoc(doc(db, 'settings', 'default'), s);
    } catch (e) {
      console.error('saveSettings error:', e);
      throw e;
    }
  },

  // ── MEMBERSHIP HELPER ──
  isMembershipActive(client) {
    if (!client || !client.membershipExpiry) return false;
    return new Date(client.membershipExpiry) >= new Date();
  },

  // ── UTILITY ──
  genId() {
    return '_' + Math.random().toString(36).substr(2, 9);
  },

  // ═══════════════════════════════════════════════════
  // MESSAGING (Real-time chat between coach & client)
  // Collections: conversations/{convId} / messages/{msgId}
  // ═══════════════════════════════════════════════════
  _convId(userA, userB) {
    // Deterministic conversation ID (order-independent)
    return [userA, userB].sort().join('__');
  },

  async getOrCreateConversation(userA, userB) {
    const convId = DB._convId(userA, userB);
    const ref = doc(db, 'conversations', convId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: convId,
        participants: [userA, userB],
        lastMessage: '',
        lastMessageAt: null,
        unreadCount: { [userA]: 0, [userB]: 0 },
        createdAt: new Date().toISOString(),
      });
    }
    return convId;
  },

  async sendMessage(convId, senderId, recipientId, text) {
    if (!text || !text.trim()) return;
    const msgRef = doc(collection(db, 'conversations', convId, 'messages'));
    const payload = {
      id: msgRef.id,
      senderId,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      read: false,
    };
    await setDoc(msgRef, payload);
    // Update conversation preview + unread
    const convRef = doc(db, 'conversations', convId);
    const convSnap = await getDoc(convRef);
    const unread = convSnap.exists() ? (convSnap.data().unreadCount || {}) : {};
    unread[recipientId] = (unread[recipientId] || 0) + 1;
    await updateDoc(convRef, {
      lastMessage: text.trim().slice(0, 120),
      lastMessageAt: new Date().toISOString(),
      unreadCount: unread,
    });
    return payload;
  },

  subscribeToMessages(convId, callback) {
    const q = query(
      collection(db, 'conversations', convId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(msgs);
    }, (err) => console.error('subscribeToMessages error:', err));
  },

  subscribeToConversations(userId, callback) {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId)
    );
    return onSnapshot(q, (snap) => {
      const convs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      convs.sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
      callback(convs);
    }, (err) => console.error('subscribeToConversations error:', err));
  },

  async markConversationRead(convId, userId) {
    try {
      const convRef = doc(db, 'conversations', convId);
      const snap = await getDoc(convRef);
      if (!snap.exists()) return;
      const unread = snap.data().unreadCount || {};
      unread[userId] = 0;
      await updateDoc(convRef, { unreadCount: unread });
    } catch (e) {
      console.error('markConversationRead error:', e);
    }
  },

  // ═══════════════════════════════════════════════════
  // WORKOUT LOGS (For analytics, streaks, adherence)
  // Collection: workoutLogs/{logId}
  // ═══════════════════════════════════════════════════
  async logWorkout(log) {
    try {
      const id = log.id || 'wl_' + Date.now();
      const payload = {
        id,
        clientId: log.clientId,
        planId: log.planId || null,
        date: log.date || new Date().toISOString().split('T')[0],
        dayLabel: log.dayLabel || '',
        week: log.week || 1,
        exercises: log.exercises || [],  // [{name, sets, reps, weight, rpe}]
        totalVolume: log.totalVolume || 0,
        duration: log.duration || 0,
        notes: log.notes || '',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'workoutLogs', id), payload);
      // Fire webhook (non-blocking)
      if (typeof window !== 'undefined' && window.DB?.fireWebhook) {
        window.DB.fireWebhook('workout.logged', { clientId: payload.clientId, date: payload.date, totalVolume: payload.totalVolume });
      }
      return payload;
    } catch (e) {
      console.error('logWorkout error:', e);
      throw e;
    }
  },

  async getWorkoutLogsByClient(clientId) {
    try {
      const q = query(collection(db, 'workoutLogs'), where('clientId', '==', clientId));
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      return logs;
    } catch (e) {
      console.error('getWorkoutLogsByClient error:', e);
      return [];
    }
  },

  // Weight history tracking
  async logWeight(clientId, weightKg, date) {
    try {
      const d = date || new Date().toISOString().split('T')[0];
      const id = `wh_${clientId}_${d}`;
      await setDoc(doc(db, 'weightHistory', id), {
        id,
        clientId,
        weight: parseFloat(weightKg),
        date: d,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('logWeight error:', e);
    }
  },

  async getWeightHistoryByClient(clientId) {
    try {
      const q = query(collection(db, 'weightHistory'), where('clientId', '==', clientId));
      const snap = await getDocs(q);
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => a.date.localeCompare(b.date));
      return rows;
    } catch (e) {
      console.error('getWeightHistoryByClient error:', e);
      return [];
    }
  },

  // ═══════════════════════════════════════════════════
  // VIDEO FORM-CHECK (Client uploads → Coach reviews)
  // Collection: videoReviews/{id}
  // Storage: form-videos/{clientId}/{timestamp}.webm
  // ═══════════════════════════════════════════════════
  async uploadFormVideo(clientId, file, metadata = {}) {
    try {
      const ts = Date.now();
      const ext = (file.name || 'video.webm').split('.').pop();
      const path = `form-videos/${clientId}/${ts}.${ext}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      const id = 'vr_' + ts;
      const payload = {
        id,
        clientId,
        coachId: metadata.coachId || null,
        exerciseName: metadata.exerciseName || 'Unknown',
        videoUrl: url,
        videoPath: path,
        status: 'pending',        // pending | reviewed
        coachFeedback: '',
        coachRating: null,        // 1-5
        uploadedAt: new Date().toISOString(),
        reviewedAt: null,
      };
      await setDoc(doc(db, 'videoReviews', id), payload);
      return payload;
    } catch (e) {
      console.error('uploadFormVideo error:', e);
      throw e;
    }
  },

  async getVideoReviewsByClient(clientId) {
    try {
      const q = query(collection(db, 'videoReviews'), where('clientId', '==', clientId));
      const snap = await getDocs(q);
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
      return rows;
    } catch (e) {
      console.error('getVideoReviewsByClient error:', e);
      return [];
    }
  },

  async getVideoReviewsByCoach(coachId) {
    try {
      // Get all clients of this coach
      const clients = await DB.getClientsByCoach(coachId);
      const clientIds = clients.map(c => c.id);
      if (!clientIds.length) return [];
      // Firestore 'in' query supports max 10 — chunk if needed
      const all = [];
      for (let i = 0; i < clientIds.length; i += 10) {
        const chunk = clientIds.slice(i, i + 10);
        const q = query(collection(db, 'videoReviews'), where('clientId', 'in', chunk));
        const snap = await getDocs(q);
        all.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      all.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
      return all;
    } catch (e) {
      console.error('getVideoReviewsByCoach error:', e);
      return [];
    }
  },

  async reviewFormVideo(videoId, feedback, rating) {
    try {
      await updateDoc(doc(db, 'videoReviews', videoId), {
        coachFeedback: feedback || '',
        coachRating: rating || null,
        status: 'reviewed',
        reviewedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('reviewFormVideo error:', e);
      throw e;
    }
  },

  // ═══════════════════════════════════════════════════
  // PASSWORD RESET (Secure, via Firebase)
  // ═══════════════════════════════════════════════════
  async sendPasswordReset(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (e) {
      console.error('sendPasswordReset error:', e);
      throw e;
    }
  },

  // ═══════════════════════════════════════════════════
  // GAMIFICATION (Streaks, badges)
  // ═══════════════════════════════════════════════════
  async computeClientStreak(clientId) {
    const logs = await DB.getWorkoutLogsByClient(clientId);
    if (!logs.length) return { current: 0, longest: 0, totalWorkouts: 0 };

    const uniqueDates = [...new Set(logs.map(l => l.date))].sort();
    // Longest streak — count consecutive days
    let longest = 1, current = 1, running = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1]);
      const cur = new Date(uniqueDates[i]);
      const diff = (cur - prev) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        running++;
        longest = Math.max(longest, running);
      } else {
        running = 1;
      }
    }
    // Current streak — from today backwards
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (!uniqueDates.includes(today) && !uniqueDates.includes(yesterday)) {
      current = 0;
    } else {
      current = 1;
      let check = uniqueDates.includes(today) ? new Date(today) : new Date(yesterday);
      for (let i = uniqueDates.length - 2; i >= 0; i--) {
        check.setDate(check.getDate() - 1);
        const expected = check.toISOString().split('T')[0];
        if (uniqueDates[i] === expected || uniqueDates.includes(expected)) {
          current++;
        } else break;
      }
    }
    return { current, longest, totalWorkouts: logs.length };
  },

  async getBadges(clientId) {
    // Compute badges dynamically based on activity
    const logs = await DB.getWorkoutLogsByClient(clientId);
    const { current, longest, totalWorkouts } = await DB.computeClientStreak(clientId);
    const badges = [];
    if (totalWorkouts >= 1)   badges.push({ id: 'first',    icon: '🎯', name: 'First Workout',     desc: 'Logged your first workout' });
    if (totalWorkouts >= 10)  badges.push({ id: 'ten',      icon: '💪', name: '10 Workouts',       desc: 'Completed 10 workouts' });
    if (totalWorkouts >= 50)  badges.push({ id: 'fifty',    icon: '🏆', name: '50 Workouts',       desc: 'Completed 50 workouts' });
    if (totalWorkouts >= 100) badges.push({ id: 'hundred',  icon: '👑', name: 'Century Club',      desc: 'Completed 100 workouts' });
    if (longest   >= 7)       badges.push({ id: 'week',     icon: '🔥', name: '7-Day Streak',      desc: 'Worked out 7 days in a row' });
    if (longest   >= 30)      badges.push({ id: 'month',    icon: '⚡', name: '30-Day Warrior',    desc: 'Worked out 30 days in a row' });
    if (current   >= 3)       badges.push({ id: 'active',   icon: '✨', name: 'On Fire',           desc: 'Active 3+ days in a row' });
    return badges;
  },

  // ═══════════════════════════════════════════════════
  // TRANSACTIONS (payment history lookup)
  // ═══════════════════════════════════════════════════
  async getTransactionsByMember(memberId) {
    try {
      const q = query(collection(db, 'transactions'), where('memberId', '==', memberId));
      const snap = await getDocs(q);
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => {
        const aT = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bT = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bT - aT;
      });
      return rows;
    } catch (e) {
      console.error('getTransactionsByMember error:', e);
      return [];
    }
  },

  // ── ONE-TIME MIGRATION: Seed Firestore with default data ──
  async seedFirebase() {
    // Check if already seeded
    const settings = await DB.getSettings();
    if (settings.seedVersion === 1) return;

    console.log('Seeding Firestore...');

    const users = [
      {
        id: 'u_admin', role: 'admin',
        name: 'Nimrod', username: 'nimrod', email: 'nimrod@bix.app',
        membershipExpiry: '2026-12-31'
      },
      {
        id: 'u1', role: 'coach',
        name: 'Alex Johnson', username: 'coach', email: 'coach@bix.app',
        membershipExpiry: '2026-12-31'
      },
      {
        id: 'u2', role: 'client',
        name: 'Mike Torres', username: 'mike', email: 'mike@bix.app',
        coachId: 'u1', membershipExpiry: '2026-12-31'
      },
      {
        id: 'u3', role: 'client',
        name: 'Sara Lee', username: 'sara', email: 'sara@bix.app',
        coachId: 'u1', membershipExpiry: '2026-03-01'
      },
    ];

    const plans = [
      {
        id: 'p1', coachId: 'u1', clientId: 'u2',
        title: 'Beginner Strength Program',
        goal: 'Build foundational strength',
        durationWeeks: 8, daysPerWeek: 3, status: 'active',
        createdAt: new Date('2026-04-01').toISOString(),
        days: [
          {
            label: 'Monday – Upper Body', week: 1,
            exercises: [
              { name: 'Bench Press', sets: 3, reps: '8-10', rpe: '8', notes: 'Control the descent' },
              { name: 'Barbell Row', sets: 3, reps: '8-10', rpe: '8', notes: '' },
              { name: 'Overhead Press', sets: 3, reps: '8', rpe: '7', notes: 'Keep core tight' },
              { name: 'Pull-Ups', sets: 3, reps: '6-8', rpe: '8', notes: 'Use band if needed' },
            ]
          },
          {
            label: 'Wednesday – Lower Body', week: 1,
            exercises: [
              { name: 'Squats',       sets: 4, reps: '6-8',  rpe: '8', notes: 'Deep depth' },
              { name: 'Deadlifts',    sets: 3, reps: '5-6',  rpe: '8', notes: 'Neutral spine' },
              { name: 'Leg Press',    sets: 3, reps: '10-12', rpe: '7', notes: '' },
            ]
          },
          {
            label: 'Friday – Full Body', week: 1,
            exercises: [
              { name: 'Power Clean',  sets: 5, reps: '3',      rpe: '8', notes: 'Technical lift' },
              { name: 'Front Squats', sets: 3, reps: '6-8',    rpe: '8', notes: '' },
              { name: 'Rows',         sets: 3, reps: '8-10',   rpe: '7', notes: 'Brace core' },
            ]
          },
        ]
      },
    ];

    const seedData = {
      businessName: 'Bix',
      bgColor: '#0f0f0f',
      accentColor: '#e8442a',
      seedVersion: 1
    };

    try {
      // Add users
      for (const u of users) {
        await setDoc(doc(db, 'users', u.id), u);
      }
      // Add plans
      for (const p of plans) {
        await setDoc(doc(db, 'plans', p.id), p);
      }
      // Add settings
      await setDoc(doc(db, 'settings', 'default'), seedData);
      console.log('Firestore seeding complete!');
    } catch (e) {
      console.error('Seed error:', e);
    }
  }
};

// Export for module usage
export { DB, auth, db, storage, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail };
