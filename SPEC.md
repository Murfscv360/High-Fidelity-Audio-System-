# Auralis — Technical Specification

*Version: 3.4 · Last updated: 2026-05-30*

This is the engineering reference for Auralis — what it does, how it's built, the API contracts, the deployment topology, and the testing posture. Read [`README.md`](README.md) first for the product context.

---

## 1. Goals and non-goals

### Goals
- Deliver a single-user, hi-res audio library player accessible from any modern browser, anywhere with internet
- Stream FLAC / ALAC / DSD / MQA bit-perfect from a self-hosted Navidrome server
- Run without a backend service of our own (no databases, no edge functions, no compute we pay for)
- Be installable as a PWA on iOS, Android, and desktop
- Provide a test rig that gates deployment — no regression should reach `main` undetected

### Non-goals
- **Multi-user.** No accounts, no auth provider, no row-level security. One library per deployment.
- **Music discovery / social features.** No "what your friends are listening to," no upvotes, no shared playlists.
- **Transcoding control.** Whatever Navidrome serves is what plays. Format/bitrate selection happens server-side.
- **Offline-first playback.** The PWA caches the shell so the app loads offline; tracks themselves do not pre-download.
- **Multi-tenant scaling.** No CDN-of-CDNs; one Cloudflare tunnel per deployment.

---

## 2. Architecture

### High-level

```
┌──────────────────────────┐
│  Browser (Auralis PWA)   │  index.html + sw.js
│                          │  HTMLAudioElement → Web Audio (waveform)
└────────────┬─────────────┘  IndexedDB (artwork, library cache)
             │ HTTPS
             ▼
┌──────────────────────────┐
│  Vercel (edge, static)   │  index.html / manifest.json / sw.js / images
│  vercel.json rewrites    │  /navidrome-api/* → tunnel/rest/*
└────────────┬─────────────┘
             │ HTTPS (Cloudflare-managed TLS)
             ▼
┌──────────────────────────┐
│  Cloudflare Quick Tunnel │  No auth, no DNS, no account.
│  *.trycloudflare.com     │  Ephemeral — hostname rotates if tunnel restarts.
└────────────┬─────────────┘
             │ HTTP (LAN)
             ▼
┌──────────────────────────┐
│  Navidrome (QNAP / NAS)  │  /rest/ping, /rest/getAlbumList2, /rest/stream …
│  Subsonic API v1.16+     │  Reads music from local filesystem.
│  OpenSubsonic extensions │
└──────────────────────────┘
```

### Why this topology
- **Vercel** gives free static hosting + free edge CDN. The `rewrites` rule does the proxying purely at the routing layer (no function invocation, no extra latency beyond TLS handshake).
- **Cloudflare tunnel** removes the home-router config problem. No port-forwarding, no Dynamic DNS, no exposed IPs. The tunnel daemon (`cloudflared`) maintains an outbound persistent connection to Cloudflare's edge; inbound requests reach your QNAP through that pipe.
- **Navidrome** does all the music heavy lifting — indexing, transcoding, ID3 parsing, stream chunking. We treat it as the source of truth.

### Trust boundaries
| Boundary | What crosses | Authentication |
|---|---|---|
| Browser ↔ Vercel | HTML / assets / Subsonic API calls | None (Vercel public) |
| Vercel ↔ tunnel | Rewritten `/rest/*` requests | None at this layer |
| Tunnel ↔ Navidrome | Same requests | Subsonic `?u=&p=` query-string credentials |
| Browser ↔ localStorage | Username, password, settings | Browser origin isolation |

The Navidrome credentials are the only secret. They live in the user's `localStorage` and are sent as URL query parameters on every Subsonic request, transported under TLS for the entire chain (browser → Vercel → tunnel → LAN, where the LAN hop is HTTP because Navidrome is local-only).

---

## 3. Frontend stack

### What's in the single HTML file

`code/index.html` is the entire application. It contains:

