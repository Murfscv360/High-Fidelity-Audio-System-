import './global.css';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { loadCredsFromStorage, setState } from './src/state/store';
import { ping } from './src/api/subsonic';
import ConnectScreen from './src/screens/ConnectScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import AlbumScreen from './src/screens/AlbumScreen';

const Stack = createNativeStackNavigator();

const NavTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: '#0E141B',
    card: '#0E141B',
    text: '#F2F2F2',
    primary: '#4db8ff',
    border: 'rgba(255,255,255,0.08)',
    notification: '#4db8ff',
  },
};

export default function App() {
  const [initialRoute, setInitialRoute] = useState<'Connect' | 'Library' | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
      } catch {}

      const creds = await loadCredsFromStorage();
      if (creds) {
        const ok = await ping(creds);
        if (ok) {
          setState({ connected: true });
          setInitialRoute('Library');
          return;
        }
      }
      setInitialRoute('Connect');
    })();
  }, []);

  if (!initialRoute) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <ActivityIndicator color="#4db8ff" size="large" />
        <Text className="mt-4 text-t3 text-[11px] tracking-brand">AURALIS</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0E141B" />
        <NavigationContainer theme={NavTheme}>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0E141B' },
              animation: 'slide_from_right',
              gestureEnabled: true,
            }}
          >
            <Stack.Screen name="Connect" component={ConnectScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="Library" component={LibraryScreen} />
            <Stack.Screen name="Album"   component={AlbumScreen} options={{ animation: 'slide_from_bottom' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
