# Auralis Mobile

Native iOS + Android + Web app built with **React Native + Expo + NativeWind (Tailwind CSS)**,
sharing the same Navidrome backend as the desktop web app
(`high-fidelity-audio-system.vercel.app`).

The same library you see on the desktop shows up here — Subsonic API calls go through
the existing Vercel proxy → Cloudflare tunnel → your QNAP. Nothing else needs to change
on the server.

## Stack

| Layer | What |
|---|---|
| Framework | React Native 0.74 + Expo SDK 51 |
| Styling | **Tailwind CSS via NativeWind v4** — `className="..."` directly on RN components |
| Navigation | React Navigation v6 (native-stack with iOS slide / modal transitions) |
| Audio | `expo-av` Sound with background-mode + iOS silent-mode override |
| Storage | `@react-native-async-storage/async-storage` for credentials |
| Image cache | `expo-image` with transition + memory cache |
| Native feel | `expo-haptics` for tactile feedback · `expo-blur` for glass headers · `expo-linear-gradient` for album-tinted heroes · `lucide-react-native` icons · `react-native-reanimated` animations |

## What's here

| Screen | What it does |
|---|---|
| **Connect** | Enter your Navidrome credentials. Stored in `AsyncStorage` only. |
| **Library** | Grid of every album in your library, fetched via paginated `getAlbumList2`. |
| **Album**   | Cover hero, audio specs (FLAC / HI-RES), play / shuffle, full track list. Tapping a track plays via `expo-av`. |

Auto-resume on launch — if creds are saved and Navidrome is reachable, it skips the
Connect screen and goes straight to Library.

## Launch in 60 seconds

You need **Node 18+** and **npm**. Then:

```bash
cd auralis-mobile
npm install
npx expo start
```

That prints a QR code. Three ways to run from here:

### Option A — iPhone (recommended)

1. Install **Expo Go** from the App Store on your phone
2. Open Camera → point at the QR code → tap the notification
3. Auralis launches in Expo Go, no Xcode required

### Option B — Web (instant, no install)

In the terminal where `expo start` is running, press **`w`**. A browser tab opens with
the app rendered as a PWA-style web page. Pinch / drag / resize to test mobile layouts.

### Option C — iOS Simulator (requires Xcode)

Press **`i`** in the terminal. Boots the iOS simulator + installs the app.

## How it talks to your library

| | |
|---|---|
| API base | `https://high-fidelity-audio-system.vercel.app/navidrome-api` (the same Vercel rewrite the web app uses) |
| Protocol | Subsonic / OpenSubsonic — `getAlbumList2`, `getAlbum`, `getCoverArt`, `stream` |
| Auth | Plaintext `?u=&p=` over HTTPS (matches the web app's switch after the broken-md5 finding) |
| Storage | `AsyncStorage` for credentials, no third-party persistence |
| Streaming | `expo-av` Sound — works with FLAC, ALAC, MP3, M4A. DSD/DSF transcoded by Navidrome to PCM on the wire. |

To point at a different Navidrome instance, edit
[`src/api/subsonic.ts`](src/api/subsonic.ts) and change `PROXY_BASE`.

## Project structure

```
auralis-mobile/
├── App.tsx                  # Root: navigation, audio mode, auto-resume
├── app.json                 # Expo config (iOS bundle, dark UI, background audio)
├── babel.config.js
├── tsconfig.json
├── package.json
└── src/
    ├── api/
    │   └── subsonic.ts      # Subsonic client (ping/getAlbumList/getAlbum/cover/stream)
    ├── state/
    │   └── store.ts         # Minimal global state via useSyncExternalStore
    ├── theme/
    │   └── colors.ts        # Design tokens matching the web app
    └── screens/
        ├── ConnectScreen.tsx
        ├── LibraryScreen.tsx
        └── AlbumScreen.tsx
```

## Build for production

### Expo EAS Build (recommended)

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile preview
```

That produces an `.ipa` you can install via TestFlight or sideload.

### Web export

```bash
npx expo export -p web
```

Outputs `dist/` ready to upload to Vercel / Netlify / any static host. Auto-publishes
to the same domain pattern as the desktop app if you point a Vercel project at this
folder.

## Notes / caveats

- **Cloudflare quick tunnel hostname** is hardcoded in `src/api/subsonic.ts` (via the Vercel
  proxy). If the tunnel rotates, update the Vercel rewrite in the parent repo.
- **Background audio** works on iOS because `UIBackgroundModes: ['audio']` is set, but you
  need to be running through `eas build` (not Expo Go) to test it for real.
- **Web audio** uses standard HTML5 audio + CORS-friendly Subsonic streaming. FLAC playback
  in browsers depends on the browser (Safari + Chrome both work).
