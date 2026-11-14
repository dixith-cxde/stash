import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Spring } from '@/motion/tokens';
import { useColors } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';

import { PressableSurface } from './PressableSurface';
import { Text } from './Text';

type Snack = { id: number; message: string; action?: { label: string; onPress: () => void } };

type SnackState = {
  current: Snack | null;
  show: (message: string, action?: Snack['action']) => void;
  hide: () => void;
};

let nextId = 1;

/** Global snackbar queue of one: a new message replaces the current one. */
export const useSnackbar = create<SnackState>((set) => ({
  current: null,
  show: (message, action) => set({ current: { id: nextId++, message, action } }),
  hide: () => set({ current: null }),
}));

export const showSnackbar = (message: string, action?: Snack['action']) => useSnackbar.getState().show(message, action);

/** M3: 4 s for a message; snackbars with an action (Undo) stay longer so it can be reached. */
const DURATION_MS = 4000;
const ACTION_DURATION_MS = 7000;
const ds = Spring.defaultSpatial;

/** Enters from below on defaultSpatial; leaves with a quick fade (fastEffects-like). */
const enter = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 24 }] },
    animations: {
      opacity: withSpring(1, Spring.defaultEffects),
      transform: [{ translateY: withSpring(0, ds) }],
    },
  };
};

/** Mount once at the root. Shows above the floating nav bar. */
export function SnackbarHost() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const current = useSnackbar((s) => s.current);
  const hide = useSnackbar((s) => s.hide);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(hide, current.action ? ACTION_DURATION_MS : DURATION_MS);
    return () => clearTimeout(t);
  }, [current, hide]);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: insets.bottom + Layout.navBarBottom + Layout.navBarHeight + 12 }]}
    >
      {current && (
        <Animated.View
          key={current.id}
          entering={enter}
          exiting={FadeOut.duration(150)}
          accessibilityLiveRegion="polite"
          style={[styles.snack, { backgroundColor: colors.inverseSurface }]}
        >
          <Text variant="bodyMedium" color="inverseOnSurface" style={{ flex: 1 }}>
            {current.message}
          </Text>
          {current.action && (
            <PressableSurface
              kind="button"
              corner={20}
              onPress={() => {
                current.action?.onPress();
                hide();
              }}
              style={styles.action}
            >
              <Text variant="labelLarge" color="inversePrimary">
                {current.action.label}
              </Text>
            </PressableSurface>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: Layout.gutter, right: Layout.gutter },
  snack: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 6,
    gap: 8,
  },
  action: { height: 40, paddingHorizontal: 14, justifyContent: 'center' },
});
