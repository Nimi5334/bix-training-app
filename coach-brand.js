// coach-brand.js
// Coach white-label branding: displayName + colors + optional logo.
// Defaults to Bix brand. All client-facing surfaces should read through
// mergeCoachBrand() to never show null/undefined fields.

export function defaultCoachBrand() {
  return {
    displayName: 'Bix',
    primaryColor: '#0A84FF',
    accentColor: '#34C759',
    logoUrl: null
  };
}

export function mergeCoachBrand(partial) {
  if (!partial) return defaultCoachBrand();
  return { ...defaultCoachBrand(), ...partial };
}
