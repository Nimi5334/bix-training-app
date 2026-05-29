/**
 * Achievements — Phase C.3
 * Badges computed dynamically from workoutLogs + streak data.
 */

export const BADGES = [
  { id: 'first-rep',      icon: '🎯', name: 'First Rep',       desc: 'Completed your first workout',         threshold: { workouts: 1 } },
  { id: 'week-warrior',   icon: '💪', name: 'Week Warrior',    desc: 'Completed 7 workouts',                 threshold: { workouts: 7 } },
  { id: 'half-centurion', icon: '🔥', name: 'Half-Centurion',  desc: "50 workouts. You're committed.",       threshold: { workouts: 50 } },
  { id: 'centurion',      icon: '⚔️', name: 'Centurion',       desc: '100 workouts. Elite.',                 threshold: { workouts: 100 } },
  { id: 'iron-will',      icon: '🏆', name: 'Iron Will',       desc: '6 months of consistent training',      threshold: { streakDays: 180 } },
  { id: 'pr-hunter',      icon: '🦾', name: 'PR Hunter',       desc: 'Set 10 personal records',              threshold: { prs: 10 } },
  { id: 'ton-club',       icon: '🏋️', name: 'Ton Club',        desc: 'Lifted 1,000kg total volume in a week', threshold: { weeklyVolume: 1000 } },
];

export function computeEarnedBadges(stats) {
  return BADGES.filter(badge => {
    const t = badge.threshold;
    if (t.workouts && stats.totalWorkouts < t.workouts) return false;
    if (t.streakDays && stats.longestStreak < t.streakDays) return false;
    if (t.prs && stats.totalPRs < t.prs) return false;
    if (t.weeklyVolume && stats.weeklyVolume < t.weeklyVolume) return false;
    return true;
  });
}

export function getNewBadges(currentBadges, previousBadgeIds = []) {
  return currentBadges.filter(b => !previousBadgeIds.includes(b.id));
}

export function computeStats(workoutLogs, powerRecords, longestStreak) {
  const totalWorkouts = workoutLogs.length;
  const totalPRs = (powerRecords || []).length;
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const weeklyVolume = workoutLogs
    .filter(l => (l.date || '') >= oneWeekAgo)
    .reduce((sum, l) => sum + (l.totalVolume || 0), 0);
  return { totalWorkouts, longestStreak: longestStreak || 0, totalPRs, weeklyVolume };
}

export function renderBadges(badges, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (badges.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Keep training — badges unlock as you hit milestones.</p>';
    return;
  }
  container.innerHTML = badges.map(b => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:8px">
      <span style="font-size:28px">${b.icon}</span>
      <div>
        <div style="font-weight:700;font-size:13px">${b.name}</div>
        <div style="font-size:11px;color:var(--text-muted)">${b.desc}</div>
      </div>
    </div>
  `).join('');
}
