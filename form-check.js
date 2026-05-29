/**
 * Form Check — Phase B
 * Client-side: camera modal, MediaPipe pose estimation, result upload.
 * All analysis runs in the browser — only flags + video URL go to Firestore.
 */

import { analyzeExercise } from './form-rules.js';

let poseLandmarker = null;

async function loadPoseLandmarker() {
  if (poseLandmarker) return poseLandmarker;

  const { PoseLandmarker, FilesetResolver } = await import(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js'
  );

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
  });

  return poseLandmarker;
}

export async function openFormCheck({ exercise, clientId, coachId, workoutLogId }) {
  const modal = document.createElement('div');
  modal.id = 'form-check-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.95);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="max-width:480px;width:100%;text-align:center">
      <h2 style="color:#fff;margin-bottom:8px">📹 Form Check — ${exercise}</h2>
      <p style="color:rgba(255,255,255,.6);font-size:13px;margin-bottom:16px">
        Record 5–10 seconds of a rep. Stand so your full body is visible.
      </p>
      <video id="fc-preview" autoplay muted playsinline style="width:100%;border-radius:12px;background:#000;max-height:300px"></video>
      <div id="fc-status" style="color:rgba(255,255,255,.7);font-size:13px;margin-top:12px">Requesting camera…</div>
      <div style="display:flex;gap:12px;margin-top:16px;justify-content:center">
        <button id="fc-cancel" style="padding:10px 20px;background:rgba(255,255,255,.1);border:none;border-radius:8px;color:#fff;cursor:pointer">Cancel</button>
        <button id="fc-record" disabled style="padding:10px 24px;background:#7850ff;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer">Start Recording</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const video = modal.querySelector('#fc-preview');
  const statusEl = modal.querySelector('#fc-status');
  const recordBtn = modal.querySelector('#fc-record');
  const cancelBtn = modal.querySelector('#fc-cancel');
  let stream;

  cancelBtn.onclick = () => {
    stream?.getTracks().forEach(t => t.stop());
    modal.remove();
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = stream;
    await new Promise(r => { video.onloadedmetadata = r; });
    statusEl.textContent = 'Camera ready. Press Start Recording.';
    recordBtn.disabled = false;
  } catch {
    statusEl.textContent = 'Camera access denied. Enable camera permissions and try again.';
    return;
  }

  // Preload model while user reads instructions
  loadPoseLandmarker().catch(() => {});

  recordBtn.onclick = async () => {
    recordBtn.disabled = true;
    recordBtn.textContent = 'Recording…';
    statusEl.textContent = 'Recording 8 seconds…';

    const chunks = [];
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    } catch {
      recorder = new MediaRecorder(stream);
    }
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start(200);

    // Analyze frames for 8 seconds
    const frameResults = [];
    let lm = null;
    try { lm = await loadPoseLandmarker(); } catch {}

    const analyzeInterval = lm ? setInterval(() => {
      try {
        const result = lm.detectForVideo(video, Date.now());
        if (result.landmarks?.[0]) frameResults.push(result.landmarks[0]);
      } catch {}
    }, 200) : null;

    await new Promise(r => setTimeout(r, 8000));
    if (analyzeInterval) clearInterval(analyzeInterval);

    statusEl.textContent = 'Analyzing form…';
    recorder.stop();
    await new Promise(r => { recorder.onstop = r; });

    // Deduplicate flags across frames
    const allFlags = [];
    frameResults.forEach(landmarks => {
      analyzeExercise(exercise, landmarks).forEach(flag => {
        if (!allFlags.find(f => f.id === flag.id)) allFlags.push(flag);
      });
    });

    statusEl.textContent = 'Uploading…';

    let videoUrl = null;
    let videoPath = null;
    try {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
      videoPath = `form-checks/${clientId}/${Date.now()}.webm`;
      const storageRef = window.firebase?.storage?.()?.ref?.(videoPath);
      if (storageRef) {
        await storageRef.put(blob);
        videoUrl = await storageRef.getDownloadURL();
      }
    } catch { /* video upload optional — analysis result still saves */ }

    const resultId = await window.DB.saveFormCheckResult({
      clientId, coachId, exercise, videoUrl, videoPath,
      flags: allFlags,
      workoutLogId: workoutLogId || null,
      frameCount: frameResults.length,
    });

    await window.DB.saveNotification({
      targetUser: coachId,
      title: `Form video — ${exercise}`,
      message: allFlags.length
        ? `${allFlags.length} flag(s): ${allFlags.map(f => f.id.replace(/_/g, ' ')).join(', ')}`
        : 'No form flags detected — looks good!',
      category: 'form-check',
      type: allFlags.length ? 'warning' : 'success',
      formCheckId: resultId,
    });

    stream.getTracks().forEach(t => t.stop());
    modal.remove();

    window.toast?.(
      allFlags.length
        ? `${allFlags.length} form tip(s) sent to your coach for review.`
        : 'Form looks great! Sent to coach.',
      allFlags.length ? 'info' : 'success'
    );
  };
}
