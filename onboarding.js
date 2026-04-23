/**
 * Bix Coach Onboarding — 4 cinematic screens shown on first login.
 * Matches design handoff: Welcome → Roster → Form Check → Retention.
 *
 * Usage:
 *   import { Onboarding } from './onboarding.js';
 *   Onboarding.maybeShow(coachId);         // gates on DB.getUserById(uid).onboardingCompleted
 *   Onboarding.forceShow(coachId);         // manual replay
 */
import { DB } from './db-firebase.js';

const LS_KEY = 'bix-onb-idx';

function injectStyles() {
  if (document.getElementById('bix-onb-styles')) return;
  const s = document.createElement('style');
  s.id = 'bix-onb-styles';
  s.textContent = `
    .onb-kpi-strip { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin:24px 0 20px; animation: bixFadeUp .55s .05s both; }
    .onb-kpi { padding:12px; border-radius:12px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); backdrop-filter:blur(14px); }
    .onb-kpi .v { font-size:24px; font-weight:800; letter-spacing:-.5px; line-height:1; }
    .onb-kpi .l { font-size:10px; font-weight:600; letter-spacing:.4px; color:rgba(255,255,255,.55); margin-top:6px; text-transform:uppercase; }
    .onb-roster-hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
    .onb-roster-hdr .title { font-size:11px; font-weight:700; color:rgba(255,255,255,.5); letter-spacing:1.5px; }
    .onb-roster-hdr .live { padding:3px 10px; border-radius:999px; background:rgba(255,77,45,.12); border:1px solid rgba(255,77,45,.3); font-size:10px; font-weight:700; color:var(--primary); letter-spacing:.5px; }
    .onb-client-row {
      display:flex; align-items:center; gap:10px;
      padding:10px 12px; border-radius:12px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.06);
      margin-bottom:6px;
      opacity:0; transform:translateY(10px);
      transition: all .4s cubic-bezier(.2,.7,.2,1);
    }
    .onb-client-row.in { opacity:1; transform:translateY(0); }
    .onb-client-row .avatar {
      width:32px; height:32px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:12px; font-weight:800; color:#fff; flex-shrink:0;
    }
    .onb-client-row .name { font-size:13px; font-weight:700; color:#fff; letter-spacing:-.1px; }
    .onb-client-row .streak { font-size:10px; color:rgba(255,255,255,.5); margin-top:1px; }
    .onb-client-row .tag {
      padding:3px 9px; border-radius:6px;
      font-size:10px; font-weight:700; letter-spacing:.3px; white-space:nowrap;
    }

    .onb-video-card {
      border-radius:18px; overflow:hidden;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
      backdrop-filter:blur(16px);
      animation: bixFadeUp .55s .15s both;
    }
    .onb-video-mock {
      position:relative; height:160px;
      background: linear-gradient(160deg, #1a1a22 0%, #0a0a10 100%);
      overflow:hidden;
    }
    .onb-annot {
      position:absolute; padding:3px 8px; border-radius:4px;
      font-size:10px; font-weight:700; letter-spacing:.3px;
      transform: scale(0); transition: transform .3s cubic-bezier(.2,1.4,.4,1);
    }
    .onb-annot.in { transform: scale(1); }
    .onb-annot.caves { left:28%; top:58%; background:var(--primary); color:#fff; }
    .onb-annot.depth { right:22%; top:28%; background:rgba(52,211,153,.9); color:#0a0a10; }
    .onb-timeline { position:absolute; left:12px; right:12px; bottom:10px; height:3px; background:rgba(255,255,255,.15); border-radius:2px; }
    .onb-timeline > span { display:block; height:100%; width:8%; background:var(--primary); border-radius:2px; box-shadow:0 0 8px var(--primary); transition: width 2s linear; }
    .onb-timeline.step1 > span { width: 62%; }
    .onb-timeline.step2 > span { width: 100%; }
    .onb-tag-name {
      position:absolute; top:10px; left:12px;
      padding:3px 8px; border-radius:4px;
      background:rgba(0,0,0,.65); border:1px solid rgba(255,77,45,.4);
      color:var(--primary); font-size:10px; font-weight:700; letter-spacing:.8px;
    }
    .onb-stars { display:flex; gap:4px; align-items:center; margin-bottom:10px; }
    .onb-stars .star { font-size:16px; color:var(--gold); filter: drop-shadow(0 0 4px rgba(250,204,21,.4)); }
    .onb-stars .star.off { color: rgba(255,255,255,.15); filter:none; }
    .onb-feedback {
      padding:10px 12px; border-radius:10px;
      background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06);
      font-size:12px; color:rgba(255,255,255,.85); line-height:1.45; font-weight:500;
    }
    .onb-video-send {
      margin-top:10px; width:100%; padding:11px; border-radius:12px;
      border:none; color:#fff; font-family:inherit;
      font-size:13px; font-weight:700; letter-spacing:-.1px;
      cursor:pointer; transition: all .3s;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%);
      box-shadow: 0 6px 18px rgba(255,77,45,.4);
    }
    .onb-video-send.sent {
      background: rgba(52,211,153,.15);
      color: var(--green);
      border: 1px solid rgba(52,211,153,.4);
      box-shadow: none;
    }
  `;
  document.head.appendChild(s);
}

