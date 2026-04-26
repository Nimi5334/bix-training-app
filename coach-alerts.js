/**
 * Coach Alerts — Phase 8
 * Overtraining detection: RPE >= 9 on highest set of >= 4 exercises
 * AND volume in top 25% for that client, sustained 6 days in a row.
 * Produces coach notification + banner on Members page.
 */

export class CoachAlerts {
  constructor() {
    this.overtrained = []; // { memberId, name }
  }

  async init() {
    document.addEventListener('sessionReady', () => this.run());
  }

  async run() {
    if (!window.session) return;
    try {
      const members = await window.DB.getCoachMembers(window.session.id);
      this.overtrained = [];

      await Promise.all(members.map(m => this._checkMember(m)));

      this._renderBanner();
    } catch (err) {
      console.error('CoachAlerts.run error:', err);
    }
  }

  async _checkMember(member) {
    try {
      const logs = await window.DB.getWorkoutLogsByClient(member.id).catch(() => []);
      if (logs.length < 6) return;

      const sorted = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
      const recent = sorted.slice(0, 6); // last 6 days of logs

      // Check all 6 are within 6 calendar days
      const newest = new Date(recent[0].date).getTime();
      const oldest = new Date(recent[5].date).getTime();
      if ((newest - oldest) > 7 * 86400000) return;

      // Per-log: count exercises with peak set RPE >= 9
      let allHighRpe = true;
      const volumes = [];

      for (const log of recent) {
        const exercises = Array.isArray(log.exercises) ? log.exercises : [];
        const highRpeCount = exercises.filter(e => {
          const maxRpe = Array.isArray(e.sets)
            ? Math.max(...e.sets.map(s => s.rpe || 0))
            : (e.rpe || 0);
          return maxRpe >= 9;
        }).length;

        if (highRpeCount < 4) { allHighRpe = false; break; }

        const totalVol = exercises.reduce((s, e) => {
          const sets = Array.isArray(e.sets) ? e.sets.length : (e.sets || 3);
          const reps = e.reps || 10;
          return s + sets * reps;
        }, 0);
        volumes.push(totalVol);
      }

      if (!allHighRpe) return;

      // Volume top-25%: check recent 6 logs are above 75th percentile of all logs
      const allVols = logs.map(l => {
        const exs = Array.isArray(l.exercises) ? l.exercises : [];
        return exs.reduce((s, e) => s + ((e.sets || 3) * (e.reps || 10)), 0);
      }).sort((a, b) => a - b);
      const p75 = allVols[Math.floor(allVols.length * 0.75)] || 0;
      const allHighVol = volumes.every(v => v >= p75);

      if (allHighRpe && allHighVol) {
        this.overtrained.push({ memberId: member.id, name: member.name });
      }
    } catch { /* skip this member */ }
  }

  _renderBanner() {
    const host = document.getElementById('overtraining-banner');
    if (!host) return;

    if (!this.overtrained.length) {
      host.style.display = 'none';
      return;
    }

    host.style.display = 'block';
    const names = this.overtrained.map(m => m.name).join(', ');
    host.innerHTML = `
      <div style="background:rgba(245,158,11,.09);border:1px solid rgba(245,158,11,.3);border-radius:var(--r-md);padding:14px 18px;display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <span style="font-size:22px">⚠️</span>
        <div style="flex:1">
          <div style="font-weight:700;font-size:14px;color:#fbbf24">Overtraining Alert</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:2px">
            ${names} — high RPE + volume for 6+ consecutive days. Consider reducing intensity.
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="this.closest('[style]').style.display='none'">Dismiss</button>
      </div>`;

    // Add warning overlay on affected member cards
    this.overtrained.forEach(({ memberId }) => {
      const card = document.querySelector(`[onclick="openMemberDetail('${memberId}')"]`);
      if (card) card.style.borderColor = 'rgba(245,158,11,.5)';
    });
  }
}
