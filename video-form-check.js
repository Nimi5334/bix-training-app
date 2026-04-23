/**
 * Video Form-Check Module
 * - Client: uploads webcam/phone video of a lift
 * - Coach: reviews pending videos + provides written feedback + star rating
 */
import { DB } from './db-firebase.js';

function injectStyles() {
  if (document.getElementById('bix-video-styles')) return;
  const style = document.createElement('style');
  style.id = 'bix-video-styles';
  style.textContent = `
    .video-tile {
      background: var(--surface2, #1a1a1a);
      border: 1px solid var(--border, #333);
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .video-tile video { width: 100%; border-radius: 8px; background: #000; }
    .video-meta {
      display: flex; justify-content: space-between;
      align-items: center; margin-bottom: 10px;
    }
    .video-status {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      padding: 3px 9px; border-radius: 12px; letter-spacing: 0.5px;
    }
    .video-status.pending { background: #f59e0b33; color: #f59e0b; }
    .video-status.reviewed { background: #10b98133; color: #10b981; }
    .star-rating { display: inline-flex; gap: 2px; }
    .star-rating .star {
      font-size: 20px; cursor: pointer; color: #555; transition: color .15s;
    }
    .star-rating .star.filled { color: #fbbf24; }
  `;
  document.head.appendChild(style);
}

