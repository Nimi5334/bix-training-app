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

// Workout Flow State
let currentWorkoutState = {
  program: null,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  setData: [],
  startTime: null,
  exercises: []
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
  if (!window.clientProgram?.program) {
    window.toast('No program loaded', 'error');
    return;
  }

  // Prepare workout state from current week
  const weekData = window.clientProgram.program.weeks?.[window.clientProgram.currentWeek - 1] || {};
  currentWorkoutState.exercises = weekData.days
    ?.flatMap(day => day.exercises || [])
    ?.filter(ex => ex) || [];

  if (currentWorkoutState.exercises.length === 0) {
    window.toast('No exercises for this week', 'error');
    return;
  }

  currentWorkoutState.startTime = new Date();
  currentWorkoutState.currentExerciseIndex = 0;
  currentWorkoutState.currentSetIndex = 0;
  currentWorkoutState.setData = [];

  openWorkoutModal();
};

window.openWorkoutModal = () => {
  // TODO: Open workout flow modal
  window.toast('Starting workout... 🏋️', 'success');
};

// Initialize on load
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ClientProgram };
}
