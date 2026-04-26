/**
 * Client Program Management
 * Displays client's training program with week selector
 * and integrated Start Workout button
 */

export class ClientProgram {
  constructor() {
    this.program = null;
    this.currentWeek = 1;
    this.isWorkoutActive = false;
  }

  async init() {
    document.addEventListener('sessionReady', () => this.loadProgram());
    window.addEventListener('programUpdated', () => this.loadProgram());
  }

  async loadProgram() {
    if (!window.session) return;
    try {
      this.program = await window.DB.getClientProgram(window.session.id);
      if (!this.program) {
        this.showNoProgramState();
        return;
      }
      this.renderWeekSelector();
      this.renderCurrentWeek();
    } catch (err) {
      console.error('Failed to load program:', err);
    }
  }

  renderWeekSelector() {
    const container = document.getElementById('week-selector') || this.createWeekSelectorContainer();
    const weeks = Array.from({ length: this.program.durationWeeks || 5 }, (_, i) => i + 1);

    container.innerHTML = weeks.map(week => `
      <button
        class="week-button ${week === this.currentWeek ? 'active' : ''}"
        onclick="selectWeek(${week})"
        style="padding: 8px 14px; border-radius: var(--r-md); border: none; font-weight: 600; font-size: 12px; cursor: pointer; background: ${week === this.currentWeek ? 'var(--purple)' : 'var(--surface)'}; color: ${week === this.currentWeek ? '#fff' : 'var(--text)'}; margin-right: 8px; transition: all .2s">
        Week ${week}
      </button>
    `).join('');
  }

  renderCurrentWeek() {
    const container = document.getElementById('program-content') || this.createProgramContainer();
    const weekData = this.program.weeks?.[this.currentWeek - 1] || {};

    const days = weekData.days || [];
    const daysHtml = days.map(day => `
      <div style="margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 16px">
        <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px">${day.name}</h3>
        <div style="display: flex; flex-direction: column; gap: 10px">
          ${day.exercises?.map(ex => `
            <div style="background: var(--surface); padding: 12px; border-radius: var(--r-md); border: 1px solid var(--border)">
              <div style="font-weight: 600; margin-bottom: 4px">${ex.name}</div>
              <div style="font-size: 13px; color: var(--text-muted)">
                ${ex.sets} × ${ex.reps} | RPE: ${ex.rpe || 7}
              </div>
            </div>
          `).join('') || '<p style="color: var(--text-muted); font-size: 13px">Rest day</p>'}
        </div>
      </div>
    `).join('');

    const startWorkoutBtn = `
      <div style="margin-top: 32px; margin-bottom: 20px">
        <button class="btn btn-primary" style="width: 100%; padding: 16px; font-size: 16px; font-weight: 700" onclick="startWorkout()">
          🚀 Start Workout
        </button>
      </div>
    `;

    container.innerHTML = daysHtml ? startWorkoutBtn + `<div style="margin-top: 12px">${daysHtml}</div>` : '<p style="text-align: center; color: var(--text-muted); padding: 24px">No program assigned yet. Contact your coach!</p>';
  }

  createWeekSelectorContainer() {
    const container = document.createElement('div');
    container.id = 'week-selector';
    container.style.cssText = 'display: flex; gap: 8px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 8px';
    const programPage = document.getElementById('page-my-program') || this.createProgramPage();
    programPage.insertBefore(container, programPage.firstChild);
    return container;
  }

  createProgramContainer() {
    const container = document.createElement('div');
    container.id = 'program-content';
    const programPage = document.getElementById('page-my-program') || this.createProgramPage();
    programPage.appendChild(container);
    return container;
  }

  createProgramPage() {
    const page = document.createElement('div');
    page.className = 'page';
    page.id = 'page-my-program';
    page.style.cssText = 'max-width: 800px';
    const main = document.querySelector('main');
    if (main) main.appendChild(page);
    return page;
  }

