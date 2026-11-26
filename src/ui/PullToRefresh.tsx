import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { springTo, useSprings } from '@/motion/springs';
import { LoadingIndicator } from '@/shapes/LoadingIndicator';
import { useColors } from '@/theme/AppTheme';
import { withAlpha } from '@/theme/palette';

/** Contained indicator size (androidx PullToRefreshDefaults.LoadingIndicatorContainer: 48dp). */
const SIZE = 48;
/** Pull distance (dp, after resistance) that starts a refresh on release. */
const TRIGGER = 72;
/** Where the indicator rests while refreshing (pull distance). */
const REST = 64;
/** Resisted pull approaches this distance and never passes it. */
const MAX = 132;

/** Finger travel → indicator travel: follows closely at first, then stiffens toward MAX. */
function resist(t: number) {
  'worklet';
  return t <= 0 ? 0 : MAX * (1 - Math.exp((-0.7 * t) / MAX));
}

/**
 * M3 Expressive pull to refresh (androidx PullToRefreshBox + LoadingIndicator): pulling down
 * at the top of a list slides a contained indicator in from the top edge. While pulling it is
 * determinate (the circle morphs into a soft burst and turns as you pull); released past the
 * threshold it stays and runs the shape-morphing loading loop until `refreshing` turns false.
 */
export function PullToRefresh({
  refreshing,
  onRefresh,
  scrollY,
  offset = 0,
  enabled = true,
  children,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  /** The list's vertical scroll offset; pulling only starts at the very top. */
  scrollY: SharedValue<number>;
  /** Top inset the indicator slides down from (status bar). */
  offset?: number;
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const springs = useSprings();
  const pull = useSharedValue(0);
  const progress = useDerivedValue(() => pull.get() / TRIGGER);

  // The pan only listens at the top, so it never steals an ordinary scroll.
  const [atTop, setAtTop] = useState(true);
  useAnimatedReaction(
    () => scrollY.get() <= 1,
    (now, before) => {
      if (now !== before) scheduleOnRN(setAtTop, now);
    },
  );

  useEffect(() => {
    pull.set(springTo(refreshing ? REST : 0, springs.defaultSpatial));
  }, [refreshing, pull, springs]);

  const pan = usePanGesture({
    enabled: enabled && atTop && !refreshing,
    activeOffsetY: 10,
    failOffsetY: -6,
    failOffsetX: [-20, 20],
    onUpdate: (e) => {
      'worklet';
      pull.set(resist(e.translationY));
    },
    onDeactivate: () => {
      'worklet';
      if (pull.get() >= TRIGGER) {
        pull.set(springTo(REST, springs.defaultSpatial));
        scheduleOnRN(onRefresh);
      } else {
        pull.set(springTo(0, springs.defaultSpatial));
      }
    },
  });

  const indicator = useAnimatedStyle(() => {
    const p = pull.get();
    return {
      opacity: interpolate(p, [0, 16], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: p - SIZE }, { scale: interpolate(p, [0, REST], [0.4, 1], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View style={{ flex: 1 }}>
      <GestureDetector gesture={pan}>
        <Animated.View style={{ flex: 1 }} collapsable={false}>
          {children}
        </Animated.View>
      </GestureDetector>
      <Animated.View pointerEvents="none" style={[styles.indicator, { top: offset }, indicator]}>
        <View style={[styles.container, { backgroundColor: colors.primaryContainer, boxShadow: `0px 2px 8px ${withAlpha(colors.shadow, 0.24)}` }]}>
          {refreshing ? (
            <LoadingIndicator size={SIZE} contained accessibilityLabel="Refreshing" />
          ) : (
            <LoadingIndicator size={SIZE} contained progress={progress} accessibilityLabel="Pull to refresh" />
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  container: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
});