// ── Screen builders ────────────────────────────────────────────
function screenWelcome() {
  return `
    <div class="onb-screen" data-screen="0">
      <div class="onb-logo-mark"><span>B</span></div>
      <div class="onb-card-stack">
        <div class="onb-mini-card" style="left:0;top:0;z-index:2;transform:rotate(-4deg)">
          <div class="avatar" style="background:linear-gradient(135deg,#7850ff 0%,#fff4 100%)">M</div>
          <div><div class="name">Maya R.</div><div class="sub">12d 🔥</div></div>
        </div>
        <div class="onb-mini-card" style="left:30%;top:10px;z-index:3;transform:rotate(2deg)">
          <div class="avatar" style="background:linear-gradient(135deg,#34d399 0%,#fff4 100%)">D</div>
          <div><div class="name">Dan K.</div><div class="sub">PR today</div></div>
        </div>
        <div class="onb-mini-card" style="left:60%;top:4px;z-index:1;transform:rotate(6deg)">
          <div class="avatar" style="background:linear-gradient(135deg,var(--primary) 0%,#fff4 100%)">S</div>
          <div><div class="name">Sara L.</div><div class="sub">needs reply</div></div>
        </div>
      </div>
      <div style="padding:32px 20px 0;text-align:center">
        <div class="onb-eyebrow">Welcome to Bix</div>
        <h1 class="onb-h1">Coach <span class="accent" data-counter>0</span> clients<br/>without the chaos.</h1>
        <p class="onb-p">Tired of juggling programs in spreadsheets and chasing payments? Bix handles the administration for you — so you can scale your clients with minimal effort.</p>
      </div>
    </div>
  `;
}

function screenRoster() {
  const clients = [
    { n:'Maya Ronen',  s:'active',  k:12, t:'On fire',     c:'#7850ff' },
    { n:'Dan Katz',    s:'active',  k:6,  t:'New PR',       c:'#34d399' },
    { n:'Sara Levi',   s:'risk',    k:0,  t:'3d silent',    c:'var(--primary)' },
    { n:'Omer Bar',    s:'active',  k:21, t:'Best streak',  c:'#3498db' },
    { n:'Noa Tal',     s:'expired', k:0,  t:'Renew',        c:'#ef4444' },
  ];
  const tagBg = s => s==='active' ? 'rgba(52,211,153,.12)' : s==='risk' ? 'rgba(245,158,11,.12)' : 'rgba(239,68,68,.12)';
  const tagFg = s => s==='active' ? '#34d399' : s==='risk' ? '#f59e0b' : '#ef4444';
  return `
    <div class="onb-screen" data-screen="1">
      <div class="onb-kpi-strip">
        <div class="onb-kpi"><div class="v" style="color:#34d399">42</div><div class="l">Active</div></div>
        <div class="onb-kpi"><div class="v" style="color:#f59e0b">3</div><div class="l">At Risk</div></div>
        <div class="onb-kpi"><div class="v" style="color:#ef4444">2</div><div class="l">Expired</div></div>
      </div>
      <div class="onb-roster-hdr"><div class="title">YOUR ROSTER</div><div class="live">LIVE</div></div>
      <div data-roster>
        ${clients.map((c,i) => `
          <div class="onb-client-row" data-i="${i}">
            <div class="avatar" style="background:linear-gradient(135deg, ${c.c} 0%, #fff4 100%)">${c.n.split(' ').map(w=>w[0]).join('')}</div>
            <div style="flex:1;min-width:0">
              <div class="name">${c.n}</div>
              <div class="streak">${c.k>0 ? `🔥 ${c.k}d streak` : '— no activity'}</div>
            </div>
            <div class="tag" style="background:${tagBg(c.s)};color:${tagFg(c.s)}">${c.t}</div>
          </div>
        `).join('')}
      </div>
      <div style="padding:18px 8px 0;text-align:center">
        <div class="feature-pill" style="margin-bottom:12px">Feature 01 · Retention</div>
        <h1 class="onb-h1" style="font-size:24px">Spot unsatisfied clients before it costs you.</h1>
        <p class="onb-p">Bix tracks every client's check-in pattern and surfaces at-risk accounts early — so you can intervene before they cancel.</p>
      </div>
    </div>
  `;
}