| Section | Approximate lines | Purpose |
|---|---|---|
| `<head>` | 1 – 12 | Meta, viewport, manifest link, Google Fonts preconnect |
| `<style>` | 13 – 510 | Design tokens, layout grids, components, mobile/tablet/narrow breakpoints |
| Static markup | 511 – 700 | App shell — icon bar, sidebar, top bar, waveform canvas, main, player bar, fullscreen player, import modal, connect modal, mobile nav, mobile-now-playing, toast tray |
| `<script>` | 700 – 2810 | All application logic: state object, ID3 parser, IDB layer, Subsonic client, view renderers, event handlers, keyboard, service-worker registration |

No build step, no bundler, no transpilation. The file is shipped as-is.

### State (`S`)

```js
const S = {
  page: 'home',                  // current route key
  albums: { [id]: {...} },       // keyed by Subsonic albumId
  queue: [...],                  // current play queue
  qIdx: 0,                       // current queue index
  shuffle: false,
  repeat: false,
  currentTrack: null,
  currentAlbumId: null,
  playing: false,
  vol: 1.0,
  pitch: 1.0,
};

const NAV = {
  url: '/navidrome-api',         // proxy base; or absolute https://host for direct
  user: '...', pass: '...',      // from localStorage on boot
  connected: false,
};

const INTEL = {                  // optional AI hub state
  apiKey: '...',
  artistScores: {...},
  genreScores: {...},
  recentPlays: [...],
};
```

### Subsonic client (`navParams`, `navUrl`, `navGet`, `navConnect`, `navLoadLibrary`)

| Function | Purpose | Notes |
|---|---|---|
| `navParams()` | Builds the query string: `u=&p=&v=1.16.1&c=auralis&f=json` | **Plaintext password** because the inline `md5()` is mathematically broken. Wire-secure under TLS. |
| `navUrl(endpoint, extra)` | `NAV.url + '/' + endpoint + '?' + navParams() + extra` | Handles both proxy form (`/navidrome-api/...`) and direct form (`https://host/rest/...`). |
| `navGet(endpoint, extra)` | `fetch(navUrl(...))`, parse Subsonic JSON, return `subsonic-response` body on success or `null` | Conservative — swallows all errors as `null`. |
| `navConnect(user, pass, url?)` | Save creds, ping, set `NAV.connected`, load library | Programmatic boot path. |
| `navLoadLibrary()` | Iterate `getAlbumList2?type=alphabeticalByName&size=500&offset=N` | **Bounded loop**: `MAX_PAGES = 200` (10× safety margin). Populates `S.albums`. |
| `navLoadAlbumTracks(id)` | Fetch full track list for an album on-demand | Called when user presses Play. |
| `navStreamUrl(trackId)` | Build the `/stream` URL for the `<audio>` element | Includes plaintext password — exposed in DOM via `audio.src`. |
| `connectNow()` | UI handler for the Connect button | Has **double-click guard** (`btn.disabled = true`). |

### Service worker

`sw.js` v3.3:

- **Install**: precaches `/manifest.json` only. `skipWaiting()` so updates take over immediately.
- **Activate**: deletes any cache name that isn't current. `clients.claim()` so open tabs use the new SW.
- **Fetch**:
  - GET only (POST falls through)
  - Skip cross-origin (Google Fonts, Anthropic) — pass through with no caching
  - Skip `blob:` URLs (locally-imported audio)
  - **Skip a `NEVER_CACHE` allowlist**: `/navidrome-api/rest/stream`, `getAlbumList`, `getAlbum`, `getCoverArt`, `ping`. These change too often to cache.
  - HTML / navigations: **network-first**, fall through to cache on failure (so deploys are visible on first navigation; no "stale-while-revalidate" trap)
  - Other same-origin assets: cache-first with background revalidation

Cache versioning: `const CACHE = 'auralis-v3.3'`. Bump this string to evict the previous cache on activate.

### Web Audio waveform

The bottom-of-screen waveform is real — not a decorative SVG. The HTMLAudioElement is connected to an `AudioContext`:

