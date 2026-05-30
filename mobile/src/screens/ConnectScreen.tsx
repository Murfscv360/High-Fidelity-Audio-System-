import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ping } from '../api/subsonic';
import { saveCreds, setState } from '../state/store';

function WaveBars() {
  const bars = useRef([20, 36, 52, 56, 48, 32, 20].map(() => new Animated.Value(0.4))).current;
  useEffect(() => {
    const loops = bars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 100),
          Animated.timing(v, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.4, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);
  const heights = [20, 36, 52, 56, 48, 32, 20];
  return (
    <View className="flex-row items-end gap-[5px] h-16 mb-4">
      {bars.map((v, i) => (
        <Animated.View
          key={i}
          className="w-[5px] rounded-full bg-ac"
          style={{ height: heights[i], transform: [{ scaleY: v }], shadowColor: '#4db8ff', shadowOpacity: 0.6, shadowRadius: 8 }}
        />
      ))}
    </View>
  );
}

export default function ConnectScreen({ navigation }: any) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConnect() {
    if (!user || !pass) {
      setError('Enter username and password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    setBusy(true); setError(null);
    Haptics.selectionAsync().catch(() => {});
    try {
      const ok = await ping({ user, pass });
      if (!ok) {
        setError('Cannot reach server — check credentials');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      }
      await saveCreds(user, pass);
      setState({ connected: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      navigation.replace('Library');
    } catch (e: any) {
      setError(e?.message ?? 'Connection failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-ink">
      <LinearGradient
        colors={['rgba(77,184,255,0.18)', 'transparent']}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 0.6 }}
        style={{ position: 'absolute', inset: 0 as any, top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center px-6">
          <View className="items-center mb-10">
            <WaveBars />
            <Text className="text-t1 text-[34px] font-extrabold tracking-brand">AURALIS</Text>
            <Text className="text-ac text-[11px] tracking-[4px] mt-1.5">HI-RES AUDIO</Text>
          </View>

          <View className="bg-panel border border-b1 rounded-2xl p-6 shadow-2xl">
            <Text className="text-t1 text-[17px] font-bold mb-1.5 tracking-tight">Connect to your library</Text>
            <Text className="text-t2 text-[13px] leading-5 mb-5">
              Enter your Navidrome credentials. Your audio streams from your server — nothing is uploaded.
            </Text>

            <Text className="text-t3 text-[10px] tracking-[2px] mb-1.5 font-medium">USERNAME</Text>
            <TextInput
              value={user}
              onChangeText={setUser}
              placeholder="Navidrome username"
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              className="bg-b0 border border-b2 rounded-xl text-t1 text-[15px] px-3.5 py-3.5"
            />

            <Text className="text-t3 text-[10px] tracking-[2px] mb-1.5 mt-3 font-medium">PASSWORD</Text>
            <TextInput
              value={pass}
              onChangeText={setPass}
              placeholder="Navidrome password"
              placeholderTextColor="#6B7280"
              secureTextEntry
              autoComplete="current-password"
              className="bg-b0 border border-b2 rounded-xl text-t1 text-[15px] px-3.5 py-3.5"
            />

            <Pressable
              onPress={onConnect}
              disabled={busy}
              className="bg-t1 rounded-pill py-3.5 items-center mt-6 active:opacity-80"
              style={({ pressed }) => ({ opacity: busy ? 0.5 : pressed ? 0.9 : 1 })}
            >
              {busy ? (
                <ActivityIndicator color="#0E141B" />
              ) : (
                <Text className="text-ink font-bold text-[15px] tracking-tight">Connect to library</Text>
              )}
            </Pressable>

            {error && (
              <Text className="text-err text-[12px] mt-3 text-center">{error}</Text>
            )}

            <Text className="text-t4 text-[10px] tracking-[1.5px] mt-5 text-center uppercase">
              Credentials stored locally · Never shared
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
