// Subsonic API client — talks to your Navidrome via the same Vercel proxy the web app uses.
// Plaintext auth (Vercel/Cloudflare are HTTPS end-to-end; matches what the web app does
// after we discovered the inline md5 was broken).

const PROXY_BASE = 'https://high-fidelity-audio-system.vercel.app/navidrome-api';

export type Creds = { user: string; pass: string };

export type Album = {
  id: string;
  name: string;
  artist: string;
  artistId?: string;
  year?: number;
  genre?: string;
  songCount?: number;
  duration?: number;
  coverArt?: string;
  created?: string;
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumId: string;
  track?: number;
  year?: number;
  genre?: string;
  duration?: number;
  bitRate?: number;
  suffix?: string;
  contentType?: string;
  coverArt?: string;
  size?: number;
};

function buildParams(c: Creds, extra?: Record<string, string>): string {
  const p = new URLSearchParams({
    u: c.user,
    p: c.pass,
    v: '1.16.1',
    c: 'auralis-mobile',
    f: 'json',
    ...(extra || {}),
  });
  return p.toString();
}

async function callJson<T>(c: Creds, endpoint: string, extra?: Record<string, string>): Promise<T> {
  const url = `${PROXY_BASE}/${endpoint}?${buildParams(c, extra)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const r = json['subsonic-response'];
  if (!r) throw new Error('Malformed Subsonic response');
  if (r.status !== 'ok') {
    const code = r.error?.code ?? 0;
    const msg  = r.error?.message ?? 'Unknown error';
    throw Object.assign(new Error(msg), { code });
  }
  return r as T;
}

export async function ping(c: Creds): Promise<boolean> {
  try { await callJson(c, 'ping'); return true; }
  catch { return false; }
}

export async function getAlbumList(c: Creds, offset: number = 0, size: number = 500): Promise<Album[]> {
  const r = await callJson<{ albumList2?: { album?: Album[] } }>(
    c,
    'getAlbumList2',
    { type: 'alphabeticalByName', size: String(size), offset: String(offset) }
  );
  return r.albumList2?.album || [];
}

export async function getAllAlbums(c: Creds, onProgress?: (n: number) => void): Promise<Album[]> {
  const all: Album[] = [];
  let offset = 0;
  const SIZE = 500;
  const MAX_PAGES = 200;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await getAlbumList(c, offset, SIZE);
    all.push(...page);
    onProgress?.(all.length);
    if (page.length < SIZE) break;
    offset += page.length;
  }
  return all;
}

export async function getAlbum(c: Creds, id: string): Promise<{ album: Album; song: Song[] }> {
  const r = await callJson<{ album: Album & { song?: Song[] } }>(c, 'getAlbum', { id });
  return { album: r.album, song: r.album.song || [] };
}

export function coverArtUrl(c: Creds, id: string, size: number = 300): string {
  return `${PROXY_BASE}/getCoverArt?${buildParams(c, { id, size: String(size) })}`;
}

export function streamUrl(c: Creds, id: string): string {
  return `${PROXY_BASE}/stream?${buildParams(c, { id, format: 'raw' })}`;
}

export async function search(c: Creds, query: string): Promise<{ albums: Album[]; songs: Song[] }> {
  const r = await callJson<{ searchResult3?: { album?: Album[]; song?: Song[] } }>(
    c,
    'search3',
    { query, albumCount: '20', songCount: '20', artistCount: '0' }
  );
  return {
    albums: r.searchResult3?.album || [],
    songs: r.searchResult3?.song || [],
  };
}