```js
AUD_CTX = new AudioContext();
SRC     = AUD_CTX.createMediaElementSource(AUD);
ANL     = AUD_CTX.createAnalyser();
SRC.connect(ANL); ANL.connect(AUD_CTX.destination);
```

Then `requestAnimationFrame` reads `analyser.getByteFrequencyData()` and renders a 32-band bar visualisation on a `<canvas>`. The fullscreen player uses a higher-resolution variant of the same data.

### Persistence (IndexedDB)

Three object stores in DB `auralis-db`:

| Store | Key | Value |
|---|---|---|
| `files` | track id | Blob (local-import audio files, not used for Navidrome streaming) |
| `meta` | string ('tracks', 'albums') | Bulk metadata arrays |
| `artwork` | album id | Blob (cover-art images) |

IndexedDB is persisted across sessions but **does not contain credentials** — those live in `localStorage` under `nav_user` / `nav_pass`.

### Optional AI hub

If `localStorage.getItem('auralis-api-key')` is set to a real Anthropic key, the AI hub becomes active:

| Feature | Endpoint | Model |
|---|---|---|
| Daily brief | `POST api.anthropic.com/v1/messages` | `claude-sonnet-4-20250514` |
| Mood recommendations | same | same |
| Album insight | same | same |
| Artist profile | same | same |

The key is sent with `anthropic-dangerous-direct-browser-access: true` (documented trade-off — XSS = key exfiltration). The app works fully without it.

---

## 4. Typography and design system

