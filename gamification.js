/**
 * Gamification Module
 * Renders streaks, badges, and leaderboards
 */
import { DB } from './db-firebase.js';

function injectStyles() {
  if (document.getElementById('bix-gamif-styles')) return;
  const style = document.createElement('style');
  style.id = 'bix-gamif-styles';
  style.textContent = `
    .badge-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 12px;
    }
    .badge-tile {
      background: var(--surface2, #1a1a1a);
      border: 1px solid var(--border, #333);
      border-radius: 12px;
      padding: 16px 10px;
      text-align: center;
      transition: transform .15s;
      cursor: default;
    }
    .badge-tile:hover { transform: translateY(-2px); }
    .badge-tile.locked { opacity: 0.35; filter: grayscale(1); }
    .badge-icon { font-size: 32px; margin-bottom: 8px; }
    .badge-name { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
    .badge-desc { font-size: 10px; color: var(--text-muted, #888); line-height: 1.3; }
    .streak-banner {
      background: linear-gradient(135deg, #e85d04, #f48c06);
      border-radius: 16px;
      padding: 20px 22px;
      display: flex;
      align-items: center;
      gap: 16px;
      color: #fff;
      box-shadow: 0 8px 32px rgba(232,93,4,.35);
      margin-bottom: 16px;
    }
    .streak-banner .flame { font-size: 36px; }
    .streak-banner .count { font-size: 32px; font-weight: 800; color: #fff; }
    .streak-banner .label { font-size: 11px; color: rgba(255,255,255,.75); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
    .leaderboard-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px;
      background: var(--surface2, #1a1a1a);
      border-radius: 10px;
      margin-bottom: 6px;
    }
    .leaderboard-row.me { border: 2px solid var(--primary, #e8442a); }
    .leaderboard-rank { font-size: 18px; font-weight: 700; width: 30px; text-align: center; }
    .leaderboard-rank.top1 { color: #f59e0b; }
    .leaderboard-rank.top2 { color: #9ca3af; }
    .leaderboard-rank.top3 { color: #b45309; }
  `;
  document.head.appendChild(style);
}

// All possible badges (for showing locked ones too)
const ALL_BADGES = [
  { id: 'first',    icon: '🎯', name: 'First Workout',  desc: 'Logged your first workout' },
  { id: 'ten',      icon: '💪', name: '10 Workouts',    desc: 'Completed 10 workouts' },
  { id: 'fifty',    icon: '🏆', name: '50 Workouts',    desc: 'Completed 50 workouts' },
  { id: 'hundred',  icon: '👑', name: 'Century Club',   desc: 'Completed 100 workouts' },
  { id: 'week',     icon: '🔥', name: '7-Day Streak',   desc: '7 days in a row' },
  { id: 'month',    icon: '⚡', name: '30-Day Warrior', desc: '30 days in a row' },
  { id: 'active',   icon: '✨', name: 'On Fire',        desc: '3+ days in a row' },
];

export async function renderStreakBanner(containerId, clientId) {
  injectStyles();
  const el = document.getElementById(containerId);
  if (!el) return;
  const { current, longest, totalWorkouts } = await DB.computeClientStreak(clientId);
  el.innerHTML = `
    <div class="streak-banner">
      <div class="flame">${current > 0 ? '🔥' : '💤'}</div>
      <div style="flex:1">
        <div class="label">Current Streak</div>
        <div style="display:flex;align-items:baseline;gap:8px">
          <div class="count">${current}</div>
          <div style="font-size:14px;color:var(--text-muted)">day${current === 1 ? '' : 's'}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div class="label">Best</div>
        <div style="font-size:20px;font-weight:700">${longest}d</div>
        <div style="font-size:11px;color:var(--text-muted)">${totalWorkouts} total</div>
      </div>
    </div>`;
}

export async function renderBadges(containerId, clientId) {
  injectStyles();
  const el = document.getElementById(containerId);
  if (!el) return;
  const earned = await DB.getBadges(clientId);
  const earnedIds = new Set(earned.map(b => b.id));
  el.innerHTML = `
    <div class="badge-grid">
      ${ALL_BADGES.map(b => `
        <div class="badge-tile ${earnedIds.has(b.id) ? '' : 'locked'}" title="${b.desc}">
          <div class="badge-icon">${b.icon}</div>
          <div class="badge-name">${b.name}</div>
          <div class="badge-desc">${b.desc}</div>
        </div>`).join('')}
    </div>
    <div style="margin-top:14px;font-size:12px;color:var(--text-muted);text-align:center">
      ${earned.length} of ${ALL_BADGES.length} badges earned
    </div>`;
}

export const Gamification = { renderStreakBanner, renderBadges };
if (typeof window !== 'undefined') window.Gamification = Gamification;
