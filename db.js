// ── GymPlan localStorage database ──

const DB = {

  // ── Re-seed on version bump ──
  seed() {
    if (localStorage.getItem('gym_seeded_v7')) return;

    const users = [
      {
        id: 'u_admin', role: 'admin',
        name: 'Nimrod', username: 'nimrod', password: 'nimrod123'
      },
      {
        id: 'u1', role: 'coach',
        name: 'Alex Johnson', username: 'coach', password: 'coach123',
        membershipExpiry: '2026-12-31'
      },
      {
        id: 'u2', role: 'client',
        name: 'Mike Torres', username: 'mike', password: 'mike123',
        coachId: 'u1', membershipExpiry: '2026-12-31'
      },
      {
        id: 'u3', role: 'client',
        name: 'Sara Lee', username: 'sara', password: 'sara123',
        coachId: 'u1', membershipExpiry: '2026-03-01'   // expired
      },
    ];

    const plans = [
      {
        id: 'p1', coachId: 'u1', clientId: 'u2',
        title: 'Beginner Strength Program',
        goal: 'Build foundational strength',
        durationWeeks: 8, status: 'active',
        createdAt: new Date('2026-04-01').toISOString(),
        days: [
          {
            label: 'Monday – Upper Body',
            exercises: [
              { name: 'Bench Press',     sets: 3, reps: '8-10', rest: '90s', notes: 'Control the descent' },
              { name: 'Barbell Row',     sets: 3, reps: '8-10', rest: '90s', notes: '' },
              { name: 'Overhead Press', sets: 3, reps: '8',     rest: '90s', notes: 'Keep core tight' },
              { name: 'Pull-Ups',       sets: 3, reps: '6-8',  rest: '90s', notes: 'Use band if needed' },
            ]
          },
          {
            label: 'Wednesday – Lower Body',
            exercises: [
              { name: 'Back Squat',    sets: 4, reps: '6-8', rest: '2min', notes: 'Depth to parallel' },
              { name: 'Romanian DL',   sets: 3, reps: '10',  rest: '90s',  notes: '' },
              { name: 'Leg Press',     sets: 3, reps: '12',  rest: '60s',  notes: '' },
              { name: 'Calf Raises',   sets: 4, reps: '15',  rest: '45s',  notes: '' },
            ]
          },
          {
            label: 'Friday – Full Body',
            exercises: [
              { name: 'Deadlift',       sets: 3, reps: '5',     rest: '2min', notes: 'Neutral spine!' },
              { name: 'Dumbbell Press', sets: 3, reps: '10',    rest: '60s',  notes: '' },
              { name: 'Lat Pulldown',   sets: 3, reps: '10-12', rest: '60s',  notes: '' },
              { name: 'Plank',          sets: 3, reps: '45s',   rest: '45s',  notes: '' },
            ]
          }
        ]
      }
    ];

    const settings = {
      businessName: 'BIX',
      bgColor: '#0f0f0f',
      accentColor: '#e8442a',
    };

    this.save('users',    users);
    this.save('plans',    plans);
    this.save('settings', settings);
    localStorage.setItem('gym_seeded_v7', '1');
  },

  // ── Core helpers ──
  load(key)       { try { return JSON.parse(localStorage.getItem('gym_' + key)) || []; } catch { return []; } },
  save(key, data) { localStorage.setItem('gym_' + key, JSON.stringify(data)); },

  // ── Users ──
  getUsers()              { return this.load('users'); },
  getUserById(id)         { return this.getUsers().find(u => u.id === id); },
  getUserByUsername(u)    { return this.getUsers().find(x => x.username.toLowerCase() === u.toLowerCase()); },
  saveUsers(users)        { this.save('users', users); },
  addUser(user)           { const us = this.getUsers(); us.push(user); this.saveUsers(us); },
  updateUser(id, patch)   { this.saveUsers(this.getUsers().map(u => u.id === id ? { ...u, ...patch } : u)); },
  deleteUser(id) {
    this.saveUsers(this.getUsers().filter(u => u.id !== id));
    this.savePlans(this.getPlans().filter(p => p.clientId !== id));
  },
  getClientsByCoach(coachId) { return this.getUsers().filter(u => u.role === 'client' && u.coachId === coachId); },
  getAllCoaches()            { return this.getUsers().filter(u => u.role === 'coach'); },
  getAllClients()            { return this.getUsers().filter(u => u.role === 'client'); },

  // ── Membership ──
  isMembershipActive(client) {
    if (!client.membershipExpiry) return false;
    return new Date(client.membershipExpiry) >= new Date(new Date().toDateString());
  },

  // ── Plans ──
  getPlans()                 { return this.load('plans'); },
  getPlanById(id)            { return this.getPlans().find(p => p.id === id); },
  getPlansByClient(clientId) { return this.getPlans().filter(p => p.clientId === clientId); },
  getPlansByCoach(coachId)   { return this.getPlans().filter(p => p.coachId === coachId); },
  getAllPlans()              { return this.getPlans(); },
  getPlansByCoachId(coachId) { return this.getPlans().filter(p => p.coachId === coachId); },
  savePlans(plans)           { this.save('plans', plans); },
  addPlan(plan)              { const ps = this.getPlans(); ps.push(plan); this.savePlans(ps); },
  updatePlan(id, patch)      { this.savePlans(this.getPlans().map(p => p.id === id ? { ...p, ...patch } : p)); },
  deletePlan(id)             { this.savePlans(this.getPlans().filter(p => p.id !== id)); },

  // ── Business settings ──
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem('gym_settings')) ||
        { businessName: 'GymPlan', bgColor: '#0f0f0f', accentColor: '#e8442a' };
    } catch {
      return { businessName: 'GymPlan', bgColor: '#0f0f0f', accentColor: '#e8442a' };
    }
  },
  saveSettings(s) { localStorage.setItem('gym_settings', JSON.stringify(s)); },

  // ── Session ──
  getSession()  { try { return JSON.parse(sessionStorage.getItem('gym_session')); } catch { return null; } },
  setSession(u) { sessionStorage.setItem('gym_session', JSON.stringify(u)); },
  clearSession(){ sessionStorage.removeItem('gym_session'); },

  genId() { return 'id_' + Math.random().toString(36).slice(2) + Date.now().toString(36); },
};

DB.seed();