function screenFormCheck() {
  return `
    <div class="onb-screen" data-screen="2">
      <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 14px;animation:bixFadeUp .55s both">
        <div>
          <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:1.5px">REVIEW QUEUE</div>
          <div style="font-size:19px;font-weight:800;color:#fff;margin-top:4px;letter-spacing:-.4px">
            2 videos <span style="color:var(--primary)">waiting</span>
          </div>
        </div>
        <div style="padding:5px 11px;border-radius:999px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.35);font-size:10px;font-weight:700;color:#f59e0b;letter-spacing:.5px">⏱ &lt; 24h</div>
      </div>

      <div class="onb-video-card">
        <div class="onb-video-mock">
          <svg viewBox="0 0 360 160" style="position:absolute;inset:0;width:100%;height:100%">
            <rect x="130" y="60" width="100" height="4" rx="1.5" fill="#888"/>
            <rect x="120" y="54" width="12" height="16" rx="2" fill="#aaa"/>
            <rect x="228" y="54" width="12" height="16" rx="2" fill="#aaa"/>
            <circle cx="180" cy="48" r="10" fill="#2a2a35"/>
            <path d="M165 66 L195 66 L197 102 L163 102 Z" fill="#2a2a35"/>
            <path d="M163 100 L155 136 L172 138 L175 102 Z" fill="#2a2a35"/>
            <path d="M197 100 L205 136 L188 138 L185 102 Z" fill="#2a2a35"/>
            <circle cx="180" cy="48" r="3.5" fill="var(--primary)" opacity=".9"/>
            <circle cx="165" cy="68" r="3.5" fill="var(--primary)" opacity=".9"/>
            <circle cx="195" cy="68" r="3.5" fill="var(--primary)" opacity=".9"/>
            <circle cx="163" cy="102" r="3.5" fill="var(--primary)" opacity=".9"/>
            <circle cx="197" cy="102" r="3.5" fill="var(--primary)" opacity=".9"/>
          </svg>
          <div class="onb-tag-name">DAN K · BACK SQUAT</div>
          <div class="onb-annot caves" data-annot>KNEE CAVES ›</div>
          <div class="onb-annot depth" data-annot>DEPTH ✓</div>
          <div class="onb-timeline" data-timeline><span></span></div>
        </div>
        <div style="padding:14px 14px 16px">
          <div class="onb-stars">
            <span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star">★</span><span class="star off">★</span>
            <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,.5);font-weight:600">4/5 · 12m ago</span>
          </div>
          <div class="onb-feedback">Good depth. Knees drift in at rep 3 — brace harder, push floor apart.</div>
          <button class="onb-video-send" data-send>Send feedback</button>
        </div>
      </div>

      <div style="display:flex;gap:6px;margin-top:12px;animation:bixFadeUp .55s .3s both">
        <div style="flex:1;padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);font-size:11px">
          <div style="font-weight:700;color:#fff">Maya R.</div>
          <div style="color:rgba(255,255,255,.5);margin-top:2px">Deadlift · 1h</div>
        </div>
        <div style="flex:1;padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);font-size:11px">
          <div style="font-weight:700;color:#fff">Omer B.</div>
          <div style="color:rgba(255,255,255,.5);margin-top:2px">Bench Press · 3h</div>
        </div>
      </div>

      <div style="padding:18px 8px 0;text-align:center;margin-top:auto">
        <div class="feature-pill" style="margin-bottom:12px">Feature 02 · Form Check</div>
        <h1 class="onb-h1" style="font-size:24px">Review 10 lifts in a glance.</h1>
        <p class="onb-p">Clients film, AI pre-annotates. You rate, reply, and move on.</p>
      </div>
    </div>
  `;
}

