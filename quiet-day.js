/**
 * Quiet Day Check-In — Phase C.3
 * After 3 days no workout activity, shows a gentle "rest day?" prompt.
 * Validates rather than nags. Sets restDayMarkedAt so rescue-nudge.js respects it.
 */

export async function maybeShowQuietDayPrompt(session) {
  if (document.getElementById('quiet-day-prompt')) return;

  const logs = await window.DB.getWorkoutLogsByClient(session.id);
  if (!logs.length) return;

  const sorted = [...logs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const lastDate = sorted[0]?.date;
  if (!lastDate) return;

  const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
  if (daysSince < 3) return;

  const alreadyMarked = await window.DB.getRestDayStatus(session.id);
  if (alreadyMarked) return;

  const prompt = document.createElement('div');
  prompt.id = 'quiet-day-prompt';
  prompt.style.cssText = [
    'position:fixed;bottom:80px;left:50%;transform:translateX(-50%)',
    'background:var(--surface);border:1px solid var(--border);border-radius:12px',
    'padding:14px 20px;max-width:360px;width:calc(100% - 40px)',
    'z-index:50;box-shadow:0 8px 32px rgba(0,0,0,.4)',
    'display:flex;align-items:center;gap:12px',
  ].join(';');

  prompt.innerHTML = `
    <div style="flex:1">
      <div style="font-size:14px;font-weight:600">Taking a rest day?</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:2px">No worries — rest is part of the plan.</div>
    </div>
    <button id="qd-yes" style="padding:8px 14px;background:var(--primary);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:600;cursor:pointer">Tap to mark</button>
    <button id="qd-dismiss" style="padding:8px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px">×</button>
  `;
  document.body.appendChild(prompt);

  prompt.querySelector('#qd-yes').onclick = async () => {
    await window.DB.markRestDay(session.id);
    prompt.remove();
    window.toast?.('Rest day marked. Recovery is training too.', 'success');
  };

  prompt.querySelector('#qd-dismiss').onclick = () => prompt.remove();

  setTimeout(() => prompt?.isConnected && prompt.remove(), 8000);
}