// ── Client-side: Upload widget ──
export function renderUploader(containerId, clientId, coachId) {
  injectStyles();
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div style="background:var(--surface2);border:1px dashed var(--border);border-radius:12px;padding:20px;text-align:center">
      <div style="font-size:36px;margin-bottom:8px">🎥</div>
      <h3 style="font-size:15px;font-weight:700;margin-bottom:6px">Submit Form Check</h3>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">
        Upload a video of your lift — your coach will review & provide feedback.
      </p>
      <div class="form-group" style="text-align:left;max-width:320px;margin:0 auto 12px">
        <label style="font-size:12px;color:var(--text-muted)">Exercise Name</label>
        <input type="text" id="vc-exercise-name" placeholder="e.g. Back Squat" style="width:100%" />
      </div>
      <input type="file" id="vc-file-input" accept="video/*" style="display:none" />
      <button class="btn btn-primary" id="vc-pick-btn">📹 Choose Video</button>
      <div id="vc-status" style="margin-top:14px;font-size:13px"></div>
    </div>`;

  const fileInput = document.getElementById('vc-file-input');
  const pickBtn   = document.getElementById('vc-pick-btn');
  const status    = document.getElementById('vc-status');

  pickBtn.onclick = () => {
    const name = document.getElementById('vc-exercise-name').value.trim();
    if (!name) {
      if (window.toast) window.toast.warn('Enter the exercise name first');
      else alert('Enter exercise name first');
      return;
    }
    fileInput.click();
  };

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const exerciseName = document.getElementById('vc-exercise-name').value.trim();

    // Limit to ~100MB
    if (file.size > 100 * 1024 * 1024) {
      if (window.toast) window.toast.error('Video must be under 100MB');
      else alert('Video must be under 100MB');
      return;
    }

    pickBtn.disabled = true;
    status.innerHTML = '<span style="color:var(--text-muted)">Uploading... this may take a moment</span>';

    try {
      await DB.uploadFormVideo(clientId, file, { exerciseName, coachId });
      status.innerHTML = '<span style="color:#10b981">✅ Uploaded! Your coach will review it soon.</span>';
      if (window.toast) window.toast.success('Video submitted to coach');
      document.getElementById('vc-exercise-name').value = '';
      fileInput.value = '';
      // Refresh the list if it exists
      if (document.getElementById('vc-client-list')) {
        renderClientList('vc-client-list', clientId);
      }
    } catch (e) {
      console.error(e);
      status.innerHTML = '<span style="color:#ef4444">❌ Upload failed. Try again.</span>';
      if (window.toast) window.toast.error('Upload failed');
    } finally {
      pickBtn.disabled = false;
    }
  };
}

// ── Client: list their own submitted videos + feedback ──
export async function renderClientList(containerId, clientId) {
  injectStyles();
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">Loading...</div>';
  const rows = await DB.getVideoReviewsByClient(clientId);
  if (!rows.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">No videos submitted yet.</div>';
    return;
  }
  el.innerHTML = rows.map(r => renderVideoTile(r, false)).join('');
}

// ── Coach: list videos awaiting review ──
export async function renderCoachQueue(containerId, coachId) {
  injectStyles();
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">Loading...</div>';
  const rows = await DB.getVideoReviewsByCoach(coachId);
  if (!rows.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px">No videos to review.<br/>When your clients submit form-checks, they will appear here.</div>';
    return;
  }

  // Get client names
  const clientNames = {};
  for (const r of rows) {
    if (!clientNames[r.clientId]) {
      const u = await DB.getUserById(r.clientId);
      clientNames[r.clientId] = u?.name || 'Unknown';
    }
  }

  el.innerHTML = rows.map(r => renderVideoTile(r, true, clientNames[r.clientId])).join('');

  // Wire up review buttons
  el.querySelectorAll('.vc-review-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-video-id');
      openReviewModal(id);
    });
  });
}

function renderVideoTile(r, isCoach, clientName) {
  const when = new Date(r.uploadedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const stars = r.coachRating ? '⭐'.repeat(r.coachRating) + '☆'.repeat(5 - r.coachRating) : '';
  return `
    <div class="video-tile">
      <div class="video-meta">
        <div>
          <div style="font-weight:700;font-size:14px">${escape(r.exerciseName)}</div>
          <div style="font-size:11px;color:var(--text-muted)">
            ${isCoach && clientName ? `👤 ${escape(clientName)} · ` : ''}${when}
          </div>
        </div>
        <span class="video-status ${r.status}">${r.status}</span>
      </div>
      <video src="${r.videoUrl}" controls preload="metadata"></video>
      ${r.status === 'reviewed' && r.coachFeedback ? `
        <div style="margin-top:12px;padding:12px;background:var(--bg);border-radius:8px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;font-weight:600;text-transform:uppercase">Coach Feedback ${stars ? `· ${stars}` : ''}</div>
          <div style="font-size:13px;line-height:1.5">${escape(r.coachFeedback)}</div>
        </div>` : ''}
      ${isCoach && r.status === 'pending' ? `
        <button class="btn btn-primary btn-sm vc-review-btn" data-video-id="${r.id}" style="margin-top:10px;width:100%">
          ✏️ Review & Send Feedback
        </button>` : ''}
    </div>`;
}

// ── Coach review modal ──
function openReviewModal(videoId) {
  let modal = document.getElementById('vc-review-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'vc-review-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:500px">
        <div class="modal-header">
          <h2>📝 Review Form</h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').classList.remove('open')">×</button>
        </div>
        <div class="form-group">
          <label>Feedback</label>
          <textarea id="vc-feedback-text" rows="5" placeholder="What looks good? What to fix?" style="width:100%"></textarea>
        </div>
        <div class="form-group">
          <label>Form Rating</label>
          <div class="star-rating" id="vc-star-rating">
            ${[1,2,3,4,5].map(n => `<span class="star" data-star="${n}">★</span>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').classList.remove('open')">Cancel</button>
          <button class="btn btn-primary" id="vc-submit-review">Send Feedback</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  let rating = 0;
  modal.querySelectorAll('.star').forEach(s => {
    s.onclick = () => {
      rating = parseInt(s.getAttribute('data-star'));
      modal.querySelectorAll('.star').forEach((st, idx) => {
        st.classList.toggle('filled', idx < rating);
      });
    };
  });

  document.getElementById('vc-feedback-text').value = '';
  modal.querySelectorAll('.star').forEach(s => s.classList.remove('filled'));

  document.getElementById('vc-submit-review').onclick = async () => {
    const feedback = document.getElementById('vc-feedback-text').value.trim();
    if (!feedback) {
      if (window.toast) window.toast.warn('Please write some feedback');
      else alert('Please write feedback');
      return;
    }
    try {
      await DB.reviewFormVideo(videoId, feedback, rating || null);
      modal.classList.remove('open');
      if (window.toast) window.toast.success('Feedback sent!');
      // Refresh the coach queue
      const coachListEl = document.getElementById('vc-coach-list');
      if (coachListEl && window.session) {
        renderCoachQueue('vc-coach-list', window.session.id);
      }
    } catch (e) {
      if (window.toast) window.toast.error('Failed to save review');
      else alert('Failed to save');
    }
  };

  modal.classList.add('open');
}

function escape(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const VideoFormCheck = { renderUploader, renderClientList, renderCoachQueue };
if (typeof window !== 'undefined') window.VideoFormCheck = VideoFormCheck;
