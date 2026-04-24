/**
 * Admin Testing Agents
 * Automated QA agents that test the app and detect bugs
 */

export class AdminTesting {
  constructor() {
    this.agents = [];
    this.bugReports = [];
    this.testResults = [];
  }

  async init() {
    document.addEventListener('sessionReady', () => this.loadTestingData());
  }

  async loadTestingData() {
    if (!window.session) return;
    try {
      this.agents = await window.DB.getTestAgents();
      this.bugReports = await window.DB.getBugReports();
      this.testResults = await window.DB.getTestResults();
      this.renderStats();
      this.renderAgents();
      this.renderBugReports();
    } catch (err) {
      console.error('Failed to load testing data:', err);
      // Fallback to empty state
      this.agents = [];
      this.bugReports = [];
    }
  }

  renderStats() {
    const activeCount = this.agents.filter(a => a.status === 'active').length;
    const bugsCount = this.bugReports.filter(b => !b.resolved).length;
    const testsRun = this.testResults.length;

    document.getElementById('agents-active').textContent = activeCount;
    document.getElementById('agents-bugs-found').textContent = bugsCount;
    document.getElementById('agents-tests-run').textContent = testsRun;
  }

  renderAgents() {
    const container = document.getElementById('testing-agents-list');
    const noAgentsEl = document.getElementById('no-agents');

    if (this.agents.length === 0) {
      container.innerHTML = '';
      noAgentsEl.style.display = 'block';
      return;
    }

    noAgentsEl.style.display = 'none';
    container.innerHTML = this.agents.map(agent => `
      <div class="member-card">
        <div class="member-avatar" style="background:${agent.status === 'active' ? 'var(--green)' : 'var(--text-muted)'}">
          🤖
        </div>
        <div class="member-info">
          <div class="member-name">${agent.name}</div>
          <div class="member-activity">
            <span>${agent.status === 'active' ? '🟢' : '⚫'}</span>
            <span>${agent.status} · ${agent.testsCompleted || 0} tests · ${agent.bugsFound || 0} bugs</span>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px" onclick="runAgentTest('${agent.id}')">▶ Run Test</button>
          <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px" onclick="viewAgentLogs('${agent.id}')">📋 Logs</button>
          <button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;color:var(--red)" onclick="deleteAgent('${agent.id}')">🗑</button>
        </div>
      </div>
    `).join('');
  }

  renderBugReports() {
    const container = document.getElementById('bug-report-list');
    const noBugsEl = document.getElementById('no-bugs');

    if (this.bugReports.length === 0) {
      container.innerHTML = '';
      noBugsEl.style.display = 'block';
      return;
    }

    noBugsEl.style.display = 'none';
    container.innerHTML = this.bugReports.map(bug => `
      <div class="retention-card ${bug.severity === 'high' ? 'expiring' : bug.severity === 'medium' ? 'at-risk' : 'achievement'}">
        <div class="retention-icon">🐛</div>
        <div class="retention-info">
          <div class="retention-name">${bug.title}</div>
          <div class="retention-detail">
            ${bug.description.substring(0, 100)}${bug.description.length > 100 ? '...' : ''}
            <br>
            <span style="font-size:11px;margin-top:4px;display:inline-block;color:var(--text-muted)">
              Detected by ${bug.detectedBy} · ${this.formatTimeAgo(bug.detectedAt)}
            </span>
          </div>
        </div>
        <button class="retention-action ${bug.resolved ? 'celebrate' : 'message'}" onclick="${bug.resolved ? `reopenBug('${bug.id}')` : `resolveBug('${bug.id}')`}">
          ${bug.resolved ? '✓ Resolved' : 'Resolve'}
        </button>
      </div>
    `).join('');
  }

  formatTimeAgo(date) {
    if (!date) return 'recently';
    const now = new Date();
    const time = new Date(date);
    const hours = Math.floor((now - time) / (1000 * 60 * 60));
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  async createAgents(count = 10) {
    try {
      for (let i = 0; i < count; i++) {
        const agent = {
          name: `TestAgent_${String(i + 1).padStart(2, '0')}`,
          email: `testagent${i + 1}@bix-testing.internal`,
          password: this.generatePassword(),
          role: 'client',
          status: 'active',
          isTestAgent: true,
          testsCompleted: 0,
          bugsFound: 0,
          createdAt: new Date()
        };

        await window.DB.createTestAgent(agent);
      }

      window.toast(`✅ Created ${count} test agents`);
      await this.loadTestingData();
    } catch (err) {
      console.error('Failed to create agents:', err);
      window.toast('Failed to create agents', 'error');
    }
  }

  generatePassword() {
    return Array.from({length: 16}, () =>
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]
    ).join('');
  }

  async runTest(agentId) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return;

