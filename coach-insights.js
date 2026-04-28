/**
 * CoachInsights — replaces Client Preservation.
 * Fires daily + weekly browser-push notifications (and saves them to the bell)
 * with a quick read on roster health.
 */

const ymd = (d = new Date()) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

const isoWeek = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}W${String(week).padStart(2, '0')}`;
};

const daysUntil = (iso) => iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : Infinity;

async function silenceDays(clientId) {
  try {
    const logs = await window.DB.getWorkoutLogsByClient(clientId);
    if (!logs?.length) return Infinity;
    const latest = logs.map(l => new Date(l.date)).sort((a, b) => b - a)[0];
    return Math.floor((Date.now() - latest.getTime()) / 86400000);
  } catch {
    return Infinity;
  }
}

async function ensurePermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
}

function pushBrowser(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: 'bix-insight' });
  } catch (e) {
    console.warn('push failed', e);
  }
}

async function saveBell(coachId, title, message, category) {
  try {
    await window.DB.saveNotification?.({
      targetUser: coachId,
      title,
      message,
      type: 'insight',
      category,
      read: false,
      createdAt: new Date(),
    });
  } catch (e) {
    console.warn('saveNotification failed', e);
  }
}

export class CoachInsights {
  async runDaily(coachId) {
    if (!coachId) return;
    const gate = `bix_insight_daily_${coachId}`;
    if (localStorage.getItem(gate) === ymd()) return;

    const ok = await ensurePermission();
    const clients = await window.DB.getClientsByCoach(coachId).catch(() => []);
    const active = clients.filter(c => window.DB.isMembershipActive?.(c));
    let atRisk = 0, expiringSoon = 0, silentToday = 0;

    for (const c of active) {
      const sd = await silenceDays(c.id);
      const dx = daysUntil(c.membershipExpiry);
      if (sd >= 3 && sd !== Infinity) atRisk++;
      if (dx >= 0 && dx <= 7) expiringSoon++;
      if (sd === 0) silentToday++;
    }

    const body = `${atRisk} at-risk · ${expiringSoon} expiring 7d · ${active.length} active`;
    if (ok) pushBrowser('☀️ Bix daily insight', body);
    await saveBell(coachId, '☀️ Daily insight', body, 'daily');

    localStorage.setItem(gate, ymd());
  }

  async runWeekly(coachId) {
    if (!coachId) return;
    const gate = `bix_insight_weekly_${coachId}`;
    if (localStorage.getItem(gate) === isoWeek()) return;

    const ok = await ensurePermission();
    const clients = await window.DB.getClientsByCoach(coachId).catch(() => []);

    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const fourteenDaysAgo = Date.now() - 14 * 86400000;

    let activeThisWeek = 0;
    let inactive = 0;
    let prCount = 0;
    let volumeThis = 0;
    let volumePrior = 0;

    for (const c of clients) {
      try {
        const logs = await window.DB.getWorkoutLogsByClient(c.id);
        const thisWeek = logs.filter(l => new Date(l.date).getTime() >= sevenDaysAgo);
        const priorWeek = logs.filter(l => {
          const t = new Date(l.date).getTime();
          return t >= fourteenDaysAgo && t < sevenDaysAgo;
        });
        if (thisWeek.length) activeThisWeek++;
        else inactive++;

        const sumVol = (arr) => arr.reduce((s, l) => s + (l.exercises || []).reduce((s2, e) => {
          return s2 + (e.sets || []).reduce((s3, st) => s3 + (Number(st.weight) || 0) * (Number(st.reps) || 0), 0);
        }, 0), 0);

        volumeThis += sumVol(thisWeek);
        volumePrior += sumVol(priorWeek);

        prCount += thisWeek.reduce((s, l) => s + ((l.prs?.length) || (l.isPR ? 1 : 0)), 0);
      } catch {}
    }

    const delta = volumePrior > 0 ? Math.round(((volumeThis - volumePrior) / volumePrior) * 100) : 0;
    const arrow = delta >= 0 ? '↑' : '↓';
    const body = `${activeThisWeek} active · ${inactive} inactive · ${prCount} PRs · vol ${arrow}${Math.abs(delta)}%`;
    if (ok) pushBrowser('📊 Bix weekly digest', body);
    await saveBell(coachId, '📊 Weekly digest', body, 'weekly');

    localStorage.setItem(gate, isoWeek());
  }
}