### Type
- **Display + body**: [Inter](https://rsms.me/inter/) — weights 400, 500, 600, 700
- **Data callouts** (track durations, kbps, format chips): [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — 400, 500
- No serifs, no italics

### Letter-spacing tokens
| Token | Value | Use |
|---|---|---|
| `--tracking-tight` | `-0.01em` | Large display headings (`.hero-title`, `.av-title`) |
| `--tracking-normal` | `0` | Body text (default) |
| `--tracking-wide` | `0.06em` | Small-caps eyebrow labels (≤11px uppercase) |

### Palette (vibrdrome-inspired)
| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0E141B` | Main background |
| `--sidebar-bg` | `#0B1118` | Sidebar (darker for separation) |
| `--panel` | `#1A2230` | Cards, panels, modals |
| `--raised` | `#222A36` | Hover / lifted surfaces |
| `--t1` | `#F2F2F2` | Primary text |
| `--t2` | `#9AA1AB` | Secondary text |
| `--t3` | `#6B7280` | Tertiary text |
| `--ac` | `#4db8ff` | Accent (active states, scrubber, primary button) |
| `--gold` | `#E8B33A` | Premium / hi-res indicator |
| `--green` | `#3ecf7a` | Success |
| `--red` | `#ff5f72` | Error |

### Layout breakpoints
| Breakpoint | Trigger | What changes |
|---|---|---|
| Desktop | `> 1024px` | Three-column grid: icon-bar 60 + sidebar 220 + main, fixed bottom player 76px |
| Tablet | `769 – 1024px` | Sidebar narrows to 184px; search input narrows |
| Phone | `≤ 768px` | Sidebar hidden, mobile bottom nav (4 items) appears, mobile now-playing strip docks above nav, single-column layout |
| Narrow phone | `≤ 380px` | Grid collapses to 2 columns, padding tightens |
| Landscape (low height) | `≤ 900px wide && ≤ 500px high && landscape` | Mobile now-playing strip hidden to recover vertical space |
| Reduced motion | `prefers-reduced-motion` | All transitions disabled |

---

## 5. Deployment

### Vercel
The entire repository is the deploy artifact. Vercel auto-detects the project type as static, sets the deploy directory to repo root, and serves every file as-is. `vercel.json` declares:

```json
{
  "rewrites": [
    {
      "source": "/navidrome-api/:path*",
      "destination": "https://<your-tunnel>.trycloudflare.com/rest/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    }
  ]
}
```

The `no-cache, no-store, must-revalidate` header ensures that a new deploy is visible on the first request — combined with the SW's network-first HTML strategy, no user is ever trapped on stale code.

### GitHub → Vercel
The repo is connected to a Vercel project; every push to `main` triggers a deploy in ~9 seconds median. There is no build step.

### Cloudflare Quick Tunnel
On the Navidrome host:
```bash
cloudflared tunnel --url http://localhost:4533
```
Quick tunnels are ephemeral — the hostname changes each restart. Production deployments should use a named tunnel with a stable hostname (`cloudflared tunnel create` + DNS record).

---

## 6. Testing

The test rig lives in `code/tests/`. Run it with `node code/run-tests.js`.

### 14 suites, ~400 assertions

| # | Suite | Purpose |
|---|---|---|
| 01 | Syntax | JS in `<script>` parses via `vm.Script`; balanced braces; no `eval` / `document.write` |
| 02 | Duplicates | Zero duplicate top-level function declarations (would have caught the 72-dup "Frankenstein" file) |
| 03 | Wiring | Every `onclick=` / `onchange=` target is a declared function |
| 04 | Crypto | `md5()` vs RFC 1321 + Node crypto + 20 random samples (advisory while auth uses plaintext `&p=`) |
| 05 | Network | Proxy → tunnel → Navidrome chain; status codes 10 / 40 round-trip |
| 06 | Deploy parity | Local MD5 == live MD5 (line-ending normalised); edge `Age` reasonable |
| 07 | Timing | p95 SLOs across home / proxy / tunnel / sw endpoints |
| 08 | Update detection | SW network-first for HTML; `skipWaiting + clients.claim`; cache version bump |
| 09 | Security | No PAT / AWS / Slack / Anthropic key in source; no `eval`; auth uses `&p=` not `&t=` |
| 10 | HTML structure | DOCTYPE, lang, charset, viewport, manifest, every required `id="..."` present |
| 11 | Headless smoke | Real Chrome via `puppeteer-core` — load page, click Connect, observe network + console |
| 12 | Regression | 32 REG-NNN tests — every historical bug pinned by name (so it can't return silently) |
| 13 | Fuzz | 300+ randomised assertions across `cleanTitle`, `cleanArtist`, `esc`, `ft`, `navParams` with hostile inputs |
| 14 | Flows | 30+ multi-step puppeteer journeys: cold load × mobile/tablet/desktop, keyboard, modal interactions, route navigation, SW lifecycle, manifest fetch, search |

### Regression catalogue (excerpt from `12-regression.js`)
| ID | Date | Bug | Detector |
|---|---|---|---|
| REG-001 | 2026-05-30 | `connectNow` duplicate caused button to call wrong implementation | exactly-1 declaration count |
| REG-002..012 | 2026-05-30 | Frankenstein duplicate-function set (12 sentinel functions) | exactly-1 each |
| REG-014 | 2026-05-30 | Broken `md5()` forced switch to plaintext auth | `&p=` present in JS |
| REG-015 | 2026-05-30 | Salted-token auth re-enabled while `md5()` still broken | `&t=` absent in auth path |
| REG-017 | 2026-05-30 | Bare-quote `apiKeyInput` would break parse | escaped `\'apiKeyInput\'` only |
| REG-018 | 2026-05-30 | SW stale-while-revalidate trap on HTML | fetch precedes cache in HTML branch |
| REG-019..020 | 2026-05-30 | SW lifecycle missing | `caches.delete` + `skipWaiting + clients.claim` |
| REG-021 | 2026-05-30 | GitHub PAT leak | `ghp_…` pattern absent |
| REG-031 | 2026-05-30 (audit) | `navLoadLibrary` infinite-loop potential | `MAX_PAGES` guard present |
| REG-032 | 2026-05-30 (audit) | `connectNow` double-click race | `btn.disabled = true` present |

### Pre-deploy gate (`predeploy.ps1`)
1. Run all suites locally
2. If any fail, block the push (Force flag overrides; never use in production)
3. Push to GitHub with `$env:GITHUB_TOKEN`
4. Poll the live URL until served MD5 matches local
5. Re-run **post-deploy** suites against the live URL
6. Exit non-zero if anything still fails

---

## 7. Security model

### Threat model
This is a **single-user app** for trusted hardware. The threats we care about:

| Threat | Mitigation |
|---|---|
| Cloudflare quick-tunnel hostname leaked → attacker hits Navidrome directly | Tunnel hostname is in `vercel.json` (public). Real defence: Navidrome auth still required. |
| Credentials in `localStorage` exfiltrated via XSS | `esc()` is XSS-safe for textContent; new `jsq()` is XSS-safe for attribute interpolation. Sweep of all attribute-context usages is in progress (see FINDINGS H-03). |
| Navidrome password visible in `<audio>` element `src` attribute | **Known trade-off** documented in FINDINGS.md H-05. Mitigation requires a working `md5()` for salted-token auth, which is itself a follow-up. |
| Vercel proxy abused as open relay | Proxy only rewrites `/navidrome-api/*` to a single hardcoded hostname. Not an open relay. |
| Stale SW serving wrong code | SW v3.3 is network-first for HTML; combined with `Cache-Control: no-store` headers, deploys are immediate. |

### What we do NOT defend against
- A compromised browser extension can read `localStorage` directly. Don't install untrusted extensions.
- A user pasting a malicious Anthropic API key into the AI hub would expose that key to api.anthropic.com (their own server). Not our problem.
- A malicious user with physical access to the host has full DevTools control. This is a single-user app; this is not a threat we mitigate.

---

## 8. Versioning and changelog

Auralis is single-numbered (no semver). The most recent version is `v3.4`.

| Version | Date | Highlights |
|---|---|---|
| v3.4 | 2026-05-30 | Typography rebuild: retired Cormorant / Syne / DM Mono; single Inter system; rebuilt connect modal; 2,784 mojibake sequences fixed across 3 sweeps; tablet + narrow-phone + landscape breakpoints |
| v3.3 | 2026-05-30 | Service worker `NEVER_CACHE` allowlist for `/stream` + dynamic endpoints; 4 audit-driven fixes (pagination bound, double-click guard, `jsq()` XSS-safe escaper, SW comment sync) |
| v3.2 | 2026-05-30 | SW changed from stale-while-revalidate to network-first for HTML — closed "trapped on stale deploy" trap |
| v3.1 | 2026-05-30 | Frankenstein collapse — deleted 72 duplicate function declarations (-1552 lines); switched Subsonic auth to plaintext `&p=` after discovering inline `md5()` is mathematically broken; fixed bare-quote JS parse error around `apiKeyInput` |
| v3.0 | 2026-05-29 | Initial Vercel + Cloudflare-tunnel deploy of the PWA |

See [`code/FINDINGS.md`](code/FINDINGS.md) for the full audit catalogue with severity gradings.

---

## 9. Outstanding work

These are documented in `code/FINDINGS.md` and not yet implemented:

| ID | Severity | Title |
|---|---|---|
| H-05 | HIGH | `openAlbum()` shows empty track list for Navidrome albums — needs to wire `renderNavAlbumShell` in. |
| H-06 | HIGH | Listening intel never tracks Navidrome plays → AI hub stays empty. |
| H-07 | HIGH | Navidrome password in plaintext `localStorage`. |
| H-08 | HIGH | `NAV.connected` desyncs after server-side session expiry. |
| M-01 | MEDIUM | `loadLibraryFromDB` defined but never called by `boot()` — local imports vanish on reload. |
| M-02 | MEDIUM | `formatAIText` injects Claude output as raw `.innerHTML` — prompt-injection sink. |
| M-04 | MEDIUM | `NAV.url` from `localStorage` not validated against an allowlist. |
| M-06 | MEDIUM | `navConnect` programmatic path returns generic error for both auth-failure and network-failure. |

---

## 10. Contact / support

This is a personal project. Issues: [GitHub Issues](https://github.com/Murfscv360/High-Fidelity-Audio-System-/issues).