function screenRetention() {
  return `
    <div class="onb-screen" data-screen="3">
      <div class="insight-banner" style="margin-top:8px">
        <div class="insight-icon">✨</div>
        <div style="flex:1">
          <div class="insight-eyebrow">Daily Insight · 07:24</div>
          <div class="insight-copy">3 clients haven't logged in 5+ days. A quick nudge today recovers 78% of them.</div>
          <button class="insight-cta">Send check-in →</button>
        </div>
      </div>

      <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:1.5px;margin:4px 0 10px">RETENTION RADAR</div>

      <div class="alert-row amber" data-alert="0" style="opacity:0;transform:translateX(-12px)">
        <div class="alert-icon">⏳</div>
        <div style="flex:1;min-width:0">
          <div class="alert-title">Sara Levi</div>
          <div class="alert-sub">3 days silent · last workout Tue</div>
        </div>
        <button class="alert-btn">Message</button>
      </div>
      <div class="alert-row red" data-alert="1" style="opacity:0;transform:translateX(-12px)">
        <div class="alert-icon">📅</div>
        <div style="flex:1;min-width:0">
          <div class="alert-title">Noa Tal</div>
          <div class="alert-sub">Membership expires in 4 days</div>
        </div>
        <button class="alert-btn">Renew</button>
      </div>
      <div class="alert-row green" data-alert="2" style="opacity:0;transform:translateX(-12px)">
        <div class="alert-icon">🏆</div>
        <div style="flex:1;min-width:0">
          <div class="alert-title">Omer Bar</div>
          <div class="alert-sub">Hit new PR · 140kg deadlift</div>
        </div>
        <button class="alert-btn">Celebrate</button>
      </div>

      <div style="padding:22px 8px 0;text-align:center;margin-top:auto">
        <div class="feature-pill" style="margin-bottom:12px">Feature 03 · Retention</div>
        <h1 class="onb-h1" style="font-size:24px">Stop losing clients silently.</h1>
        <p class="onb-p">Bix flags silent clients and expiring memberships before churn happens — plus one-tap actions.</p>
      </div>
    </div>
  `;
}

