import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { exitFade } from '@/motion/layout';
import { useSettings } from '@/state/settings';
import { useColors } from '@/theme/AppTheme';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { Text } from '@/ui/Text';

import { installLockWatcher, unlock, useLock } from './lock';

/**
 * Covers the whole app while it is locked and asks for the system prompt right away.
 * Rendered last in the root layout so it sits above screens, sheets and snackbars.
 */
export function LockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const appLock = useSettings((s) => s.appLock);
  const locked = useLock((s) => s.locked) && appLock;

  useEffect(() => {
    const sub = installLockWatcher();
    return () => sub.remove();
  }, []);

  // Prompt as soon as the lock shows, but only while the app is in front.
  useEffect(() => {
    if (!locked) return;
    if (AppState.currentState === 'active') void unlock();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && useLock.getState().locked && !useLock.getState().authenticating) void unlock();
    });
    return () => sub.remove();
  }, [locked]);

  if (!locked) return null;
  return (
    <Animated.View
      exiting={exitFade}
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: colors.surface, paddingTop: insets.top, paddingBottom: insets.bottom + 32 }]}
    >
      <View style={styles.center}>
        <View style={[styles.badge, { backgroundColor: colors.primaryContainer }]}>
          <Ico name="lock" size={36} color={colors.onPrimaryContainer} />
        </View>
        <Text variant="headlineMediumEmphasized" accessibilityRole="header">
          Stash is locked
        </Text>
        <Text variant="bodyLarge" color="onSurfaceVariant" style={styles.body}>
          Use your fingerprint, face or screen lock to open it.
        </Text>
      </View>
      <Button label="Unlock" icon="fingerprint" onPress={() => void unlock()} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, elevation: 1000, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  badge: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  body: { textAlign: 'center' },
});