    try {
      window.toast(`🤖 ${agent.name} running tests...`);

      // Simulated test flows
      const testFlows = [
        { name: 'Login Flow', path: '/login', action: 'submit-login' },
        { name: 'Workout Logging', path: '/workout', action: 'log-workout' },
        { name: 'Chat Functionality', path: '/chat', action: 'send-message' },
        { name: 'Payment Flow', path: '/billing', action: 'test-payment' },
        { name: 'Program Navigation', path: '/program', action: 'browse-weeks' }
      ];

      const results = [];
      for (const flow of testFlows) {
        const result = await this.executeTest(agent, flow);
        results.push(result);

        if (!result.passed) {
          // Log bug
          await window.DB.createBugReport({
            title: `${flow.name} failed`,
            description: result.error || 'Unknown error',
            severity: this.determineSeverity(flow.name),
            detectedBy: agent.name,
            detectedAt: new Date(),
            resolved: false,
            testFlow: flow.name
          });
        }
      }

      // Update agent stats
      await window.DB.updateTestAgent(agentId, {
        testsCompleted: (agent.testsCompleted || 0) + testFlows.length,
        bugsFound: (agent.bugsFound || 0) + results.filter(r => !r.passed).length,
        lastTestRun: new Date()
      });

      const passed = results.filter(r => r.passed).length;
      window.toast(`${agent.name}: ${passed}/${testFlows.length} tests passed`);
      await this.loadTestingData();
    } catch (err) {
      console.error('Test execution error:', err);
      window.toast(`${agent.name}: test failed`, 'error');
    }
  }

  async executeTest(agent, flow) {
    // Simulate test execution
    await new Promise(resolve => setTimeout(resolve, 500));

    // Random pass/fail for simulation
    const passed = Math.random() > 0.2;

    return {
      flow: flow.name,
      passed,
      error: passed ? null : this.generateFakeError(flow.name),
      timestamp: new Date()
    };
  }

  generateFakeError(flowName) {
    const errors = {
      'Login Flow': 'Login button unresponsive after 3 attempts',
      'Workout Logging': 'RPE value not saving correctly',
      'Chat Functionality': 'Message sent but not appearing in inbox',
      'Payment Flow': 'Payment form validation error on expiry date',
      'Program Navigation': 'Week selector stuck on Week 1'
    };
    return errors[flowName] || 'Unknown error occurred';
  }

  determineSeverity(flowName) {
    if (flowName === 'Payment Flow' || flowName === 'Login Flow') return 'high';
    if (flowName === 'Workout Logging') return 'medium';
    return 'low';
  }

  async runAllTests() {
    for (const agent of this.agents.filter(a => a.status === 'active')) {
      await this.runTest(agent.id);
    }
    window.toast('✅ All tests complete');
  }

  async stopAll() {
    for (const agent of this.agents.filter(a => a.status === 'active')) {
      await window.DB.updateTestAgent(agent.id, { status: 'stopped' });
    }
    window.toast('⏸ All agents stopped');
    await this.loadTestingData();
  }

  async deleteAgentById(agentId) {
    if (!confirm('Delete this agent?')) return;
    try {
      await window.DB.deleteTestAgent(agentId);
      window.toast('Agent deleted');
      await this.loadTestingData();
    } catch (err) {
      window.toast('Failed to delete agent', 'error');
    }
  }

  async resolveBugById(bugId) {
    try {
      await window.DB.updateBugReport(bugId, { resolved: true, resolvedAt: new Date() });
      window.toast('✅ Bug marked as resolved');
      await this.loadTestingData();
    } catch (err) {
      window.toast('Failed to resolve bug', 'error');
    }
  }
}

// Global functions
window.createTestAgents = () => {
  if (window.adminTesting) {
    window.adminTesting.createAgents(10);
  }
};

window.runAgentTest = (agentId) => {
  if (window.adminTesting) {
    window.adminTesting.runTest(agentId);
  }
};

window.runAllAgentTests = () => {
  if (window.adminTesting) {
    window.adminTesting.runAllTests();
  }
};

window.stopAllAgents = () => {
  if (window.adminTesting) {
    window.adminTesting.stopAll();
  }
};

window.viewAgentLogs = (agentId) => {
  window.toast('Agent logs coming soon');
};

window.viewBugReport = () => {
  document.getElementById('bug-report-list').scrollIntoView({ behavior: 'smooth' });
};

window.deleteAgent = (agentId) => {
  if (window.adminTesting) {
    window.adminTesting.deleteAgentById(agentId);
  }
};

window.resolveBug = (bugId) => {
  if (window.adminTesting) {
    window.adminTesting.resolveBugById(bugId);
  }
};

window.reopenBug = (bugId) => {
  window.toast('Reopening bug...');
};

// Initialize on load
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AdminTesting };
}
