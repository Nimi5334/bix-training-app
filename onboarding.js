// onboarding.js
// New-coach + first-client flow.

import { DB } from './db-extensions.js';

export function buildWhatsAppInviteUrl(phone, coachName, inviteUrl) {
  const message = `Hey! Set up your training with ${coachName} here: ${inviteUrl}\n\nTakes 2 min.`;
  const phoneClean = phone.replace(/[^0-9]/g, '');
  return `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`;
}

export function buildInviteUrl(slug) {
  return `${location.origin}/intake.html?invite=${encodeURIComponent(slug)}`;
}

export async function generateClientInvite(coachId, clientName) {
  const slug = await DB.createInviteSlug(coachId, clientName);
  return { slug, url: buildInviteUrl(slug) };
}