function buildOverlay() {
  let el = document.getElementById('bix-onb-overlay');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'bix-onb-overlay';
  el.className = 'onb-overlay';
  el.innerHTML = `
    <button class="onb-skip" aria-label="Skip">Skip</button>
    <div class="onb-stage">
      <div style="flex:1;position:relative;overflow:hidden">
        ${screenWelcome()}
        ${screenRoster()}
        ${screenFormCheck()}
        ${screenRetention()}
      </div>
      <div class="onb-dots" role="tablist">
        ${[0,1,2,3].map(i => `<button class="onb-dot" data-dot="${i}" aria-label="Screen ${i+1}"><span></span></button>`).join('')}
      </div>
      <div class="onb-cta-row">
        <button class="onb-back" aria-label="Back">‹</button>
        <button class="onb-next">Continue →</button>
      </div>
    </div>
    <div class="onb-finish" id="onb-finish">
      <div class="check">✓</div>
      <h1>Your studio is ready</h1>
      <p>Add your first client and Bix will set up programs, form-check, and billing automatically.</p>
      <button class="btn btn-secondary" data-replay>↺ Replay onboarding</button>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}

// ── Per-screen animators ───────────────────────────────────────
function animateWelcome(root) {
  const counter = root.querySelector('[data-counter]');
  if (!counter) return;
  let n = 0;
  const target = 47;
  const iv = setInterval(() => {
    n += 1;
    counter.textContent = n;
    if (n >= target) clearInterval(iv);
  }, 30);
}
function animateRoster(root) {
  root.querySelectorAll('.onb-client-row').forEach((row, i) => {
    setTimeout(() => row.classList.add('in'), 180 + i * 120);
  });
}
function animateFormCheck(root) {
  const timeline = root.querySelector('[data-timeline]');
  const sendBtn = root.querySelector('[data-send]');
  setTimeout(() => {
    root.querySelectorAll('[data-annot]').forEach(a => a.classList.add('in'));
    if (timeline) timeline.classList.add('step1');
  }, 500);
  setTimeout(() => {
    if (timeline) { timeline.classList.remove('step1'); timeline.classList.add('step2'); }
    if (sendBtn) {
      sendBtn.classList.add('sent');
      sendBtn.textContent = '✓ Sent to Dan';
    }
  }, 2600);
}
function animateRetention(root) {
  const rows = root.querySelectorAll('[data-alert]');
  rows.forEach((r, i) => {
    setTimeout(() => {
      r.style.opacity = '1';
      r.style.transform = 'translateX(0)';
      r.style.transition = 'all .45s cubic-bezier(.2,.7,.2,1)';
    }, 250 + i * 450);
  });
}

// ── Controller ─────────────────────────────────────────────────
class OnboardingController {
  constructor(overlay, coachId) {
    this.overlay = overlay;
    this.coachId = coachId;
    const saved = parseInt(localStorage.getItem(LS_KEY) || '0', 10);
    this.idx = Number.isFinite(saved) ? Math.min(3, Math.max(0, saved)) : 0;
    this.finished = false;
    this._onKey = this._onKey.bind(this);
    this._wire();
    this.renderIdx();
  }
  _wire() {
    this.overlay.querySelector('.onb-skip').addEventListener('click', () => this.finish());
    this.overlay.querySelector('.onb-back').addEventListener('click', () => this.prev());
    this.overlay.querySelector('.onb-next').addEventListener('click', () => this.next());
    this.overlay.querySelectorAll('.onb-dot').forEach(d => {
      d.addEventListener('click', () => this.goto(parseInt(d.dataset.dot, 10)));
    });
    this.overlay.querySelector('[data-replay]').addEventListener('click', () => this.replay());
    window.addEventListener('keydown', this._onKey);
  }
  _onKey(e) {
    if (this.finished) return;
    if (e.key === 'ArrowRight') this.next();
    if (e.key === 'ArrowLeft')  this.prev();
    if (e.key === 'Escape')     this.finish();
  }
  renderIdx() {
    const screens = this.overlay.querySelectorAll('.onb-screen');
    screens.forEach((s, i) => s.classList.toggle('active', i === this.idx));
    this.overlay.querySelectorAll('.onb-dot').forEach((d, i) => {
      d.classList.toggle('active', i === this.idx);
    });
    this.overlay.querySelector('.onb-back').disabled = this.idx === 0;
    this.overlay.querySelector('.onb-next').innerHTML = this.idx < 3
      ? 'Continue →'
      : "Let's go →";

    const active = screens[this.idx];
    // reset transient per-screen state
    if (this.idx === 0) animateWelcome(active);
    if (this.idx === 1) {
      active.querySelectorAll('.onb-client-row').forEach(r => r.classList.remove('in'));
      animateRoster(active);
    }
    if (this.idx === 2) {
      active.querySelectorAll('[data-annot]').forEach(a => a.classList.remove('in'));
      const tl = active.querySelector('[data-timeline]');
      if (tl) tl.classList.remove('step1', 'step2');
      const btn = active.querySelector('[data-send]');
      if (btn) { btn.classList.remove('sent'); btn.textContent = 'Send feedback'; }
      animateFormCheck(active);
    }
    if (this.idx === 3) {
      active.querySelectorAll('[data-alert]').forEach(r => {
        r.style.opacity = '0';
        r.style.transform = 'translateX(-12px)';
      });
      animateRetention(active);
    }

    localStorage.setItem(LS_KEY, String(this.idx));
  }
  next() {
    if (this.idx < 3) { this.idx++; this.renderIdx(); }
    else this.finish();
  }
  prev() { if (this.idx > 0) { this.idx--; this.renderIdx(); } }
  goto(i) { this.idx = Math.min(3, Math.max(0, i)); this.renderIdx(); }
  async finish() {
    this.finished = true;
    const finishEl = document.getElementById('onb-finish');
    if (finishEl) finishEl.classList.add('open');
    // persist to DB + localStorage
    localStorage.setItem(LS_KEY, '0');
    if (this.coachId && DB.updateUser) {
      try {
        await DB.updateUser(this.coachId, { onboardingCompleted: true, onboardingCompletedAt: new Date().toISOString() });
      } catch (e) { console.warn('[onb] save failed', e); }
    }
    // auto-dismiss after a tick
    setTimeout(() => this.dismiss(), 3500);
  }
  replay() {
    const finishEl = document.getElementById('onb-finish');
    if (finishEl) finishEl.classList.remove('open');
    this.finished = false;
    this.idx = 0;
    this.renderIdx();
  }
  dismiss() {
    window.removeEventListener('keydown', this._onKey);
    this.overlay.classList.remove('open');
    setTimeout(() => { try { this.overlay.remove(); } catch {} }, 320);
  }
}

// ── Public API ─────────────────────────────────────────────────
export async function maybeShow(coachId) {
  if (!coachId) return false;
  try {
    const u = await DB.getUserById(coachId);
    if (u?.onboardingCompleted) return false;
  } catch (e) { /* allow showing on fetch error */ }
  return forceShow(coachId);
}

export function forceShow(coachId) {
  injectStyles();
  const ov = buildOverlay();
  ov.classList.add('open');
  new OnboardingController(ov, coachId);
  return true;
}

export const Onboarding = { maybeShow, forceShow };
if (typeof window !== 'undefined') window.Onboarding = Onboarding;
