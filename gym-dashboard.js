/**
 * Gym Revenue Dashboard — Phase D
 * Shows gym owner a rollup of all coaches' client stats, churn risk, and roster size.
 */

export async function renderGymRevenueDashboard(containerId, gymId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const [coaches, clients] = await Promise.all([
    window.DB.getGymCoaches(gymId),
    window.DB.getGymClients(gymId),
  ]);

  const now = new Date();
  const active = clients.filter(c => !c.membershipExpiry || new Date(c.membershipExpiry) > now);
  const atRisk = clients.filter(c => (c.atRiskScore || 0) >= 40);
  const expired = clients.length - active.length;

  const stats = [
    { label: 'Total Clients', value: clients.length, color: 'var(--primary)' },
    { label: 'Active',        value: active.length,   color: '#22c55e' },
    { label: 'At Risk',       value: atRisk.length,   color: '#f59e0b' },
    { label: 'Expired',       value: expired,          color: '#ef4444' },
    { label: 'Coaches',       value: coaches.length,   color: 'var(--primary)' },
  ];

  container.innerHTML = `
    <div style="max-width:700px">
      <h2 style="margin-bottom:16px">📊 Gym Dashboard</h2>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px">
        ${stats.map(s => `
          <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:800;color:${s.color}">${s.value}</div>
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-top:4px">${s.label}</div>
          </div>`).join('')}
      </div>

      <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:12px;padding:16px">
        <h3 style="margin:0 0 12px;font-size:14px">Coaches & Their Rosters</h3>
        ${coaches.map(coach => {
          const coachClients = clients.filter(c => c.coachId === coach.id);
          const coachActive = coachClients.filter(c => !c.membershipExpiry || new Date(c.membershipExpiry) > now);
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)">
              <span style="font-size:13px;font-weight:600">${coach.name || coach.email || coach.id}</span>
              <span style="font-size:12px;color:var(--text-muted)">${coachActive.length} active / ${coachClients.length} total</span>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;
}
