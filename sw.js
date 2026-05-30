// ═══════════════════════════════════════════════════
// AURALIS Service Worker v3.4
// Strategy: network-first for HTML; cache-first for assets;
// streaming/audio requests bypass cache entirely (audit MEDIUM-6).
// ═══════════════════════════════════════════════════

const CACHE   = 'auralis-v3.4';
const SHELL   = ['/manifest.json'];

// Paths that must NEVER be cached (audio streams, API responses that change).
const NEVER_CACHE = [
  '/navidrome-api/rest/stream',
  '/navidrome-api/rest/getAlbumList',
  '/navidrome-api/rest/getAlbum',
  '/navidrome-api/rest/getCoverArt',
  '/navidrome-api/rest/ping',
];

// ── INSTALL ───────────────────────────────────────
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})
  );
});

// ── ACTIVATE ──────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────
self.addEventListener('fetch', e => {
  const req = e.request;

  // Only handle GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip cross-origin API calls entirely (Supabase, fonts, CDN)
  if (url.origin !== self.location.origin) return;

  // Skip blob: URLs (local audio files)
  if (url.protocol === 'blob:') return;

  // Skip never-cache paths (audit finding MEDIUM-6: SW was caching /navidrome-api/stream
  // responses indefinitely, so subsequent plays served stale audio and library never refreshed).
  if (NEVER_CACHE.some(p => url.pathname.startsWith(p))) return;

  // HTML navigations: network-first (so deploys are visible immediately, no stale-cache trap).
  // Other assets: cache-first.
  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html') ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('.html');

  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then(c => c || new Response('Offline', { status: 503 })))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => {
      const fresh = fetch(req)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        })
        .catch(() => cached || new Response('Offline', { status: 503 }));
      return cached || fresh;
    })
  );
});

// ── MESSAGE (skip waiting) ────────────────────────
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
