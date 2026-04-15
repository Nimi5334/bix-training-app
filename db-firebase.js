// ── Firebase Configuration & Initialization ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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
        return docSnap.data();
      }
      // Fallback defaults
      return {
        businessName: 'GymPlan',
        bgColor: '#0f0f0f',
        accentColor: '#e8442a'
      };
    } catch (e) {
      console.error('getSettings error:', e);
      return {
        businessName: 'GymPlan',
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
      businessName: 'GymPlan',
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
export { DB, auth, db };
