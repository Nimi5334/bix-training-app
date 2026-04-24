/**
 * Client Analytics
 * Weight tracking, goal setting, and progress visualization
 */

export class ClientAnalytics {
  constructor() {
    this.weightData = [];
    this.goal = null;
    this.currentWeight = null;
  }

  async init() {
    document.addEventListener('sessionReady', () => this.loadAnalytics());
    window.addEventListener('weightUpdated', () => this.loadAnalytics());
  }

  async loadAnalytics() {
    if (!window.session) return;
    try {
      const data = await window.DB.getClientAnalytics(window.session.id);
      this.weightData = data.weightHistory || [];
      this.goal = data.goal || {};
      this.currentWeight = data.currentWeight || 0;
      this.renderGoalSelector();
      this.renderWeightGraph();
      this.renderWeightInput();
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }

  renderGoalSelector() {
    const container = document.getElementById('goal-selector') || this.createGoalSelectorContainer();

    const purposeOptions = ['Losing weight', 'Gaining weight', 'Maintaining weight'];
    container.innerHTML = `
      <div style="margin-bottom: 16px">
        <label style="font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-muted)">Goal Purpose</label>
        <div style="display: flex; gap: 8px; margin-top: 8px">
          ${purposeOptions.map(option => `
            <button
              class="btn ${this.goal.purpose === option ? 'btn-primary' : 'btn-secondary'}"
              onclick="setGoalPurpose('${option}')"
              style="flex: 1; padding: 10px; font-size: 12px"
            >
              ${option}
            </button>
          `).join('')}
        </div>
      </div>

      <div style="margin-bottom: 16px">
        <label style="font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-muted)">Goal Weight (kg)</label>
        <input
          type="number"
          id="goal-weight-input"
          value="${this.goal.targetWeight || ''}"
          placeholder="e.g. 75"
          step="0.1"
          style="width: 100%; padding: 10px; margin-top: 8px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); color: var(--text); font-size: 14px"
          onchange="saveGoalWeight()"
        />
      </div>
    `;
  }

  renderWeightGraph() {
    const container = document.getElementById('weight-graph') || this.createGraphContainer();

    if (this.weightData.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 24px">No weight data yet. Update your weight to start tracking!</p>';
      return;
    }

    const chartHtml = this.createSimpleChart();
    const stats = this.calculateStats();

    container.innerHTML = `
      <div style="background: var(--surface); border-radius: var(--r-lg); padding: 16px; margin-bottom: 16px">
        ${chartHtml}
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
        <div style="background: var(--surface); padding: 12px; border-radius: var(--r-md); text-align: center">
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px">Current</div>
          <div style="font-size: 20px; font-weight: 700; color: var(--text)">${stats.current}kg</div>
        </div>
        <div style="background: var(--surface); padding: 12px; border-radius: var(--r-md); text-align: center">
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px">Goal</div>
          <div style="font-size: 20px; font-weight: 700; color: var(--green)">${this.goal.targetWeight || '—'}kg</div>
        </div>
        <div style="background: var(--surface); padding: 12px; border-radius: var(--r-md); text-align: center">
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px">Progress</div>
          <div style="font-size: 20px; font-weight: 700; color: ${stats.progress >= 0 ? 'var(--green)' : 'var(--amber)'}">${stats.progress > 0 ? '+' : ''}${stats.progress}kg</div>
        </div>
        <div style="background: var(--surface); padding: 12px; border-radius: var(--r-md); text-align: center">
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px">Remaining</div>
          <div style="font-size: 20px; font-weight: 700; color: var(--blue)">${stats.remaining}kg</div>
        </div>
      </div>
    `;
  }

  createSimpleChart() {
    // Simple text-based chart visualization
    const maxWeight = Math.max(...this.weightData.map(d => d.weight), this.goal.targetWeight || 0);
    const minWeight = Math.min(...this.weightData.map(d => d.weight), this.goal.targetWeight || 0);
    const range = maxWeight - minWeight || 1;

    return `
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px">Weight Progress (Last 30 days)</div>
      <div style="display: flex; align-items: flex-end; gap: 4px; height: 100px">
        ${this.weightData.slice(-10).map(data => {
          const height = ((data.weight - minWeight) / range) * 100;
          return `
            <div
              style="flex: 1; background: var(--purple); border-radius: 4px 4px 0 0; height: ${height}%; min-height: 4px; position: relative"
              title="${data.weight}kg on ${new Date(data.date).toLocaleDateString()}"
            ></div>
          `;
        }).join('')}
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 8px">
        <span>${minWeight.toFixed(1)}kg</span>
        <span>${maxWeight.toFixed(1)}kg</span>
      </div>
    `;
  }

  calculateStats() {
    const startWeight = this.weightData[0]?.weight || this.currentWeight;
    const currentWeight = this.currentWeight;
    const targetWeight = this.goal.targetWeight || currentWeight;

    return {
      current: currentWeight.toFixed(1),
      progress: (startWeight - currentWeight).toFixed(1),
      remaining: Math.abs(currentWeight - targetWeight).toFixed(1)
    };
  }

  renderWeightInput() {
    const container = document.getElementById('weight-input') || this.createWeightInputContainer();

    container.innerHTML = `
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border)">
        <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted)">Update Weight</h3>
        <div style="display: flex; gap: 8px">
          <input
            type="number"
            id="weight-input-field"
            placeholder="e.g. 75.5"
            step="0.1"
            value="${this.currentWeight}"
            style="flex: 1; padding: 10px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); color: var(--text); font-size: 14px"
          />
          <button class="btn btn-primary" onclick="updateWeight()" style="padding: 10px 18px; font-weight: 700">Update</button>
        </div>
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px">📅 You'll get a monthly reminder to update your weight</p>
      </div>
    `;
  }

  createGoalSelectorContainer() {
    const container = document.createElement('div');
    container.id = 'goal-selector';
    const analyticsPage = document.getElementById('page-analytics') || this.createAnalyticsPage();
    analyticsPage.appendChild(container);
    return container;
  }

  createGraphContainer() {
    const container = document.createElement('div');
    container.id = 'weight-graph';
    const analyticsPage = document.getElementById('page-analytics') || this.createAnalyticsPage();
    analyticsPage.appendChild(container);
    return container;
  }

  createWeightInputContainer() {
    const container = document.createElement('div');
    container.id = 'weight-input';
    const analyticsPage = document.getElementById('page-analytics') || this.createAnalyticsPage();
    analyticsPage.appendChild(container);
    return container;
  }

  createAnalyticsPage() {
    const page = document.createElement('div');
    page.className = 'page';
    page.id = 'page-analytics';
    page.style.cssText = 'max-width: 600px';
    const main = document.querySelector('main');
    if (main) main.appendChild(page);
    return page;
  }
}

// Global functions
window.setGoalPurpose = async (purpose) => {
  if (window.clientAnalytics) {
    window.clientAnalytics.goal.purpose = purpose;
    await window.DB.updateClientGoal(window.session.id, { purpose });
    window.clientAnalytics.renderGoalSelector();
  }
};

window.saveGoalWeight = async () => {
  const weight = parseFloat(document.getElementById('goal-weight-input')?.value || 0);
  if (weight <= 0) {
    window.toast('Please enter a valid weight', 'error');
    return;
  }

  try {
    await window.DB.updateClientGoal(window.session.id, { targetWeight: weight });
    window.toast('Goal weight updated! 🎯');
    if (window.clientAnalytics) {
      await window.clientAnalytics.loadAnalytics();
    }
  } catch (err) {
    window.toast('Failed to save goal weight', 'error');
  }
};

window.updateWeight = async () => {
  const weight = parseFloat(document.getElementById('weight-input-field')?.value || 0);
  if (weight <= 0) {
    window.toast('Please enter a valid weight', 'error');
    return;
  }

  try {
    await window.DB.addWeightRecord(window.session.id, weight);
    window.toast('Weight updated! 📊');
    if (window.clientAnalytics) {
      await window.clientAnalytics.loadAnalytics();
    }
  } catch (err) {
    window.toast('Failed to update weight', 'error');
  }
};

// Initialize on load
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ClientAnalytics };
}
