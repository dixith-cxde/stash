import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { ShareIntentProvider } from 'expo-share-intent';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { db } from '@/db/client';
import { CaptureListener } from '@/features/capture/CaptureListener';
import { LockScreen } from '@/features/lock/LockScreen';
import { processPreviewQueue } from '@/features/preview/fetchPreview';
import { installNavGuard } from '@/lib/navGuard';
import { AppThemeProvider, useAppTheme } from '@/theme/AppTheme';
import { CrashScreen } from '@/ui/CrashScreen';
import { PortalHost } from '@/ui/Portal';
import { SnackbarHost } from '@/ui/Snackbar';

import migrations from '../../drizzle/migrations';

SplashScreen.preventAutoHideAsync();
installNavGuard();

/** Any render error below the root shows the crash screen instead of a red box. */
export const ErrorBoundary = CrashScreen;

/** Stack options for routes that run their own TransitionScreen animation. */
const TRANSITION_SCREEN = {
  presentation: 'transparentModal',
  animation: 'none',
  contentStyle: { backgroundColor: 'transparent' },
} as const;

function ThemedStack() {
  const { colors, dark } = useAppTheme();
  const navTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: colors.surface, card: colors.surface, text: colors.onSurface, primary: colors.primary },
    };
  }, [colors, dark]);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <CaptureListener />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, animation: 'none' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="capture" options={TRANSITION_SCREEN} />
        {/* Screens animated by TransitionScreen: keep the previous screen visible underneath. */}
        <Stack.Screen name="item/[id]" options={TRANSITION_SCREEN} />
        <Stack.Screen name="note/[id]/index" options={TRANSITION_SCREEN} />
        <Stack.Screen name="highlight/[id]" options={TRANSITION_SCREEN} />
        <Stack.Screen name="find" options={TRANSITION_SCREEN} />
        <Stack.Screen name="article/[id]" options={TRANSITION_SCREEN} />
        <Stack.Screen name="pdf/[id]" options={TRANSITION_SCREEN} />
        <Stack.Screen name="file/[id]" options={TRANSITION_SCREEN} />
        <Stack.Screen name="image/[id]" options={TRANSITION_SCREEN} />
        <Stack.Screen name="welcome" options={TRANSITION_SCREEN} />
        <Stack.Screen name="links-check" options={TRANSITION_SCREEN} />
        <Stack.Screen name="note/[id]/edit" options={TRANSITION_SCREEN} />
        <Stack.Screen name="collection/[id]" options={TRANSITION_SCREEN} />
        <Stack.Screen name="collection/new" options={TRANSITION_SCREEN} />
        <Stack.Screen name="settings" options={TRANSITION_SCREEN} />
        <Stack.Screen name="dev/detail" options={TRANSITION_SCREEN} />
        <Stack.Screen name="dev/axis" options={TRANSITION_SCREEN} />
      </Stack>
      <PortalHost />
      <SnackbarHost />
      <LockScreen />
    </ThemeProvider>
  );
}

/** Deep links (shares, notifications, stash:// links) open over Home, so Back returns to the app. */
export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (success || error) SplashScreen.hideAsync();
    if (success) void processPreviewQueue(true);
  }, [success, error]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text>{`Database migration failed: ${error.message}`}</Text>
      </View>
    );
  }
  if (!success) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ShareIntentProvider options={{ resetOnBackground: true }}>
        <KeyboardProvider>
          <AppThemeProvider>
            <ThemedStack />
          </AppThemeProvider>
        </KeyboardProvider>
      </ShareIntentProvider>
    </GestureHandlerRootView>
  );
}
