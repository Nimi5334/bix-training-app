/**
 * Progress Analytics Module
 * Weight trends, volume tracking, adherence, power records
 * Uses Chart.js (loaded from CDN on demand)
 */
import { DB } from './db-firebase.js';

let chartJsLoaded = false;
const loadedCharts = {};  // track chart instances by canvas id

async function ensureChartJs() {
  if (chartJsLoaded || window.Chart) {
    chartJsLoaded = true;
    return;
  }
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload = () => { chartJsLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('Failed to load Chart.js'));
    document.head.appendChild(s);
  });
}

function destroyChart(canvasId) {
  if (loadedCharts[canvasId]) {
    try { loadedCharts[canvasId].destroy(); } catch {}
    delete loadedCharts[canvasId];
  }
}

// ── Weight trend chart ──
export async function renderWeightChart(canvasId, clientId) {
  await ensureChartJs();
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destroyChart(canvasId);

  const history = await DB.getWeightHistoryByClient(clientId);
  // Also include user's current weight as today's data point
  const user = await DB.getUserById(clientId);
  if (user?.weight && history.length === 0) {
    history.push({ date: new Date().toISOString().split('T')[0], weight: user.weight });
  }

  if (!history.length) {
    canvas.parentElement.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px">No weight data yet.<br/>Log your weight to see trends.</div>';
    return;
  }

  const labels = history.map(h => new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  const data = history.map(h => h.weight);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#e8442a';

  loadedCharts[canvasId] = new window.Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Weight (kg)',
        data,
        borderColor: accent,
        backgroundColor: accent + '33',
        tension: 0.3,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: { color: '#aaa' },
          grid:  { color: '#333' },
        },
        x: {
          ticks: { color: '#aaa' },
          grid:  { color: '#222' },
        },
      },
    },
  });
}

// ── Workout volume over time ──
export async function renderVolumeChart(canvasId, clientId) {
  await ensureChartJs();
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destroyChart(canvasId);

  const logs = await DB.getWorkoutLogsByClient(clientId);
  if (!logs.length) {
    canvas.parentElement.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px">No workout data yet.</div>';
    return;
  }

  const byDate = {};
  logs.forEach(l => {
    const vol = l.totalVolume || (l.exercises || []).reduce((s, e) =>
      s + (parseInt(e.sets) || 0) * (parseInt(e.reps) || 0) * (parseFloat(e.weight) || 0), 0);
    byDate[l.date] = (byDate[l.date] || 0) + vol;
  });

  const sorted = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b));
  const labels = sorted.map(([d]) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
  const data = sorted.map(([, v]) => v);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#e8442a';

  loadedCharts[canvasId] = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Volume (kg·reps)',
        data,
        backgroundColor: accent + 'cc',
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { color: '#aaa' }, grid: { color: '#333' } },
        x: { ticks: { color: '#aaa' }, grid: { color: '#222' } },
      },
    },
  });
}

// ── Adherence stats (workouts this week / month) ──
export async function renderAdherenceStats(containerId, clientId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const logs = await DB.getWorkoutLogsByClient(clientId);

  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisWeek = logs.filter(l => new Date(l.date) >= weekAgo).length;
  const thisMonth = logs.filter(l => new Date(l.date) >= monthAgo).length;
  const total = logs.length;
  const { current, longest } = await DB.computeClientStreak(clientId);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">
      <div class="stat-card">
        <div class="stat-label">🔥 Current Streak</div>
        <div class="stat-value">${current}<span class="stat-unit">days</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">⚡ Longest Streak</div>
        <div class="stat-value">${longest}<span class="stat-unit">days</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">📅 This Week</div>
        <div class="stat-value">${thisWeek}<span class="stat-unit">workouts</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">📆 This Month</div>
        <div class="stat-value">${thisMonth}<span class="stat-unit">workouts</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">🏆 Total</div>
        <div class="stat-value">${total}<span class="stat-unit">workouts</span></div>
      </div>
    </div>
  `;
  injectStatStyles();
}

function injectStatStyles() {
  if (document.getElementById('bix-stat-styles')) return;
  const style = document.createElement('style');
  style.id = 'bix-stat-styles';
  style.textContent = `
    .stat-card {
      background: var(--surface2, #1a1a1a);
      border: 1px solid var(--border, #333);
      border-radius: 10px;
      padding: 14px 16px;
      min-width: 0;
    }
    .stat-label {
      font-size: 11px;
      color: var(--text-muted, #888);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      font-weight: 600;
    }
    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: var(--text, #fff);
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    .stat-unit {
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted, #888);
    }
  `;
  document.head.appendChild(style);
}

// ── Volume per muscle group ──
export async function renderMuscleGroupChart(canvasId, clientId) {
  await ensureChartJs();
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destroyChart(canvasId);

  const logs = await DB.getWorkoutLogsByClient(clientId);
  if (!logs.length) {
    canvas.parentElement.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px">No workout data yet.</div>';
    return;
  }

  // Simple keyword-based muscle categorization
  const groups = {
    'Chest':   ['bench', 'push-up', 'chest', 'fly', 'dip'],
    'Back':    ['row', 'pull-up', 'pullup', 'lat', 'deadlift'],
    'Legs':    ['squat', 'leg', 'lunge', 'calf', 'rdl'],
    'Shoulder':['press', 'shoulder', 'raise', 'shrug'],
    'Arms':    ['curl', 'tricep', 'bicep', 'extension'],
    'Core':    ['ab', 'plank', 'crunch', 'core'],
  };

  const totals = Object.fromEntries(Object.keys(groups).map(g => [g, 0]));
  logs.forEach(l => {
    (l.exercises || []).forEach(ex => {
      const name = (ex.name || '').toLowerCase();
      const volume = (parseInt(ex.sets) || 0) * (parseInt(ex.reps) || 0);
      for (const [group, keys] of Object.entries(groups)) {
        if (keys.some(k => name.includes(k))) {
          totals[group] += volume;
          break;
        }
      }
    });
  });

  const labels = Object.keys(totals);
  const data = Object.values(totals);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#e8442a';
  const colors = ['#e8442a', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  loadedCharts[canvasId] = new window.Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Volume',
        data,
        borderColor: accent,
        backgroundColor: accent + '55',
        pointBackgroundColor: accent,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          ticks: { color: '#888', backdropColor: 'transparent' },
          grid:  { color: '#333' },
          angleLines: { color: '#333' },
          pointLabels: { color: '#aaa', font: { size: 11 } },
        },
      },
    },
  });
}

export const Analytics = {
  renderWeightChart,
  renderVolumeChart,
  renderAdherenceStats,
  renderMuscleGroupChart,
};
if (typeof window !== 'undefined') window.Analytics = Analytics;
