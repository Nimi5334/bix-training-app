/**
 * PR Card Generator
 * Canvas-based shareable PR card for Instagram/social sharing.
 * Phase C.1 — Engagement Tier 1
 */

/**
 * @param {object} opts
 * @param {string} opts.clientName
 * @param {string} opts.exerciseName
 * @param {number} opts.reps
 * @param {object} [opts.coachBrand]   { displayName, primaryColor }
 * @returns {string} base64 PNG data URL
 */
export function generatePRCard({ clientName, exerciseName, reps, coachBrand = {} }) {
  const canvas = document.createElement('canvas');
  canvas.width  = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  const primary   = coachBrand.primaryColor || '#c8ff00';
  const coachName = coachBrand.displayName  || 'Bix';

  // ── Background ──────────────────────────────────────────
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, 1080, 1080);

  // Subtle noise texture (via tiny random dots)
  ctx.fillStyle = 'rgba(255,255,255,0.015)';
  for (let i = 0; i < 6000; i++) {
    ctx.fillRect(
      Math.random() * 1080,
      Math.random() * 1080,
      1, 1
    );
  }

  // ── Top gradient bar ─────────────────────────────────────
  const topGrad = ctx.createLinearGradient(0, 0, 1080, 0);
  topGrad.addColorStop(0, primary);
  topGrad.addColorStop(1, '#ff6b35');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, 1080, 10);

  // ── Trophy emoji ─────────────────────────────────────────
  ctx.font = '140px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏆', 540, 260);

  // ── "NEW PR" badge pill ───────────────────────────────────
  ctx.fillStyle = primary;
  const pillW = 360, pillH = 64, pillX = 540 - pillW / 2, pillY = 290;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 32);
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 28px "Inter", Arial, sans-serif';
  ctx.fillText('NEW PERSONAL RECORD', 540, pillY + 42);

  // ── Exercise name ─────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 68px "Inter", Arial, sans-serif';
  // Truncate long names
  const maxExLen = 18;
  const exDisplay = exerciseName.length > maxExLen
    ? exerciseName.slice(0, maxExLen - 1) + '…'
    : exerciseName;
  ctx.fillText(exDisplay, 540, 450);

  // ── Rep count ─────────────────────────────────────────────
  ctx.fillStyle = primary;
  ctx.font = 'bold 140px "Inter", Arial, sans-serif';
  ctx.fillText(`${reps}`, 540, 620);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = 'bold 44px "Inter", Arial, sans-serif';
  ctx.fillText('reps', 540, 690);

  // ── Divider ───────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200, 740);
  ctx.lineTo(880, 740);
  ctx.stroke();

  // ── Client name ───────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '38px "Inter", Arial, sans-serif';
  ctx.fillText(clientName, 540, 810);

  // ── Coach brand ───────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '28px "Inter", Arial, sans-serif';
  ctx.fillText(`Coached by ${coachName}`, 540, 920);

  // ── Bottom gradient bar ───────────────────────────────────
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 1070, 1080, 10);

  return canvas.toDataURL('image/png');
}

/**
 * Share or download the PR card.
 * Uses the Web Share API on mobile (with file sharing).
 * Falls back to PNG download on desktop.
 */
export async function sharePRCard({ clientName, exerciseName, reps, coachBrand }) {
  const dataUrl = generatePRCard({ clientName, exerciseName, reps, coachBrand });

  // Try Web Share API with file (supported on mobile Chrome/Safari)
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'bix-pr.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `New PR: ${exerciseName}!`,
          text: `Just hit a new personal record on ${exerciseName} — ${reps} reps! 💪`,
        });
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return; // user cancelled — not an error
    }
  }

  // Fallback: download
  const a = document.createElement('a');
  a.href     = dataUrl;
  a.download = 'bix-pr-card.png';
  a.click();
}
