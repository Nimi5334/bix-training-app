/**
 * Real-Time Messaging Module
 * Coach ↔ Client chat using Firestore real-time listeners
 * Usage: MessagingUI.open(currentUser, otherUser) or MessagingUI.renderInbox(container, currentUser)
 */
import { DB } from './db-firebase.js';

let activeConvUnsub = null;
let activeInboxUnsub = null;

// ── Styles (injected once) ──
function injectStyles() {
  if (document.getElementById('bix-messaging-styles')) return;
  const style = document.createElement('style');
  style.id = 'bix-messaging-styles';
  style.textContent = `
    .bix-chat-wrap {
      display: flex; flex-direction: column;
      height: min(70vh, 600px);
      background: var(--surface, #1a1a1a);
      border-radius: 12px;
      border: 1px solid var(--border, #333);
      overflow: hidden;
    }
    .bix-chat-header {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border, #333);
      display: flex; align-items: center; gap: 12px;
      background: var(--surface2, #222);
    }
    .bix-chat-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--primary, #e8442a);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; color: #fff; font-size: 15px;
    }
    .bix-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .bix-msg {
      max-width: 75%; padding: 10px 14px; border-radius: 16px;
      font-size: 14px; line-height: 1.4; word-wrap: break-word;
    }
    .bix-msg.mine {
      align-self: flex-end;
      background: var(--primary, #e8442a);
      color: #fff; border-bottom-right-radius: 4px;
    }
    .bix-msg.theirs {
      align-self: flex-start;
      background: var(--surface2, #2a2a2a);
      color: var(--text, #fff); border-bottom-left-radius: 4px;
    }
    .bix-msg-time {
      font-size: 10px; opacity: 0.6;
      margin-top: 4px; text-align: right;
    }
    .bix-chat-input-row {
      padding: 12px; border-top: 1px solid var(--border, #333);
      display: flex; gap: 8px; background: var(--surface2, #222);
    }
    .bix-chat-input {
      flex: 1; background: var(--bg, #0f0f0f);
      border: 1px solid var(--border, #333); border-radius: 20px;
      padding: 10px 16px; color: var(--text, #fff);
      font-size: 14px; outline: none; resize: none;
      font-family: inherit;
    }
    .bix-chat-send {
      background: var(--primary, #e8442a);
      border: none; border-radius: 50%;
      width: 40px; height: 40px; cursor: pointer;
      color: #fff; font-size: 16px; display: flex;
      align-items: center; justify-content: center;
    }
    .bix-chat-send:disabled { opacity: 0.4; cursor: not-allowed; }
    .bix-inbox-row {
      display: flex; gap: 12px; align-items: center;
      padding: 12px 14px; border-bottom: 1px solid var(--border, #333);
      cursor: pointer; transition: background .15s;
    }
    .bix-inbox-row:hover { background: var(--surface2, #222); }
    .bix-inbox-info { flex: 1; min-width: 0; }
    .bix-inbox-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
    .bix-inbox-preview { font-size: 12px; color: var(--text-muted, #888);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bix-unread-badge {
      background: var(--primary, #e8442a); color: #fff;
      border-radius: 10px; padding: 2px 7px; font-size: 10px; font-weight: 700;
      min-width: 20px; text-align: center;
    }
    .bix-empty { text-align: center; color: var(--text-muted, #888);
      padding: 40px 20px; font-size: 13px; }
  `;
  document.head.appendChild(style);
}

// ── Timestamp helpers ──
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd';
  return d.toLocaleDateString();
}

