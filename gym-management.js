/**
 * Gym Management UI — Phase D
 * Create/join gym, view invite code, manage coaches, custom domain, internal chat.
 * Pro tier only. Max 5 coaches per gym.
 */

export async function renderGymManagement(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const coachId = window.DB.getSession().id;
  const gym = await window.DB.getGymByCoach(coachId);

  if (!gym) {
    renderCreateOrJoin(container, coachId);
  } else {
    await renderGymDashboard(container, gym, coachId);
  }
}

function renderCreateOrJoin(container, coachId) {
  container.innerHTML = `
    <div style="max-width:480px">
      <h2 style="margin-bottom:4px">Multi-Coach Gym</h2>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:20px">
        Create a gym to add up to 4 more coaches. Share one invite code — coaches join with it.
      </p>
      <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px">
        <h3 style="margin:0 0 12px;font-size:14px">Create a New Gym</h3>
        <input id="gym-name-input" type="text" placeholder="Gym name (e.g. FitLab)"
          style="width:100%;padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;box-sizing:border-box;margin-bottom:10px" />
        <button onclick="createGym()" class="btn btn-primary" style="width:100%">Create Gym</button>
      </div>
      <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:12px;padding:20px">
        <h3 style="margin:0 0 12px;font-size:14px">Join an Existing Gym</h3>
        <input id="gym-invite-input" type="text" placeholder="6-digit invite code" maxlength="6"
          style="width:100%;padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;box-sizing:border-box;margin-bottom:10px;text-transform:uppercase" />
        <button onclick="joinGym()" class="btn btn-secondary" style="width:100%">Join Gym</button>
      </div>
    </div>
  `;
}

async function renderGymDashboard(container, gym, coachId) {
  const coaches = await window.DB.getGymCoaches(gym.id);
  const clients = await window.DB.getGymClients(gym.id);
  const isOwner = gym.ownerId === coachId;

  container.innerHTML = `
    <div style="max-width:700px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <h2 style="margin:0">${gym.name}</h2>
          <span style="font-size:12px;color:var(--text-muted)">${coaches.length}/5 coaches · ${clients.length} total clients</span>
        </div>
        ${isOwner ? '<span style="font-size:11px;background:rgba(120,80,255,.2);color:var(--primary);padding:4px 10px;border-radius:999px">Owner</span>' : ''}
      </div>

      ${isOwner ? `
        <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">Invite code — share with coaches to join</div>
          <div style="display:flex;align-items:center;gap:10px">
            <code style="font-size:22px;font-weight:800;letter-spacing:4px;color:var(--primary)">${gym.inviteCode}</code>
            <button onclick="navigator.clipboard.writeText('${gym.inviteCode}');window.toast?.('Copied!','success')" class="btn btn-secondary btn-sm">Copy</button>
          </div>
        </div>
      ` : ''}

      <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px">
        <h3 style="margin:0 0 12px;font-size:14px">Coaches (${coaches.length}/5)</h3>
        ${coaches.map(c => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)">
            <span style="font-size:13px;font-weight:600">${c.name || c.email || c.id}</span>
            ${c.id === gym.ownerId ? '<span style="font-size:11px;color:var(--text-muted)">Owner</span>' : ''}
          </div>`).join('')}
      </div>

      ${isOwner ? `
        <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px">
          <h3 style="margin:0 0 8px;font-size:14px">Custom Domain</h3>
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Point your domain CNAME to <code>bix.app</code>, then enter it here.</p>
          <div style="display:flex;gap:8px">
            <input id="custom-domain-input" type="text" value="${gym.customDomain || ''}" placeholder="app.yourgym.com"
              style="flex:1;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px" />
            <button onclick="saveCustomDomain('${gym.id}')" class="btn btn-secondary btn-sm">Save</button>
          </div>
        </div>
      ` : ''}

      ${isOwner ? `
      <div style="margin-top:16px">
        <button onclick="openGymRevenueDashboard('${gym.id}','gym-management-container')" class="btn btn-secondary" style="width:100%">📊 View Revenue Dashboard</button>
      </div>
      ` : ''}

      <div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:12px;padding:16px">
        <h3 style="margin:0 0 12px;font-size:14px">💬 Coach Chat (Internal)</h3>
        <div id="gym-chat-messages" style="height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:10px;padding:4px"></div>
        <div style="display:flex;gap:8px">
          <input id="gym-chat-input" type="text" placeholder="Message coaches…"
            style="flex:1;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px"
            onkeydown="if(event.key==='Enter')sendGymChat('${gym.id}')" />
          <button onclick="sendGymChat('${gym.id}')" class="btn btn-primary btn-sm">Send</button>
        </div>
      </div>
    </div>
  `;

  loadGymChat(gym.id);
}

async function loadGymChat(gymId) {
  const msgs = await window.DB.getGymChatMessages(gymId).catch(() => []);
  const el = document.getElementById('gym-chat-messages');
  if (!el) return;
  el.innerHTML = msgs.map(m => `
    <div style="font-size:13px"><strong>${m.senderName || 'Coach'}:</strong> <span style="color:var(--text-muted)">${m.text}</span></div>
  `).join('');
  el.scrollTop = el.scrollHeight;
}

window.createGym = async function() {
  const name = document.getElementById('gym-name-input')?.value?.trim();
  if (!name) { window.toast?.('Enter a gym name', 'error'); return; }

  const ok = await window.requirePro?.('multi-coach');
  if (ok === false) return;

  try {
    const coachId = window.DB.getSession().id;
    await window.DB.createGym(coachId, name);
    window.toast?.('Gym created!', 'success');
    location.reload();
  } catch (err) {
    window.toast?.(`Failed: ${err.message}`, 'error');
  }
};

window.joinGym = async function() {
  const code = document.getElementById('gym-invite-input')?.value?.trim().toUpperCase();
  if (!code || code.length !== 6) { window.toast?.('Enter a 6-character invite code', 'error'); return; }

  const ok = await window.requirePro?.('multi-coach');
  if (ok === false) return;

  try {
    const coachId = window.DB.getSession().id;
    const { gymName } = await window.DB.joinGymByInviteCode(coachId, code);
    window.toast?.(`Joined ${gymName}!`, 'success');
    location.reload();
  } catch (err) {
    window.toast?.(`Failed: ${err.message}`, 'error');
  }
};

window.saveCustomDomain = async function(gymId) {
  const domain = document.getElementById('custom-domain-input')?.value?.trim();
  await window.DB.setCustomDomain(gymId, domain || null);
  window.toast?.('Custom domain saved.', 'success');
};

window.sendGymChat = async function(gymId) {
  const input = document.getElementById('gym-chat-input');
  const text = input?.value?.trim();
  if (!text) return;
  input.value = '';
  const session = window.DB.getSession();
  await window.DB.sendGymChatMessage(gymId, session.id, session.name || 'Coach', text);
  loadGymChat(gymId);
};

// Expose revenue dashboard for gym owners
window.openGymRevenueDashboard = async function(gymId, containerId) {
  const { renderGymRevenueDashboard } = await import('./gym-dashboard.js');
  await renderGymRevenueDashboard(containerId, gymId);
};
