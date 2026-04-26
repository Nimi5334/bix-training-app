/**
 * Admin Testing Harness — Phase 10
 * Seed dummy clients, run real DB-backed test flows, capture errors as structured bug reports.
 */

export class AdminTesting {
  constructor() {
    this.agents     = [];
    this.bugReports = [];
    this.testResults = [];
    this._errors    = []; // captured during test run
  }

  async init() {
    document.addEventListener('sessionReady', () => this.loadTestingData());
  }

  async loadTestingData() {
    if (!window.session) return;
    try {
      this.agents      = await window.DB.getTestAgents().catch(() => []);
      this.bugReports  = await window.DB.getBugReports().catch(() => []);
      this.testResults = await window.DB.getTestResults().catch(() => []);
      this._render();
    } catch (err) {
      console.error('AdminTesting.loadTestingData error:', err);
      this._render();
    }
  }

  _render() {
    const host = document.getElementById('testing-host');
    if (!host) return;

    const activeAgents  = this.agents.filter(a => a.status === 'active').length;
    const openBugs      = this.bugReports.filter(b => !b.resolved).length;
    const totalTests    = this.testResults.length;
    const lastRun       = this.testResults[0]
      ? new Date(this.testResults[0].createdAt?.seconds * 1000 || this.testResults[0].createdAt).toLocaleString()
      : 'Never';

    host.innerHTML = `
      <!-- Stats tiles -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
        <div style="background:rgba(52,211,153,.07);border:1px solid rgba(52,211,153,.2);border-radius:var(--r-md);padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#34d399" id="agents-active">${activeAgents}</div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-top:4px">Active Agents</div>
        </div>
        <div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:var(--r-md);padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#f87171" id="agents-bugs-found">${openBugs}</div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-top:4px">Open Bugs</div>
        </div>
        <div style="background:rgba(120,80,255,.07);border:1px solid rgba(120,80,255,.2);border-radius:var(--r-md);padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#a488ff" id="agents-tests-run">${totalTests}</div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-top:4px">Tests Run</div>
        </div>
        <div style="background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.2);border-radius:var(--r-md);padding:16px;text-align:center">
          <div style="font-size:13px;font-weight:700;color:#fbbf24">${lastRun}</div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-top:4px">Last Run</div>
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px">
        <button class="btn btn-primary" onclick="window.adminTesting.seedAgents()">+ Seed 10 Test Clients</button>
        <button class="btn btn-secondary" onclick="window.adminTesting.runAllTests()">▶ Run All Tests</button>
        <button class="btn btn-secondary" onclick="window.adminTesting.clearAgents()">🗑 Clear Test Clients</button>
      </div>

      <!-- Agents list -->
      <div style="margin-bottom:24px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px">Test Clients</div>
        <div id="testing-agents-list">
          ${this.agents.length ? this.agents.map(a => this._agentCard(a)).join('') : '<p style="color:var(--text-muted);font-size:13px">No test clients seeded yet.</p>'}
        </div>
      </div>

      <!-- Bug reports -->
      <div>
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px">Bug Reports</div>
        <div id="bug-report-list">
          ${this.bugReports.length ? this.bugReports.slice(0, 10).map(b => this._bugCard(b)).join('') : '<p style="color:var(--text-muted);font-size:13px">No bugs detected.</p>'}
        </div>
      </div>
    `;
  }