  showNoProgramState() {
    const container = document.getElementById('program-content') || this.createProgramContainer();
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px">
        <div style="font-size: 48px; margin-bottom: 16px">📋</div>
        <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 8px">No Program Yet</h2>
        <p style="color: var(--text-muted); margin-bottom: 20px">Your coach hasn't assigned you a program yet. Check back soon!</p>
        <button class="btn btn-secondary" onclick="location.href='client.html'">Back to Dashboard</button>
      </div>
    `;
  }
}

// ── Workout Runner State ──
const WR = {
  exercises: [],
  exIdx: 0,
  setIdx: 0,
  setLogs: [],      // { exIdx, setNum, reps, rpe }
  startTime: null,
  currentReps: 0,
  currentRpe: 0,
};

// Global functions
window.selectWeek = (week) => {
  if (window.clientProgram) {
    window.clientProgram.currentWeek = week;
    window.clientProgram.renderWeekSelector();
    window.clientProgram.renderCurrentWeek();
  }
};

window.startWorkout = () => {
  const prog = window.clientProgram?.program;
  if (!prog) { window.toast('No program loaded', 'error'); return; }

  // Find today's day by weekday name, else flatten all week exercises
  const weekData = prog.weeks?.[window.clientProgram.currentWeek - 1] || {};
  const days = weekData.days || [];
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const todayDay = days.find(d => (d.name || '').toLowerCase().includes(todayName.slice(0, 3)));
  const exercises = (todayDay ? todayDay.exercises : days.flatMap(d => d.exercises || [])).filter(Boolean);

  if (!exercises.length) { window.toast('Rest day — no exercises today', 'info'); return; }

  WR.exercises = exercises;
  WR.exIdx = 0;
  WR.setIdx = 0;
  WR.setLogs = [];
  WR.startTime = Date.now();

  _wrShow('exercise');
  _wrRenderExercise();
  document.getElementById('wr-camera-btn').style.display = 'flex';
};

function _wrEl(id) { return document.getElementById(id); }

function _wrShow(screen) {
  const runner = _wrEl('workout-runner');
  runner.style.display = 'flex';
  ['exercise', 'feedback', 'summary'].forEach(s => {
    const el = _wrEl('wr-screen-' + s);
    el.style.display = s === screen ? 'flex' : 'none';
    el.style.flexDirection = 'column';
  });
  _wrEl('wr-camera-btn').style.display = screen === 'exercise' ? 'flex' : 'none';
}

function _wrRenderExercise() {
  const ex = WR.exercises[WR.exIdx];
  const totalSets = ex.sets || 3;
  const isLastSet = WR.setIdx >= totalSets - 1;
  const isLastEx  = WR.exIdx >= WR.exercises.length - 1;

  WR.currentReps = ex.reps || 10;
  WR.currentRpe  = ex.rpe  || 7;

  _wrEl('wr-exercise-name').textContent = ex.name || 'Exercise';
  _wrEl('wr-set-label').textContent = `Set ${WR.setIdx + 1} of ${totalSets}`;
  _wrEl('wr-ex-counter').textContent = `Exercise ${WR.exIdx + 1} / ${WR.exercises.length}`;
  _wrEl('wr-set-counter').textContent = `Set ${WR.setIdx + 1}/${totalSets}`;
  _wrEl('wr-reps').textContent = WR.currentReps;
  _wrEl('wr-rpe').textContent  = WR.currentRpe;
  _wrEl('wr-next-btn').textContent = isLastSet && isLastEx ? 'Finish Workout ✓'
    : isLastSet ? 'Next Exercise →'
    : 'Next Set →';

  _wrUpdateProgress();
}

function _wrUpdateProgress() {
  const totalSets = WR.exercises.reduce((s, e) => s + (e.sets || 3), 0);
  const doneSets  = WR.setLogs.length;
  const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;
  _wrEl('wr-progress-bar').style.width = pct + '%';
}

window.adjustWR = (field, delta) => {
  if (field === 'reps') {
    WR.currentReps = Math.max(1, WR.currentReps + delta);
    _wrEl('wr-reps').textContent = WR.currentReps;
  } else {
    WR.currentRpe = Math.max(1, Math.min(10, WR.currentRpe + delta));
    _wrEl('wr-rpe').textContent = WR.currentRpe;
  }
};

window.nextSetOrExercise = () => {
  const ex = WR.exercises[WR.exIdx];
  const totalSets = ex.sets || 3;

  WR.setLogs.push({ exIdx: WR.exIdx, setNum: WR.setIdx + 1, reps: WR.currentReps, rpe: WR.currentRpe });

  const isLastSet = WR.setIdx >= totalSets - 1;
  const isLastEx  = WR.exIdx >= WR.exercises.length - 1;

  if (!isLastSet) {
    WR.setIdx++;
    _wrRenderExercise();
    return;
  }

  // Done with this exercise — show feedback
  const isPR = WR.currentReps > (ex.reps || 10) && WR.currentRpe <= (ex.rpe || 7);
  _wrShowFeedback(isPR, isLastEx);
  WR.setIdx = 0;
};

function _wrShowFeedback(isPR, isLastEx) {
  _wrShow('feedback');
  if (isPR) {
    _wrEl('wr-feedback-icon').textContent = '🔥';
    _wrEl('wr-feedback-text').textContent = 'New PR!';
    _wrEl('wr-feedback-sub').textContent = 'You crushed it — new personal record!';
    if (window.session?.coachId) {
      window.DB?.postToGlobalChannel?.(window.session.coachId, window.session.id,
        `🎉 ${window.session.name} just hit a PR on ${WR.exercises[WR.exIdx].name}!`);
    }
  } else if (WR.currentRpe <= 7) {
    _wrEl('wr-feedback-icon').textContent = '💪';
    _wrEl('wr-feedback-text').textContent = 'Better than last time!';
    _wrEl('wr-feedback-sub').textContent = 'Solid set. Keep the momentum.';
  } else {
    _wrEl('wr-feedback-icon').textContent = '✅';
    _wrEl('wr-feedback-text').textContent = 'Great, keep it working!';
    _wrEl('wr-feedback-sub').textContent = 'Consistency builds champions.';
  }
  document.querySelector('#wr-screen-feedback .btn').textContent =
    isLastEx ? 'See Summary →' : 'Next Exercise →';
  WR._isLastEx = isLastEx;
}

window.continueToNextExercise = () => {
  if (WR._isLastEx) {
    _wrShowSummary();
    return;
  }
  WR.exIdx++;
  _wrShow('exercise');
  _wrRenderExercise();
};

function _wrShowSummary() {
  _wrShow('summary');
  _wrEl('wr-camera-btn').style.display = 'none';
  _wrEl('wr-progress-bar').style.width = '100%';

  const mins = Math.round((Date.now() - WR.startTime) / 60000);
  _wrEl('wr-duration-label').textContent = `Duration: ${mins} min`;

  // Simple achievements: any set where reps > target
  const achievements = WR.setLogs
    .filter(l => l.reps > (WR.exercises[l.exIdx]?.reps || 10))
    .slice(0, 3)
    .map(l => `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2);border-radius:var(--r-md);margin-bottom:8px;font-size:13px;font-weight:600">
      <span>🏅</span> Extra reps on ${WR.exercises[l.exIdx]?.name || 'Exercise'} — Set ${l.setNum}
    </div>`);
  _wrEl('wr-achievements').innerHTML = achievements.join('') || '';
}

window.endWorkout = async () => {
  const notes = _wrEl('wr-notes').value;
  try {
    await window.DB?.addWorkoutLog?.({
      clientId: window.session?.id,
      coachId:  window.session?.coachId,
      date:     new Date().toISOString(),
      exercises: WR.setLogs,
      notes,
      durationMin: Math.round((Date.now() - WR.startTime) / 60000),
    });
  } catch (e) { console.error('endWorkout log error:', e); }
  _closeRunner();
  window.toast('Workout saved! 💪', 'success');
};

window.exitWorkout = () => {
  if (WR.setLogs.length && !confirm('Exit workout? Progress will be lost.')) return;
  _closeRunner();
};

function _closeRunner() {
  const runner = _wrEl('workout-runner');
  runner.style.display = 'none';
  _wrEl('wr-progress-bar').style.width = '0%';
  _wrEl('wr-notes').value = '';
}

window.sendTechnique = () => { _wrEl('wr-technique-input').click(); };

window.uploadTechnique = async (input) => {
  const file = input.files?.[0];
  if (!file) return;
  window.toast('Sending to coach… 📤', 'info');
  try {
    if (window.VideoFormCheck?.uploadAndSubmit) {
      await window.VideoFormCheck.uploadAndSubmit(file, WR.exercises[WR.exIdx]?.name || 'Exercise', window.session?.id);
    }
    window.toast('Sent! Coach will review it.', 'success');
  } catch (e) {
    window.toast('Upload failed. Try again.', 'error');
  }
  input.value = '';
};

// Initialize on load
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ClientProgram };
}
