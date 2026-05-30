import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, ScrollView, Dimensions, Animated, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Play, Pause, Shuffle, MoreHorizontal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { getAlbum, coverArtUrl, streamUrl, type Album, type Song } from '../api/subsonic';
import { useStore, setState } from '../state/store';

const { width: SCREEN_W } = Dimensions.get('window');
const ART_W = Math.min(SCREEN_W * 0.68, 320);
const HERO_H = ART_W + 220;

let _sound: Audio.Sound | null = null;

function formatDur(seconds: number) {
  if (!seconds || isNaN(seconds)) return '—';
  const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function AlbumScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const id: string = route.params.id;
  const user = useStore((s) => s.user);
  const pass = useStore((s) => s.pass);
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const r = await getAlbum({ user, pass }, id);
        setAlbum(r.album);
        setTracks(r.song);
      } catch (e: any) {
        console.warn('Album load:', e?.message);
      } finally { setLoading(false); }
    })();
  }, [id, user, pass]);

  useEffect(() => () => {
    if (_sound) { _sound.unloadAsync().catch(() => {}); _sound = null; }
  }, []);

  async function playTrack(track: Song, index: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      if (_sound) { await _sound.unloadAsync(); _sound = null; }
      const url = streamUrl({ user, pass }, track.id);
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      _sound = sound;
      setPlayingTrackId(track.id); setIsPaused(false);
      setState({ currentTrack: track, queue: tracks, queueIndex: index, playing: true });
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          if (index + 1 < tracks.length) playTrack(tracks[index + 1], index + 1);
          else { setPlayingTrackId(null); setState({ playing: false }); }
        }
      });
    } catch (e: any) {
      console.warn('play:', e?.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }

  async function togglePlayback() {
    if (!_sound) return;
    const status: any = await _sound.getStatusAsync();
    if (status.isPlaying) { await _sound.pauseAsync(); setIsPaused(true); }
    else { await _sound.playAsync(); setIsPaused(false); }
    Haptics.selectionAsync().catch(() => {});
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-ink items-center justify-center">
        <ActivityIndicator color="#4db8ff" />
      </SafeAreaView>
    );
  }
  if (!album) {
    return (
      <SafeAreaView className="flex-1 bg-ink items-center justify-center">
        <Text className="text-t2 text-[14px]">Album not found</Text>
      </SafeAreaView>
    );
  }

  const firstTrack = tracks[0];
  const isHi = firstTrack && (firstTrack.suffix === 'flac' || firstTrack.suffix === 'alac' || firstTrack.suffix === 'dsf' || (firstTrack.bitRate ?? 0) > 1000);
  const totalSeconds = tracks.reduce((a, t) => a + (t.duration || 0), 0);
  const totalMin = Math.round(totalSeconds / 60);

  // Floating header opacity (fade in as user scrolls past hero)
  const headerOpacity = scrollY.interpolate({
    inputRange: [HERO_H - 80, HERO_H - 20],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View className="flex-1 bg-ink">
      {/* Floating blurred header that fades in on scroll */}
      <Animated.View
        pointerEvents="none"
        style={{
          opacity: headerOpacity,
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
          height: insets.top + 52,
        }}
      >
        <BlurView intensity={80} tint="dark" style={{ flex: 1 }}>
          <SafeAreaView edges={['top']} className="px-4 py-2.5">
            <Text className="text-t1 text-[15px] font-bold text-center tracking-tight" numberOfLines={1}>
              {album.name}
            </Text>
            <Text className="text-t3 text-[11px] text-center mt-px" numberOfLines={1}>{album.artist}</Text>
          </SafeAreaView>
        </BlurView>
      </Animated.View>

      {/* Back button — always visible top-left */}
      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}>
        <Pressable
          onPress={() => { Haptics.selectionAsync().catch(() => {}); navigation.goBack(); }}
          hitSlop={10}
          className="m-3 rounded-full overflow-hidden active:opacity-60"
        >
          <BlurView intensity={50} tint="dark" className="px-3 py-2 flex-row items-center">
            <ChevronLeft color="#F2F2F2" size={22} />
          </BlurView>
        </Pressable>
      </SafeAreaView>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — colour-tinted gradient behind large cover */}
        <View className="items-center pt-16 px-6 relative">
          <LinearGradient
            colors={['rgba(77,184,255,0.15)', 'rgba(155,109,212,0.05)', 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ART_W + 100 }}
          />
          <View
            className="rounded-2xl overflow-hidden bg-raised"
            style={{
              width: ART_W, height: ART_W,
              shadowColor: '#000', shadowOpacity: 0.6, shadowOffset: { width: 0, height: 20 }, shadowRadius: 30, elevation: 20,
            }}
          >
            <Image
              source={{ uri: coverArtUrl({ user, pass }, album.coverArt || album.id, 800) }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={250}
            />
          </View>

          <Text className="text-ac text-[11px] tracking-[2.4px] mt-5 font-medium">ALBUM</Text>
          <Text className="text-t1 text-[28px] font-extrabold tracking-tighter mt-1.5 text-center px-3" numberOfLines={2}>
            {album.name}
          </Text>
          <Text className="text-t1 text-[16px] font-semibold mt-1">{album.artist}</Text>

          <View className="flex-row mt-3 flex-wrap justify-center">
            {album.year ? <Text className="text-t3 text-[12px]">{album.year}</Text> : null}
            {album.genre ? <Text className="text-t3 text-[12px]"> · {album.genre}</Text> : null}
            <Text className="text-t3 text-[12px]"> · {tracks.length} tracks</Text>
            {totalMin ? <Text className="text-t3 text-[12px]"> · {totalMin} min</Text> : null}
          </View>

          {/* Quality pills */}
          <View className="flex-row gap-2 mt-3">
            {firstTrack?.suffix ? (
              <View className="bg-b0 border border-b1 px-3 py-1 rounded-full">
                <Text className="text-t2 text-[10px] font-semibold tracking-[1.4px]">{firstTrack.suffix.toUpperCase()}</Text>
              </View>
            ) : null}
            {isHi ? (
              <View className="bg-gold-dim border border-gold/40 px-3 py-1 rounded-full">
                <Text className="text-gold text-[10px] font-semibold tracking-[1.4px]">HI-RES</Text>
              </View>
            ) : (
              <View className="bg-ac-dim border border-ac/30 px-3 py-1 rounded-full">
                <Text className="text-ac text-[10px] font-semibold tracking-[1.4px]">LOSSLESS</Text>
              </View>
            )}
          </View>

          {/* Action pill row */}
          <View className="flex-row gap-2.5 mt-6">
            <Pressable
              onPress={() => { if (playingTrackId) togglePlayback(); else firstTrack && playTrack(firstTrack, 0); }}
              className="bg-t1 rounded-pill px-6 py-3 flex-row items-center active:opacity-80"
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              {playingTrackId && !isPaused ? (
                <Pause color="#0E141B" size={16} fill="#0E141B" />
              ) : (
                <Play color="#0E141B" size={16} fill="#0E141B" style={{ marginLeft: 2 }} />
              )}
              <Text className="text-ink font-bold text-[14px] ml-1.5">
                {playingTrackId && !isPaused ? 'Pause' : 'Play'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (tracks.length === 0) return;
                const i = Math.floor(Math.random() * tracks.length);
                playTrack(tracks[i], i);
              }}
              className="border border-b2 rounded-pill px-5 py-3 flex-row items-center active:opacity-80"
            >
              <Shuffle color="#F2F2F2" size={15} />
              <Text className="text-t1 font-bold text-[14px] ml-1.5">Shuffle</Text>
            </Pressable>
          </View>
        </View>

        {/* Track list */}
        <View className="mt-8 px-4">
          <View className="flex-row px-3 pb-2 border-b border-b1 mb-1">
            <Text className="text-t4 text-[10px] tracking-[1.8px] font-medium w-7">#</Text>
            <Text className="text-t4 text-[10px] tracking-[1.8px] font-medium flex-1 ml-1">TITLE</Text>
            <Text className="text-t4 text-[10px] tracking-[1.8px] font-medium">TIME</Text>
          </View>

          {tracks.map((t, i) => {
            const isCurrent = playingTrackId === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => playTrack(t, i)}
                className="flex-row items-center px-3 py-3 rounded-lg active:bg-b1"
              >
                {isCurrent ? (
                  <View className="w-7 items-start">
                    <Play color="#4db8ff" size={14} fill="#4db8ff" />
                  </View>
                ) : (
                  <Text className="text-t3 text-[13px] w-7 font-mono">{t.track ?? i + 1}</Text>
                )}
                <View className="flex-1 ml-1">
                  <Text
                    className={`text-[14.5px] font-medium tracking-tight ${isCurrent ? 'text-ac' : 'text-t1'}`}
                    numberOfLines={1}
                  >
                    {t.title}
                  </Text>
                  {t.artist && t.artist !== album.artist ? (
                    <Text className="text-t3 text-[12px] mt-0.5" numberOfLines={1}>{t.artist}</Text>
                  ) : null}
                </View>
                <Text className="text-t3 text-[12px] font-mono ml-2">{formatDur(t.duration ?? 0)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.ScrollView>
    </View>
  );
}
