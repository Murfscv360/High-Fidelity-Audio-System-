# Project Plan — "Astropath" *(working title)*
### An immersive Warhammer 40k & Warhammer audiobook + ebook library

> *"Knowledge is power, guard it well."*
> A single, beautiful, ever-curated home for the Warhammer audio + reading experience — books and audiobooks in synergy, wrapped in cover-art, lore, character bios and timelines that pull you all the way into the setting.

---

## 0. Status & how to read this

This is a **planning document**, not yet code. It defines the vision, scope, architecture, tech stack, data model, and a phased roadmap so the build can start with a clear target. Names (`Astropath`) are placeholders.

A note up front on **content & IP** — see [§9](#9-content-ip--legal-the-honest-bit). This is designed as a **personal, self-hosted media library** (the Plex model: *you* own the books/audiobooks, the app organises and enriches *your* library). Redistributing Black Library / Games Workshop artwork or text publicly is a copyright matter, so the plan treats third-party artwork and lore as **fetched-on-demand / cached-locally for personal use**, with clean fallbacks — not as bundled-and-shipped assets.

---

## 1. Vision

Build the **one-stop, know-everything Warhammer resource** that fuses:

- **Audiobooks** (the core listening experience — gapless, chaptered, hi-fidelity)
- **EPUB ebook library** (read the book, or read *along* with the audio)
- **Plex** as the media backend (your library, your server, your files)
- **Immersive presentation** — large, captivating cover-art galleries on desktop
- **Lore & enrichment** — character bios, faction profiles, events and **timelines** drawn from Wikipedia / wikis, woven together with the books and audio
- **Curated, continually-updated content** — new releases showcased with "where this fits in the grand timeline," expert commentary, and editorial context

Two surfaces:
- **iOS mobile app** — React Native + Expo + NativeWind (Tailwind), modern and tactile, built for listening and reading on the go.
- **Desktop / large-screen web** — cinematic, art-forward; the cover-art and codex experience lives here at full size.

Both share **one backend and one data model**.

---

## 2. Experience pillars

| Pillar | What it feels like |
|---|---|
| **Cinematic art** | Edge-to-edge cover-art, parallax hero banners, faction-themed colour, glassy overlays. The art *is* the navigation. |
| **Books + audio synergy** | Open *Eisenhorn* and see the omnibus EPUB, the audiobook, the narrator, the trilogy's place in the timeline, and the key characters — in one view. Switch between reading and listening; (stretch) read-along sync. |
| **Living codex** | Tap a character, faction, planet, or event → an immersive bio page with large artwork, a short editorial summary, sourced facts, and "appears in" links back to your library. |
| **Timeline** | A navigable Imperial timeline (and per-faction sub-timelines) where every book/audiobook is pinned to where it falls — Horus Heresy → 30k → 40k → the Era Indomitus, plus Age of Sigmar/Old World for "Warhammer" proper. |
| **Curated & current** | A "New & Noteworthy" rail: new releases with editorial notes on where they slot in, recommended listening orders, and expert commentary. |

---

## 3. Feature set (scope)

### 3.1 Library & playback (the foundation)
- Connect to a **Plex Media Server** (audiobooks as music/audiobook libraries, ebooks as a "Books"/photo-or-files library or via a companion store).
- Browse by **series / author / narrator / faction / timeline era**.
- **Audiobook player**: gapless, chapter markers, variable speed, sleep timer, bookmarking, resume-across-devices, lock-screen / CarPlay controls, background audio.
- **Now Playing** with full-bleed cover-art and live chapter + lore context.

### 3.2 EPUB ebook library
- Dedicated **EPUB reader** (pagination, themes, fonts, highlights, bookmarks).
- Pairing: an audiobook and its matching ebook are linked as **one work** with two media.
- **Stretch:** read-along (audio ↔ text position sync via timestamped EPUB / SMIL or forced alignment).

### 3.3 Lore & enrichment engine
- **Character / faction / planet / event pages**: large artwork, BIO data, editorial summary, sourced facts, relationships, "appears in your library" cross-links.
- Sources: Wikipedia + the Warhammer wikis (e.g. Warhammer 40k Fandom/Lexicanum) via their APIs, normalised and **cached**. Always link back to the source.
- **Timelines**: interactive, zoomable; every work pinned to its era; filter by faction.

### 3.4 Discovery & curation
- **New releases** rail with editorial "where it fits" notes and recommended reading/listening order.
- **Curated collections** ("Start here: Horus Heresy," "Best of the Inquisition," "Orks for beginners").
- **Expert commentary** blocks — editorial content authored in a lightweight CMS / markdown.

### 3.5 Cross-cutting
- Search across works, characters, factions, events.
- Faction-themed visual identity (Imperium, Chaos, Aeldari, Orks, Necrons, Tyranids…).
- Offline downloads (audio + EPUB + cached art/lore) for mobile.
- Continue-listening / continue-reading and cross-device sync.

---

## 4. Architecture

```
┌──────────────────────────┐        ┌────────────────────────────────────┐
│  iOS app (Expo / RN)     │        │  Desktop / web (art-forward)        │
│  NativeWind (Tailwind)   │        │  Next.js or RN-Web (shared UI kit)  │
└────────────┬─────────────┘        └──────────────┬──────────────────────┘
             │  GraphQL / REST  (one API)          │
             └────────────────────┬────────────────┘
                                  ▼
                    ┌──────────────────────────────┐
                    │   Astropath backend (API)     │
                    │  • Plex auth + library proxy  │
                    │  • Catalogue / works model    │
                    │  • Enrichment & timeline svc  │
                    │  • Curation / CMS             │
                    └───────┬───────────────┬───────┘
                            │               │
              ┌─────────────▼──┐     ┌──────▼─────────────────────┐
              │  Plex Media    │     │  Enrichment sources         │
              │  Server (yours)│     │  Wikipedia / wikis APIs     │
              │  audio + epub  │     │  cover-art (cached)         │
              └────────────────┘     └─────────────────────────────┘
```

**Key idea:** a **"Works" catalogue layer** sits on top of Plex. Plex provides the files and basic metadata; Astropath enriches each work with curated metadata, links the audiobook↔ebook, attaches characters/factions/timeline placement, and caches third-party art/lore. The apps talk only to the Astropath API.

### Services
1. **Plex integration** — OAuth/PIN auth, library listing, streaming URLs, progress sync.
2. **Catalogue service** — the canonical Work/Edition/Media model + relationships.
3. **Enrichment service** — pulls + normalises + caches lore/art from external APIs; jobs to refresh.
4. **Timeline service** — era model + work pinning + faction filters.
5. **Curation/CMS** — editorial collections, commentary, "new releases" notes (markdown-based, version-controlled).

---

## 5. Tech stack

| Layer | Choice | Why |
|---|---|---|
| **iOS app** | **React Native + Expo (SDK latest), Expo Router** | Fast iteration, OTA updates, native audio, easy device testing. |
| **Styling** | **NativeWind (Tailwind CSS for RN)** | Modern utility-first UI, shared design tokens with web. |
| **Audio** | `expo-audio` / `react-native-track-player` | Background playback, lock-screen + CarPlay controls, chapters. |
| **EPUB reader** | `epubjs` (web) / `@epubjs-react-native` or `readium` | Pagination, theming, highlights. |
| **Desktop/web** | **Next.js** (or React Native Web reusing the UI kit) | SSR for rich art pages, big-screen layouts, SEO for curated content. |
| **Shared UI** | Design-token package consumed by both (Tailwind config) | One visual language across surfaces. |
| **Backend** | **Node + TypeScript** (NestJS or Fastify), **GraphQL** | Strong typing end-to-end, one graph for both clients. |
| **DB** | **PostgreSQL** (+ Prisma) | Relational lore graph, full-text search; `pg_trgm`/`tsvector`. |
| **Cache/jobs** | Redis + a queue (BullMQ) | Enrichment refresh, art caching, rate-limited external calls. |
| **Media backend** | **Plex Media Server** (user-hosted) | Source of truth for files + streaming. |
| **State (mobile)** | TanStack Query + Zustand | Server cache + light local state. |
| **Auth** | Plex PIN/OAuth + app session (JWT) | Reuse Plex identity; no separate account needed. |

> Design language can carry over the polish from the existing **Auralis** player (this repo) — glassy surfaces, Inter/JetBrains Mono, but re-skinned dark + faction-accent for the grimdark aesthetic.

---

## 6. Data model (first cut)

```
Work            ── a title (e.g. "Eisenhorn: Xenos")
 ├─ Edition     ── EPUB edition, audiobook edition (narrator, runtime)
 │   └─ Media   ── concrete Plex item (file, duration, chapters)
 ├─ Series      ── "Eisenhorn", order index
 ├─ Authors / Narrators
 ├─ Factions[]  ── Imperium, Inquisition…
 ├─ TimelinePin ── era + approximate date + sort key
 └─ Entities[]  ── characters / planets / events featured

Entity (character | faction | planet | event)
 ├─ Bio (editorial summary + sourced facts)
 ├─ Artwork[] (cached refs + attribution + source URL)
 ├─ Sources[] (Wikipedia / wiki URLs + fetch timestamp)
 └─ Relationships[] (allies, rivals, members…)

TimelineEra      ── Age of Strife → Great Crusade → Horus Heresy → 40k → Indomitus …
Collection       ── curated list (works + commentary)
CommentaryBlock  ── editorial markdown attached to works / entities / releases
```

---

## 7. UX / design direction

- **Dark, grimdark, art-first.** Cover-art and key-art dominate; chrome recedes.
- **Faction theming** — accent colour + iconography shifts by faction context.
- **Desktop hero pages** — full-bleed key art, parallax, a "codex panel" that slides over.
- **Mobile** — thumb-friendly player, large art, swipe between Listen / Read / Lore tabs of a work.
- **Typography** — a display face for headers (evocative, high-contrast) + clean sans for body; mono for stats/timeline.
- **Motion** — restrained, cinematic transitions; art crossfades; timeline scrubbing.

---

## 8. Roadmap (phased)

**Phase 0 — Foundations (repo, infra, plumbing)**
- Monorepo scaffold (apps/mobile, apps/web, packages/ui, services/api).
- Plex auth + library listing proving connectivity end-to-end.
- Catalogue DB schema + Work/Edition/Media model.

**Phase 1 — Core library + audiobook player (MVP)**
- Browse Plex audiobooks; full audiobook player (chapters, speed, resume, background, lock-screen).
- Big cover-art Now Playing; basic series/author browse.

**Phase 2 — EPUB library**
- EPUB reader; link audiobook↔ebook into one Work; reading progress sync.

**Phase 3 — Lore & enrichment**
- Enrichment service + character/faction/event pages with cached art + sourced bios.
- "Appears in your library" cross-links.

**Phase 4 — Timelines & curation**
- Interactive timeline with work pinning + faction filters.
- Curated collections, "New & Noteworthy," editorial commentary CMS.

**Phase 5 — Polish & synergy (stretch)**
- Read-along audio↔text sync, offline bundles, CarPlay, recommendations, continual content refresh jobs.

Each phase ships a usable increment on **both** mobile and desktop.

---

## 9. Content, IP & legal (the honest bit)

This is the part worth being straight about so the project doesn't get into trouble later:

- **Your media is yours.** The Plex model is sound: you host the audiobooks/EPUBs you own; the app organises and enriches *your* files. That's the whole architecture here.
- **Third-party artwork (Black Library / Games Workshop)** is **copyrighted**. The plan therefore treats their key-art/covers as **fetched on demand and cached for personal use**, surfaced with attribution and source links — **not** bundled into the app or redistributed publicly. If this ever goes public/commercial, art needs licensing or replacement with original/community-licensed assets and clean fallbacks.
- **Wikipedia** content is CC BY-SA — usable with attribution + share-alike. **Fandom/Lexicanum wikis** have their own licences (often CC BY-SA / CC BY-NC); we attribute and link, and respect `robots.txt`/API terms and rate limits.
- **Editorial commentary** we author is our own — that's the safe, ownable layer and a real differentiator.
- **Recommendation:** keep enrichment as a *cache-and-link* layer with attribution, keep the app personal/self-hosted, and avoid scraping where an official API exists. Build the cur/editorial layer as the original IP.

This keeps the project firmly in "personal media companion" territory (like Plex itself) rather than "redistributing GW's assets."

---

## 10. Open questions

1. **Repo shape** — monorepo (recommended, shared UI/types) vs separate mobile/web/api repos?
2. **Desktop** — Next.js (best for rich SSR art pages + SEO) vs React Native Web (max code reuse)?
3. **Scope of "Warhammer"** — 40k + 30k only, or also Age of Sigmar / Old World / Warhammer Fantasy?
4. **Hosting** — self-hosted backend alongside Plex, or a hosted API that talks back to each user's Plex?
5. **Editorial** — solo-curated, or open it to community contributions later?

---

*Built to honour the material. The Emperor protects — but good metadata helps.*
