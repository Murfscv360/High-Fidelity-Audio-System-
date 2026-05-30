// Minimal global state — credentials + current track. Zero-dependency: useSyncExternalStore.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Album, Song } from '../api/subsonic';

type State = {
  user: string;
  pass: string;
  connected: boolean;
  albums: Album[];
  currentTrack: Song | null;
  queue: Song[];
  queueIndex: number;
  playing: boolean;
};

let state: State = {
  user: '',
  pass: '',
  connected: false,
  albums: [],
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  playing: false,
};

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const getSnapshot = () => state;

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

export function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export async function loadCredsFromStorage(): Promise<{ user: string; pass: string } | null> {
  try {
    const u = await AsyncStorage.getItem('auralis_user');
    const p = await AsyncStorage.getItem('auralis_pass');
    if (u && p) { setState({ user: u, pass: p }); return { user: u, pass: p }; }
  } catch {}
  return null;
}

export async function saveCreds(user: string, pass: string) {
  await AsyncStorage.setItem('auralis_user', user);
  await AsyncStorage.setItem('auralis_pass', pass);
  setState({ user, pass });
}

export async function clearCreds() {
  await AsyncStorage.removeItem('auralis_user');
  await AsyncStorage.removeItem('auralis_pass');
  setState({ user: '', pass: '', connected: false, albums: [] });
}
