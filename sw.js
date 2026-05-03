/**
 * Bix Service Worker — Cache-first for static assets, network-first for API/Firebase
 */

const CACHE = 'bix-v3';
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
  const url = e.request.url;

  // Let network-only requests pass through
  if (NETWORK_ONLY.some(p => url.includes(p))) return;

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => {
        // Offline fallback for navigation
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