  _agentCard(agent) {
    const last = agent.lastTestRun
      ? new Date(agent.lastTestRun?.seconds ? agent.lastTestRun.seconds * 1000 : agent.lastTestRun).toLocaleTimeString()
      : '—';
    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 18px;display:flex;align-items:center;gap:14px;margin-bottom:8px">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🤖</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px">${agent.name}</div>
          <div style="font-size:12px;color:var(--text-muted)">${agent.testsCompleted || 0} tests · ${agent.bugsFound || 0} bugs · last run ${last}</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="window.adminTesting.runSingleTest('${agent.id}')">▶ Run</button>
        <button class="btn btn-secondary btn-sm" style="color:var(--red)" onclick="window.adminTesting.deleteAgent('${agent.id}')">🗑</button>
      </div>`;
  }

  _bugCard(bug) {
    const sev = bug.severity === 'high' ? '#f87171' : bug.severity === 'medium' ? '#fbbf24' : '#a488ff';
    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 18px;margin-bottom:8px${bug.resolved ? ';opacity:.5' : ''}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="font-size:11px;font-weight:700;color:${sev};text-transform:uppercase;letter-spacing:.8px">${bug.severity}</span>
          <span style="font-weight:600;font-size:14px">${bug.title}</span>
          ${bug.resolved ? '<span style="margin-left:auto;font-size:11px;color:var(--green)">✓ Resolved</span>' : ''}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${bug.description?.slice(0, 140) || ''}${(bug.description?.length||0) > 140 ? '…' : ''}</div>
        ${bug.filePath ? `<div style="font-size:11px;color:var(--primary);font-family:monospace">📁 ${bug.filePath}</div>` : ''}
        ${!bug.resolved ? `
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-secondary btn-sm" onclick="window.adminTesting.copyBugReport('${bug.id}')">📋 Copy for Claude</button>
            <button class="btn btn-secondary btn-sm" onclick="window.adminTesting.resolveBug('${bug.id}')">✓ Resolve</button>
          </div>` : ''}
      </div>`;
  }

  async seedAgents() {
    try {
      window.toast('Seeding test clients…', 'info');
      const coachId = window.session.id;
      const uids = [];
      for (let i = 1; i <= 10; i++) {
        const id  = window.DB.genId();
        const expiry = new Date(); expiry.setFullYear(expiry.getFullYear() + 1);
        await window.DB.addUser({
          id, role: 'client', coachId,
          name: `Test Client ${String(i).padStart(2, '0')}`,
          username: `testclient${i}_${Date.now()}`,
          email: `testclient${i}@bix-testing.internal`,
          membershipExpiry: expiry.toISOString().split('T')[0],
          isTestAgent: true, status: 'active',
          testsCompleted: 0, bugsFound: 0,
        });
        uids.push(id);
      }
      // Save UIDs to settings/test_accounts
      await window.DB.updateSettings?.({ testAccounts: uids }).catch(() => {});
      window.toast(`✅ Seeded 10 test clients`, 'success');
      await this.loadTestingData();
    } catch (err) {
      window.toast('Seed failed: ' + err.message, 'error');
    }
  }

  async clearAgents() {
    if (!confirm(`Delete all ${this.agents.length} test clients?`)) return;
    for (const a of this.agents) {
      await window.DB.deleteTestAgent(a.id).catch(() => {});
    }
    window.toast('Test clients cleared', 'success');
    await this.loadTestingData();
  }

  async runAllTests() {
    if (!this.agents.length) { window.toast('No test clients — seed first', 'error'); return; }
    window.toast('Running all tests…', 'info');
    for (const agent of this.agents) await this._runFlows(agent);
    window.toast('✅ All tests complete', 'success');
    await this.loadTestingData();
  }

  async runSingleTest(agentId) {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return;
    window.toast(`Running tests for ${agent.name}…`, 'info');
    await this._runFlows(agent);
    window.toast(`${agent.name}: done`, 'success');
    await this.loadTestingData();
  }

