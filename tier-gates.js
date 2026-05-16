// tier-gates.js
// Centralized tier check + upgrade modal so feature gates are consistent.

import { DB } from './db-extensions.js';

export const PRO_FEATURES = {
  'save-the-client':   { title: 'One-tap save messages', body: 'Bix drafts the message. You tap Send. Save the client in seconds.' },
  'unlimited-clients': { title: 'Unlimited clients',     body: 'You\'ve hit the 5-client free limit. Go Pro for unlimited.' },
  'remove-bix-footer': { title: 'Remove "powered by Bix"', body: 'Make Bix completely invisible to your clients.' },
  'custom-intake':     { title: 'Custom intake form',    body: 'Add your own questions to client intake.' }
};

export async function requirePro(featureKey) {
  const tier = await DB.getCoachTier(DB.getSession().id);
  if (tier === 'pro' || tier === 'studio') return true;
  showUpgradeModal(featureKey);
  return false;
}

export function showUpgradeModal(featureKey) {
  const feature = PRO_FEATURES[featureKey] || { title: 'Pro feature', body: 'Upgrade to unlock.' };
  const dialog = document.createElement('dialog');
  dialog.style.cssText = 'border:1px solid var(--border);border-radius:12px;padding:24px;max-width:400px;background:var(--bg);color:var(--text)';
  dialog.innerHTML = `
    <h2 style="margin-top:0">${feature.title}</h2>
    <p style="color:var(--text-muted)">${feature.body}</p>
    <p><strong style="color:var(--primary)">$29/month.</strong> One saved client = 6 months of Bix.</p>
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
      <button id="upgrade-later" style="padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:8px;cursor:pointer;color:var(--text)">Maybe later</button>
      <a href="billing.html" style="padding:10px 16px;background:var(--primary);border:none;border-radius:8px;cursor:pointer;color:#fff;text-decoration:none;display:inline-block;font-weight:600">Upgrade to Pro</a>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.showModal();
  dialog.querySelector('#upgrade-later').addEventListener('click', () => { dialog.close(); dialog.remove(); });
}

// Make it globally available so non-module scripts can call it
window.showUpgradeModal = showUpgradeModal;
window.requirePro = requirePro;
