import { type ErrorBoundaryProps, router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Shape } from '@/shapes/Shape';
import { AppThemeProvider, useAppTheme } from '@/theme/AppTheme';

import { Button } from './Button';
import { Text } from './Text';

/**
 * Shown instead of a red screen when something throws while rendering (the root route's
 * ErrorBoundary). Your data is untouched; Try again re-renders, Go home resets navigation.
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <Body error={error} retry={retry} />
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

function Body({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const home = () => {
    try {
      router.replace('/');
    } catch {
      // Navigation itself may be what broke; retrying still works.
    }
    void retry();
  };
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <Shape name="cookie9Sided" size={96} color={colors.errorContainer} />
      <Text variant="headlineSmall" style={{ textAlign: 'center' }}>
        Something went wrong
      </Text>
      <Text variant="bodyMedium" color="onSurfaceVariant" style={{ textAlign: 'center' }}>
        Stash hit an error on this screen. Your saved items are safe.
      </Text>
      <ScrollView style={[styles.detail, { backgroundColor: colors.surfaceContainerLow }]} contentContainerStyle={{ padding: 12 }}>
        <Text variant="bodySmall" color="onSurfaceVariant" selectable>
          {error.message}
        </Text>
      </ScrollView>
      <View style={styles.actions}>
        <Button label="Try again" icon="redo" onPress={() => void retry()} grow />
        <Button label="Go home" icon="home" variant="tonal" onPress={home} grow />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 16, paddingHorizontal: 24 },
  detail: { alignSelf: 'stretch', maxHeight: 160, borderRadius: 16, flexGrow: 0 },
  actions: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
});