  async _runFlows(agent) {
    const FLOWS = [
      { name: 'Load Program',  file: 'db-extensions.js',    fn: () => window.DB.getClientProgram(agent.id) },
      { name: 'Log Workout',   file: 'db-firebase.js',      fn: () => window.DB.addWorkoutLog({ clientId: agent.id, coachId: window.session.id, date: new Date().toISOString(), exercises: [], durationMin: 1 }) },
      { name: 'Log Weight',    file: 'db-firebase.js',      fn: () => window.DB.logWeight(agent.id, 75) },
      { name: 'Send Message',  file: 'messaging.js',        fn: async () => { const c = await window.DB.getOrCreateConversation(agent.id, window.session.id); return window.DB.sendMessage(c, agent.id, window.session.id, 'Test ping'); } },
      { name: 'Get Analytics', file: 'client-analytics.js', fn: () => window.DB.getClientAnalytics(agent.id) },
    ];

    const results = [];
    for (const flow of FLOWS) {
      const start = Date.now();
      let passed = false, errorMsg = '', stack = '';
      try {
        await flow.fn();
        passed = true;
      } catch (err) {
        errorMsg = err?.message || String(err);
        stack     = err?.stack  || '';
      }
      const duration = Date.now() - start;
      results.push({ flow: flow.name, passed, error: errorMsg, duration });

      if (!passed) {
        await window.DB.createBugReport({
          title:       `${flow.name} failed`,
          description: errorMsg,
          filePath:    flow.file,
          stack:       stack.slice(0, 800),
          severity:    flow.name === 'Send Message' || flow.name === 'Log Workout' ? 'high' : 'medium',
          detectedBy:  agent.name,
          detectedAt:  new Date(),
          resolved:    false,
          reproSteps:  `1. Open ${flow.file}\n2. Call ${flow.name} with clientId=${agent.id}\n3. Error: ${errorMsg}`,
        }).catch(() => {});
      }
    }

    const passed = results.filter(r => r.passed).length;
    await window.DB.updateTestAgent(agent.id, {
      testsCompleted: (agent.testsCompleted || 0) + FLOWS.length,
      bugsFound:      (agent.bugsFound  || 0)  + results.filter(r => !r.passed).length,
      lastTestRun:    new Date(),
    }).catch(() => {});

    await window.DB.createBugReport && window.DB.updateSettings?.({
      [`testResults_${agent.id}`]: { passed, total: FLOWS.length, ts: new Date().toISOString() }
    }).catch(() => {});
  }

  async resolveBug(bugId) {
    await window.DB.updateBugReport(bugId, { resolved: true, resolvedAt: new Date() });
    window.toast('Bug resolved ✅', 'success');
    await this.loadTestingData();
  }

  async deleteAgent(agentId) {
    if (!confirm('Delete this test client?')) return;
    await window.DB.deleteTestAgent(agentId);
    await this.loadTestingData();
  }

  async copyBugReport(bugId) {
    const bug = this.bugReports.find(b => b.id === bugId);
    if (!bug) return;
    const text = `## Bug Report\n**Title:** ${bug.title}\n**File:** ${bug.filePath || 'unknown'}\n**Severity:** ${bug.severity}\n\n**Description:**\n${bug.description}\n\n**Repro Steps:**\n${bug.reproSteps || 'See description'}\n\n**Stack:**\n\`\`\`\n${bug.stack || 'N/A'}\n\`\`\``;
    try {
      await navigator.clipboard.writeText(text);
      window.toast('Copied — paste into Claude Code', 'success');
    } catch {
      window.toast('Copy failed — check clipboard permissions', 'error');
    }
  }

  formatTimeAgo(date) {
    if (!date) return 'recently';
    const h = Math.floor((Date.now() - new Date(date)) / 3600000);
    return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.floor(h/24)}d ago`;
  }
}

// Legacy globals expected by admin.html buttons
window.createTestAgents   = () => window.adminTesting?.seedAgents();
window.runAgentTest       = id  => window.adminTesting?.runSingleTest(id);
window.runAllAgentTests   = ()  => window.adminTesting?.runAllTests();
window.deleteAgent        = id  => window.adminTesting?.deleteAgent(id);
window.resolveBug         = id  => window.adminTesting?.resolveBug(id);
window.stopAllAgents      = ()  => window.toast('Stop not needed — tests are synchronous', 'info');
window.viewAgentLogs      = ()  => window.toast('Logs visible in bug reports below', 'info');
window.viewBugReport      = ()  => document.getElementById('bug-report-list')?.scrollIntoView({ behavior: 'smooth' });

if (typeof module !== 'undefined' && module.exports) module.exports = { AdminTesting };
