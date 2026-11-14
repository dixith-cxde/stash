import { useFocusEffect } from 'expo-router';
import { useCallback, useId } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { springTo, useSprings } from './springs';
import { MotionSpec } from './tokens';

/** The FadeThrough that last had focus: returning to it (e.g. closing a page) skips the fade. */
let lastFocused: string | null = null;

/**
 * Fade through (docs/animation.md §6) for sibling screens such as tabs. Switching to this tab
 * fades it in on defaultEffects while it scales 0.92 → 1 on defaultSpatial. Coming back to
 * it after a page or sheet was open on top shows it immediately: it never hides itself on
 * blur, so the screen behind a closing page is always there.
 */
export function FadeThrough({ children }: { children: React.ReactNode }) {
  const id = useId();
  const springs = useSprings();
  const progress = useSharedValue(1);
  const scale = useSharedValue<number>(1);

  useFocusEffect(
    useCallback(() => {
      if (lastFocused !== null && lastFocused !== id) {
        progress.set(0);
        scale.set(MotionSpec.fadeThroughScale);
        progress.set(springTo(1, springs.defaultEffects));
        scale.set(springTo(1, springs.defaultSpatial));
      }
      lastFocused = id;
    }, [id, progress, scale, springs]),
  );

  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: scale.get() }],
  }));

  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}
