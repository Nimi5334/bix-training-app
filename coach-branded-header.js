// coach-branded-header.js
// Renders the coach's brand on every client-facing surface.
// Usage: mountCoachBrandedHeader('#header-mount', coachId)

import { mergeCoachBrand } from './coach-brand.js';

export async function mountCoachBrandedHeader(selector, coachId) {
  const el = document.querySelector(selector);
  if (!el) return;

  const brand = await DB.getCoachBrand(coachId);
  el.innerHTML = `
    <header class="coach-brand-header" style="background:${brand.primaryColor};color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;">
      ${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="" style="height:32px;border-radius:6px;">` : ''}
      <span class="coach-brand-name" style="font-weight:700;font-size:18px;">${escapeHtml(brand.displayName)}</span>
    </header>
  `;

  // Apply primary color as CSS variable for the rest of the page
  document.documentElement.style.setProperty('--coach-primary', brand.primaryColor);
  document.documentElement.style.setProperty('--coach-accent', brand.accentColor);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
