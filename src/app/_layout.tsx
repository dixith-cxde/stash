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
import { processPreviewQueue } from '@/features/preview/fetchPreview';
import { AppThemeProvider, useAppTheme } from '@/theme/AppTheme';
import { SnackbarHost } from '@/ui/Snackbar';

import migrations from '../../drizzle/migrations';

SplashScreen.preventAutoHideAsync();

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
        <Stack.Screen name="capture" options={{ presentation: 'transparentModal', animation: 'none' }} />
      </Stack>
      <SnackbarHost />
    </ThemeProvider>
  );
}

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
