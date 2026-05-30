// ═══════════════════════════════════════════════════
// AURALIS Service Worker v3.1
// Domain: highresaudio.flynns-arcade.net
// Strategy: network-first with silent fallback
// No app-bound domain restrictions
// ═══════════════════════════════════════════════════

const CACHE   = 'auralis-v3.1';
const SHELL   = ['/', '/index.html', '/manifest.json'];

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

  // App shell: stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cached => {
      const fresh = fetch(req)
        .then(res => {
          if (res.ok) {
            caches.open(CACHE).then(c => c.put(req, res.clone()));
          }
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
