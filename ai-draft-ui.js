/**
 * AI Draft UI — Phase A
 * Draft review panel: view, inline edit, publish or discard.
 */

import { CoachEditHistory } from './coach-edit-history.js';

const editHistory = new CoachEditHistory();

export async function renderDraftReview(containerId, draftId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const draft = await window.DB.getProgramDraft(draftId);
  if (!draft) { container.innerHTML = '<p style="color:var(--text-muted)">Draft not found.</p>'; return; }

  const { program, confidence, templateUsed } = draft;
  const confColor = confidence >= 70 ? '#22c55e' : confidence >= 40 ? '#f59e0b' : '#ef4444';

  container.innerHTML = `
    <div style="max-width:700px;padding-bottom:40px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <h2 style="margin:0;font-size:18px">AI Draft — ${templateUsed}</h2>
          <span style="font-size:12px;color:var(--text-muted)">
            Confidence: <strong style="color:${confColor}">${confidence}%</strong>
            ${confidence < 50 ? ' — review carefully, limited data' : ''}
          </span>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="discardDraft('${draftId}')" class="btn btn-secondary">Discard</button>
          <button onclick="publishDraft('${draftId}')" class="btn btn-primary">✓ Publish to Client</button>
        </div>
      </div>
      ${program.reasoning ? `<p style="font-size:13px;color:var(--text-muted);background:rgba(255,255,255,.04);padding:10px;border-radius:8px;margin-bottom:20px">💡 ${program.reasoning}</p>` : ''}
      <div id="draft-days"></div>
    </div>
  `;

  const daysEl = document.getElementById('draft-days');
  (program.week1 || []).forEach((day, di) => {
    const dayEl = document.createElement('div');
    dayEl.style.cssText = 'background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px';
    dayEl.innerHTML = `
      <h3 style="margin:0 0 12px;font-size:15px">${day.label || `Day ${day.day}`}</h3>
      ${(day.exercises || []).map((ex, ei) => `
        <div style="display:grid;grid-template-columns:1fr 64px 80px 56px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)">
          <input value="${ex.name}" data-field="name" data-day="${di}" data-ex="${ei}" onchange="onDraftFieldChange(this)"
            style="background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);font-size:14px;font-weight:600;padding:4px" />
          <input value="${ex.sets}" placeholder="sets" data-field="sets" data-day="${di}" data-ex="${ei}" onchange="onDraftFieldChange(this)"
            style="background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;padding:4px;text-align:center" />
          <input value="${ex.reps}" placeholder="reps" data-field="reps" data-day="${di}" data-ex="${ei}" onchange="onDraftFieldChange(this)"
            style="background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;padding:4px;text-align:center" />
          <span style="font-size:11px;color:var(--text-muted)">RPE ${ex.rpe}</span>
        </div>
      `).join('')}
    `;
    daysEl.appendChild(dayEl);
  });

  window._currentDraft = draft;
}

window.onDraftFieldChange = function(input) {
  const { field, day, ex } = input.dataset;
  const draft = window._currentDraft;
  if (!draft) return;
  const original = { ...draft.program.week1[parseInt(day)].exercises[parseInt(ex)] };
  draft.program.week1[parseInt(day)].exercises[parseInt(ex)][field] = input.value;
  const edited = { ...draft.program.week1[parseInt(day)].exercises[parseInt(ex)] };
  editHistory.recordEdit(original, edited, { exercise: original.name, field });
};

window.publishDraft = async function(draftId) {
  const draft = window._currentDraft;
  if (!draft) return;
  const session = window.DB.getSession();
  await editHistory.flush(session.id);

  const plan = {
    id: `plan_${Date.now()}`,
    coachId: session.id,
    clientId: draft.clientId,
    name: `${draft.templateUsed} — Week 1`,
    status: 'active',
    source: 'ai-draft',
    draftId: draft.id,
    days: draft.program.week1,
    createdAt: new Date().toISOString(),
  };

  await window.DB.savePlan?.(plan);
  await window.DB.updateDraftStatus(draftId, 'published', draft.program);
  window.toast?.('Program published to client.', 'success');
  document.getElementById('draft-panel')?.remove();
};

window.discardDraft = async function(draftId) {
  await window.DB.updateDraftStatus(draftId, 'discarded');
  document.getElementById('draft-panel')?.remove();
  window.toast?.('Draft discarded.', 'info');
};