// ── Render inbox list (for coach, showing all clients) ──
export async function renderInbox(containerId, currentUserId) {
  injectStyles();
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div class="bix-empty">Loading conversations...</div>';

  // Get list of conversation partners (clients for coach, coach for client)
  const currentUser = await DB.getUserById(currentUserId);
  let partners = [];
  let globalCoachId = null;
  if (currentUser.role === 'coach' || currentUser.role === 'admin') {
    partners = await DB.getClientsByCoach(currentUserId);
    globalCoachId = currentUserId;
    await DB.ensureGlobalChannel?.(currentUserId);
  } else if (currentUser.role === 'client' && currentUser.coachId) {
    const coach = await DB.getUserById(currentUser.coachId);
    if (coach) partners = [coach];
    globalCoachId = currentUser.coachId;
  }

  // Clean up previous subscription
  if (activeInboxUnsub) { activeInboxUnsub(); activeInboxUnsub = null; }

  // Subscribe to conversation updates for live unread badges
  activeInboxUnsub = DB.subscribeToConversations(currentUserId, (convs) => {
    const convsByPartner = {};
    convs.forEach(c => {
      const partner = c.participants.find(p => p !== currentUserId);
      if (partner) convsByPartner[partner] = c;
    });

    if (!partners.length) {
      el.innerHTML = '<div class="bix-empty">No conversations yet.<br/>Add members to start chatting.</div>';
      return;
    }

    // Global channel row (always first)
    const globalRow = globalCoachId ? `
      <div class="bix-inbox-row" id="global-channel-row" style="border-left:3px solid var(--primary)">
        <div class="bix-chat-avatar" style="background:linear-gradient(135deg,var(--primary),var(--primary-2));font-size:18px">🌐</div>
        <div class="bix-inbox-info">
          <div class="bix-inbox-name">Global Chat</div>
          <div class="bix-inbox-preview">All members</div>
        </div>
      </div>
    ` : '';

    el.innerHTML = globalRow + partners.map(p => {
      const c = convsByPartner[p.id];
      const preview = c?.lastMessage || 'No messages yet — say hi!';
      const when = c?.lastMessageAt ? fmtRelative(c.lastMessageAt) : '';
      const unread = c?.unreadCount?.[currentUserId] || 0;
      const initials = p.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
      return `
        <div class="bix-inbox-row" data-partner="${p.id}" data-partner-name="${escape(p.name)}">
          <div class="bix-chat-avatar">${initials}</div>
          <div class="bix-inbox-info">
            <div class="bix-inbox-name">${escape(p.name)} ${when ? `<span style="font-size:11px;color:var(--text-muted);font-weight:400">· ${when}</span>` : ''}</div>
            <div class="bix-inbox-preview">${escape(preview)}</div>
          </div>
          ${unread > 0 ? `<div class="bix-unread-badge">${unread}</div>` : ''}
        </div>
      `;
    }).join('');

    if (globalCoachId) {
      el.querySelector('#global-channel-row')?.addEventListener('click', () => {
        openGlobalChat(currentUserId, globalCoachId);
      });
    }
    el.querySelectorAll('.bix-inbox-row:not(#global-channel-row)').forEach(row => {
      row.addEventListener('click', () => {
        const partnerId = row.getAttribute('data-partner');
        const partnerName = unescape(row.getAttribute('data-partner-name'));
        openChat(currentUserId, partnerId, partnerName);
      });
    });
  });
}

