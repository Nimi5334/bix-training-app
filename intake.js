/**
 * Client Intake — PAR-Q health questionnaire + waiver signature
 * Standalone page (intake.html). Required once before accessing the dashboard.
 */

import { DB, auth } from './db-firebase.js';
import './db-extensions.js';

const PAR_Q = [
  { id: 'q1', text: 'Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?' },
  { id: 'q2', text: 'Do you feel pain in your chest when you do physical activity?' },
  { id: 'q3', text: 'In the past month, have you had chest pain when you were not doing physical activity?' },
  { id: 'q4', text: 'Do you lose your balance because of dizziness, or do you ever lose consciousness?' },
  { id: 'q5', text: 'Do you have a bone or joint problem that could be made worse by a change in your physical activity?' },
  { id: 'q6', text: 'Is your doctor currently prescribing drugs (for example, water pills) for your blood pressure or heart condition?' },
  { id: 'q7', text: 'Do you know of any other reason why you should not do physical activity?' },
];

let session = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) { location.replace('index.html'); return; }
  const userData = await DB.getUserByEmail(user.email);
  if (!userData || userData.role !== 'client') { location.replace('index.html'); return; }

  // Already completed?
  const intake = await DB.getIntakeForm(user.uid);
  if (intake?.completed) { location.replace('client.html'); return; }

  session = userData;
  loadWaiverText();
  renderParQ();
});

async function loadWaiverText() {
  const settings = await DB.getSettings();
  const wt = settings.waiverText ||
    `I, the undersigned, do hereby acknowledge and agree that my participation in any and all physical training programs, exercises, and activities provided through this platform is voluntary. I understand that physical exercise involves risk of injury, and I expressly assume those risks. I release, waive, discharge, and covenant not to sue the coaching service, its coaches, employees, and agents from any and all liability, claims, demands, actions, and causes of action arising out of or relating to any loss, damage, or injury that may be sustained during or as a result of participation in any training activity. I confirm that I am physically fit and have no medical condition that would prevent my participation in fitness activities, and that I have consulted a physician if necessary.`;
  document.getElementById('waiver-text').textContent = wt;
}

function renderParQ() {
  const list = document.getElementById('parq-list');
  list.innerHTML = PAR_Q.map(q => `
    <div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06)">
      <p style="font-size:14px;line-height:1.6;margin-bottom:10px">${q.text}</p>
      <div style="display:flex;gap:12px">
        <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:14px;font-weight:600">
          <input type="radio" name="${q.id}" value="yes"
            style="width:16px;height:16px;accent-color:#7850ff" />
          Yes
        </label>
        <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:14px;font-weight:600">
          <input type="radio" name="${q.id}" value="no" checked
            style="width:16px;height:16px;accent-color:#7850ff" />
          No
        </label>
      </div>
    </div>`).join('');
}

window.submitIntake = async function() {
  const btn = document.getElementById('submit-btn');
  const err = document.getElementById('intake-error');
  err.style.display = 'none';

  // Validate PAR-Q answers collected
  const answers = {};
  let anyYes = false;
  for (const q of PAR_Q) {
    const val = document.querySelector(`input[name="${q.id}"]:checked`)?.value;
    if (!val) {
      err.textContent = 'Please answer all PAR-Q questions.';
      err.style.display = 'block';
      return;
    }
    answers[q.id] = val;
    if (val === 'yes') anyYes = true;
  }

  // Validate signature
  const sig = document.getElementById('waiver-sig').value.trim();
  if (!sig || sig.length < 2) {
    err.textContent = 'Please type your full name to sign the waiver.';
    err.style.display = 'block';
    return;
  }

  // Warning if any yes answers
  if (anyYes) {
    const ok = confirm('You answered "Yes" to one or more PAR-Q questions. We recommend consulting your doctor before starting. Continue anyway?');
    if (!ok) return;
  }

  btn.disabled = true;
  btn.textContent = 'Submitting…';

  try {
    await DB.saveIntakeForm(session.id, {
      parq: { answers, completedAt: new Date().toISOString(), anyYes },
      waiver: { signedAt: new Date().toISOString(), signatureName: sig },
      completed: true,
    });
    location.replace('client.html');
  } catch (e) {
    console.error('Intake submit error:', e);
    err.textContent = 'Something went wrong. Please try again.';
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Complete & Continue';
  }
};
