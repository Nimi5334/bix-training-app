/**
 * Form Check Coach UI — Phase B
 * Coach review queue: video, flags, note, drill prescription, approve.
 */

export async function renderFormCheckQueue(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const coachId = window.DB.getSession().id;
  const [pending, drills] = await Promise.all([
    window.DB.getPendingFormChecksForCoach(coachId),
    window.DB.getFormDrillLibrary(coachId),
  ]);

  if (pending.length === 0) { container.style.display = 'none'; return; }

  container.style.display = 'block';
  container.innerHTML = `
    <h3 style="margin-bottom:4px">📹 Form Reviews Pending (${pending.length})</h3>
    <div id="fc-coach-list">
      ${pending.map(fc => renderFormCheckCard(fc, drills)).join('')}
    </div>
  `;

  container.querySelectorAll('.fc-approve-btn').forEach(btn => {
    btn.addEventListener('click', () => approveFormCheck(btn.dataset.fcId, drills));
  });
}

function renderFormCheckCard(fc, drills) {
  const flagHtml = fc.flags?.length
    ? fc.flags.map(f => `
        <div style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);border-radius:6px;padding:8px;margin-bottom:6px;font-size:13px">
          ⚠️ <strong>${f.id.replace(/_/g, ' ')}</strong> — ${f.message}
        </div>`).join('')
    : '<p style="color:#22c55e;font-size:13px;margin:0">✅ No form flags detected</p>';

  const drillOptions = drills.map(d =>
    `<option value="${d.id}">${d.name}${d.sets ? ' (' + d.sets + ')' : ''}</option>`
  ).join('');

  return `
    <div class="fc-card" data-fc-id="${fc.id}" style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <strong style="font-size:14px">${fc.exercise || 'Exercise'} — Form Check</strong>
        <span style="font-size:11px;color:var(--text-muted)">${fc.clientId || ''}</span>
      </div>
      ${fc.videoUrl ? `<video src="${fc.videoUrl}" controls style="width:100%;border-radius:8px;margin-bottom:12px;max-height:240px" preload="metadata"></video>` : ''}
      ${flagHtml}
      <div style="margin-top:12px">
        <label style="font-size:12px;color:var(--text-muted)">Your note to client:</label>
        <textarea id="fc-note-${fc.id}" rows="2" placeholder="Great effort! One thing to focus on…"
          style="width:100%;margin-top:4px;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;box-sizing:border-box"></textarea>
      </div>
      ${drillOptions ? `
        <div style="margin-top:8px">
          <label style="font-size:12px;color:var(--text-muted)">Prescribe corrective drill:</label>
          <select id="fc-drill-${fc.id}" style="width:100%;margin-top:4px;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px">
            <option value="">— None —</option>
            ${drillOptions}
          </select>
        </div>` : ''}
      <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">
        <button class="btn btn-secondary btn-sm" onclick="skipFormCheck('${fc.id}')">Skip</button>
        <button class="btn btn-primary btn-sm fc-approve-btn" data-fc-id="${fc.id}">✓ Send Feedback</button>
      </div>
    </div>
  `;
}

async function approveFormCheck(fcId, drills) {
  const note = document.getElementById(`fc-note-${fcId}`)?.value?.trim() || '';
  const drillId = document.getElementById(`fc-drill-${fcId}`)?.value || null;

  await window.DB.approveFormCheck(fcId, note, drillId ? [drillId] : []);

  document.querySelector(`.fc-card[data-fc-id="${fcId}"]`)?.remove();
  window.toast?.('Feedback sent to client.', 'success');
}

window.skipFormCheck = async function(fcId) {
  await window.DB.approveFormCheck(fcId, '', []);
  document.querySelector(`.fc-card[data-fc-id="${fcId}"]`)?.remove();
};