// ── Open chat modal with a specific partner ──
export async function openChat(currentUserId, partnerId, partnerName) {
  injectStyles();

  // Create or ensure the modal exists
  let modal = document.getElementById('bix-chat-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bix-chat-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:540px;padding:0;overflow:hidden">
        <div class="bix-chat-wrap">
          <div class="bix-chat-header">
            <div class="bix-chat-avatar" id="bix-chat-avatar"></div>
            <div style="flex:1">
              <div style="font-weight:700" id="bix-chat-name"></div>
              <div style="font-size:11px;color:var(--text-muted)">Online</div>
            </div>
            <button onclick="window.__bixCloseChat()" style="background:none;border:none;color:var(--text);font-size:24px;cursor:pointer;padding:4px 8px">×</button>
          </div>
          <div class="bix-chat-messages" id="bix-chat-messages"></div>
          <div class="bix-chat-input-row">
            <textarea class="bix-chat-input" id="bix-chat-input" placeholder="Type a message..." rows="1"></textarea>
            <button class="bix-chat-send" id="bix-chat-send-btn">➤</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    // Close helper
    window.__bixCloseChat = () => {
      modal.classList.remove('open');
      if (activeConvUnsub) { activeConvUnsub(); activeConvUnsub = null; }
    };
    modal.addEventListener('click', e => {
      if (e.target === modal) window.__bixCloseChat();
    });
  }

  // Set partner info
  const initials = partnerName.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('bix-chat-avatar').textContent = initials;
  document.getElementById('bix-chat-name').textContent = partnerName;
  document.getElementById('bix-chat-messages').innerHTML = '<div class="bix-empty">Loading…</div>';
  modal.classList.add('open');

  // Set up conversation
  const convId = await DB.getOrCreateConversation(currentUserId, partnerId);
  await DB.markConversationRead(convId, currentUserId);

  // Subscribe to messages
  if (activeConvUnsub) activeConvUnsub();
  activeConvUnsub = DB.subscribeToMessages(convId, (msgs) => {
    const container = document.getElementById('bix-chat-messages');
    if (!container) return;
    if (!msgs.length) {
      container.innerHTML = '<div class="bix-empty">No messages yet.<br/>Say hi! 👋</div>';
      return;
    }
    container.innerHTML = msgs.map(m => `
      <div class="bix-msg ${m.senderId === currentUserId ? 'mine' : 'theirs'}">
        ${escape(m.text)}
        <div class="bix-msg-time">${fmtTime(m.timestamp)}</div>
      </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
    // Mark read when viewing
    DB.markConversationRead(convId, currentUserId);
  });

  // Send handler
  const input = document.getElementById('bix-chat-input');
  const sendBtn = document.getElementById('bix-chat-send-btn');
  const doSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendBtn.disabled = true;
    try {
      await DB.sendMessage(convId, currentUserId, partnerId, text);
    } catch (e) {
      if (window.toast) window.toast.error('Failed to send message');
      else alert('Failed to send');
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  };
  sendBtn.onclick = doSend;
  input.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  };
  setTimeout(() => input.focus(), 100);
}

// ── Total unread count for nav badge ──
export function subscribeUnreadCount(userId, callback) {
  return DB.subscribeToConversations(userId, (convs) => {
    const total = convs.reduce((sum, c) => sum + (c.unreadCount?.[userId] || 0), 0);
    callback(total);
  });
}

// Simple escape helpers
function escape(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function unescape(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}

// ── Global Channel Chat ──
let globalUnsub = null;

export function openGlobalChat(currentUserId, coachId) {
  injectStyles();
  let modal = document.getElementById('bix-chat-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bix-chat-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:540px;padding:0;overflow:hidden">
        <div class="bix-chat-wrap">
          <div class="bix-chat-header">
            <div class="bix-chat-avatar" style="background:linear-gradient(135deg,var(--primary),var(--primary-2));font-size:18px">🌐</div>
            <div style="flex:1"><div style="font-weight:700">Global Chat</div><div style="font-size:11px;color:var(--text-muted)">All members</div></div>
            <button onclick="window.__bixCloseChat()" style="background:none;border:none;color:var(--text);font-size:24px;cursor:pointer;padding:4px 8px">×</button>
          </div>
          <div class="bix-chat-messages" id="bix-chat-messages"></div>
          <div class="bix-chat-input-row">
            <textarea class="bix-chat-input" id="bix-chat-input" rows="1" placeholder="Message everyone…"></textarea>
            <button class="bix-chat-send" id="bix-chat-send">➤</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  modal.classList.add('open');

  if (globalUnsub) { globalUnsub(); globalUnsub = null; }
  const msgEl = document.getElementById('bix-chat-messages');
  msgEl.innerHTML = '<div class="bix-empty">Loading…</div>';

  globalUnsub = DB.subscribeToGlobalChannel(coachId, (msgs) => {
    msgEl.innerHTML = msgs.map(m => {
      const mine = m.senderId === currentUserId;
      return `<div class="bix-msg ${mine ? 'mine' : 'theirs'}">
        ${escape(m.text)}
        <div class="bix-msg-time">${fmtTime(m.createdAt)}</div>
      </div>`;
    }).join('') || '<div class="bix-empty">No messages yet.</div>';
    msgEl.scrollTop = msgEl.scrollHeight;
  });

  window.__bixCloseChat = () => {
    modal.classList.remove('open');
    if (globalUnsub) { globalUnsub(); globalUnsub = null; }
  };

  document.getElementById('bix-chat-send').onclick = async () => {
    const inp = document.getElementById('bix-chat-input');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    await DB.postToGlobalChannel(coachId, currentUserId, text);
  };

  modal.onclick = e => { if (e.target === modal) window.__bixCloseChat(); };
}

export const MessagingUI = { renderInbox, openChat, openGlobalChat, subscribeUnreadCount };
if (typeof window !== 'undefined') window.MessagingUI = MessagingUI;
