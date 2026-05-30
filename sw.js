/**
 * Bix Service Worker — Cache-first for static assets, network-first for API/Firebase
 */

const CACHE = 'bix-v5';
const STATIC = [
  '/',
  '/index.html',
  '/coach.html',
  '/client.html',
  '/admin.html',
  '/intake.html',
  '/style.css',
  '/manifest.json',
  '/icons/icon.svg',
  '/db-firebase.js',
  '/db-extensions.js',
  '/db.js',
  '/toast.js',
  '/i18n.js',
  '/notifications.js',
  '/messaging.js',
  '/analytics.js',
  '/gamification.js',
  '/video-form-check.js',
  '/coach-members.js',
  '/coach-member-detail.js',
  '/coach-tasks.js',
  '/coach-billing.js',
  '/coach-insights.js',
  '/coach-alerts.js',
  '/coach-design.js',
  '/client-program.js',
  '/client-analytics.js',
  '/client-billing.js',
  '/nutrition.js',
  '/classes.js',
  '/exercise-library.js',
  '/intake.js',
  '/payment-paypal.js',
  '/payment-stripe.js',
];

// Network-only patterns (Firebase, Netlify functions, external CDNs)
const NETWORK_ONLY = [
  'firestore.googleapis.com',
  'firebase',
  'gstatic.com',
  '/.netlify/functions',
  'paypal.com',
  'stripe.com',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache static assets, ignore failures for individual files
      return Promise.allSettled(STATIC.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = req.url;

  // Let network-only requests pass through (Firebase, payments, functions)
  if (NETWORK_ONLY.some(p => url.includes(p))) return;

  // NETWORK-FIRST for code (HTML pages + JS modules) so fixes take effect on
  // the next load instead of being masked by a stale cache. Falls back to cache
  // when offline so the PWA still works without a connection.
  const isCode = req.mode === 'navigate' || url.endsWith('.js') || url.endsWith('.html');
  if (isCode) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() =>
        caches.match(req).then(c => c || (req.mode === 'navigate' ? caches.match('/index.html') : undefined))
      )
    );
    return;
  }

  // CACHE-FIRST for static assets (css, icons, manifest) — these rarely change.
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      });
    })
  );
});
