import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { springTo, useSprings } from './springs';
import { MotionSpec } from './tokens';

/**
 * Fade through (docs/animation.md §6) for sibling screens such as tabs: each time the screen
 * gains focus it fades in on slowEffects while scaling 0.92 → 1 on defaultSpatial. On blur
 * it resets, so the next visit plays again.
 */
export function FadeThrough({ children }: { children: React.ReactNode }) {
  const springs = useSprings();
  const progress = useSharedValue(0);
  const scale = useSharedValue<number>(MotionSpec.fadeThroughScale);

  useFocusEffect(
    useCallback(() => {
      progress.set(springTo(1, springs.slowEffects));
      scale.set(springTo(1, springs.defaultSpatial));
      return () => {
        progress.set(0);
        scale.set(MotionSpec.fadeThroughScale);
      };
    }, [progress, scale, springs]),
  );

  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: scale.get() }],
  }));

  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}
