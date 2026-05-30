import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl, Dimensions, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Search, LogOut } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getAllAlbums, coverArtUrl, type Album } from '../api/subsonic';
import { useStore, setState, clearCreds } from '../state/store';

const { width: SCREEN_W } = Dimensions.get('window');
const COLS = SCREEN_W >= 768 ? 4 : SCREEN_W >= 480 ? 3 : 2;
const GAP = 12;
const HORIZ_PADDING = 16;
const CARD_W = (SCREEN_W - HORIZ_PADDING * 2 - GAP * (COLS - 1)) / COLS;

export default function LibraryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const pass = useStore((s) => s.pass);
  const albums = useStore((s) => s.albums);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllAlbums({ user, pass }, (n) => setCount(n));
      setState({ albums: all });
    } catch (e: any) {
      console.warn('Library load failed:', e?.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [user, pass]);

  useEffect(() => { if (albums.length === 0) load(); }, [load, albums.length]);

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true); load();
  }, [load]);

  async function onLogout() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    await clearCreds();
    navigation.replace('Connect');
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return albums;
    const q = query.toLowerCase();
    return albums.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.artist || '').toLowerCase().includes(q)
    );
  }, [albums, query]);

  const renderItem = ({ item, index }: { item: Album; index: number }) => (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        navigation.navigate('Album', { id: item.id });
      }}
      className="active:opacity-70"
      style={{ width: CARD_W, marginRight: (index + 1) % COLS === 0 ? 0 : GAP }}
    >
      <View
        className="rounded-xl overflow-hidden bg-raised"
        style={{
          width: CARD_W,
          height: CARD_W,
          shadowColor: '#000',
          shadowOpacity: 0.5,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 12,
        }}
      >
        <Image
          source={{ uri: coverArtUrl({ user, pass }, item.coverArt || item.id, 400) }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={120}
        />
      </View>
      <Text className="text-t1 text-[13px] font-semibold mt-2 tracking-tight" numberOfLines={1}>
        {item.name}
      </Text>
      <Text className="text-t2 text-[12px] mt-px" numberOfLines={1}>
        {item.artist}
      </Text>
    </Pressable>
  );

  if (loading && albums.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-ink items-center justify-center">
        <ActivityIndicator color="#4db8ff" size="large" />
        <Text className="text-t3 text-[11px] tracking-[1.5px] mt-3">
          LOADING LIBRARY {count > 0 ? `· ${count}` : ''}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header — large title iOS-style */}
        <View className="px-4 pt-2 pb-3 flex-row items-end justify-between">
          <View>
            <Text className="text-ac text-[11px] tracking-[3px] font-medium">LIBRARY</Text>
            <Text className="text-t1 text-[32px] font-extrabold tracking-tighter mt-0.5">Albums</Text>
            <Text className="text-t3 text-[12px] tracking-wide mt-0.5">{albums.length} in library</Text>
          </View>
          <Pressable onPress={onLogout} hitSlop={10} className="p-2 active:opacity-50">
            <LogOut color="#6B7280" size={20} />
          </Pressable>
        </View>

        {/* Search input — soft glass */}
        <View className="px-4 mb-3">
          <View className="bg-b0 border border-b1 rounded-xl flex-row items-center px-3 py-2">
            <Search color="#6B7280" size={16} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search albums or artists"
              placeholderTextColor="#6B7280"
              className="ml-2 flex-1 text-t1 text-[14px]"
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          numColumns={COLS}
          contentContainerStyle={{ paddingHorizontal: HORIZ_PADDING, paddingBottom: insets.bottom + 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4db8ff"
              colors={['#4db8ff']}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <Text className="text-t3 text-center text-[13px] mt-12 tracking-wide">
                No albums match "{query}"
              </Text>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </View>
  );
}
