import { useLayoutEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { springTo, useSprings } from '@/motion/springs';
import type { IconName } from '@/theme/icons';
import type { Corners4 } from '@/motion/useSelection';
import { Ico } from '@/ui/Ico';
import { cornersStyle } from '@/ui/List';
import { Text } from '@/ui/Text';

export type SwipeAction = {
  icon: IconName;
  label: string;
  /** Container and content colors of the revealed action. */
  bg: string;
  fg: string;
  onCommit: () => void;
  /** The row leaves the list (it slides out); otherwise it springs back after committing. */
  removes?: boolean;
};

/** Past this share of the row width, or a fling, the action commits. */
const COMMIT_FRACTION = 0.3;
const FLING = 900;

/**
 * Swipe actions for a list row (M3 list item swipe): the row follows the finger 1:1 over a
 * tonal action that grows in as it is revealed. Releasing past the threshold commits:
 * removing actions slide the row out (fastSpatial), others spring back (defaultSpatial).
 * Horizontal only: a vertical move fails the pan, so the list still scrolls.
 */
export function SwipeRow({
  start,
  end,
  radius,
  resetKey,
  children,
}: {
  /** Recycled list cells: a new key puts the row back in place (a hidden row slid away). */
  resetKey?: string;
  /** Revealed when swiping right. */
  start?: SwipeAction;
  /** Revealed when swiping left. */
  end?: SwipeAction;
  /** Uniform radius, or per-corner radii (a row inside a segmented group). */
  radius: number | Corners4;
  children: React.ReactNode;
}) {
  const springs = useSprings();
  const { width: W } = useWindowDimensions();
  const x = useSharedValue(0);
  useLayoutEffect(() => {
    x.set(0);
  }, [resetKey, x]);

  const pan = usePanGesture({
    activeOffsetX: [-14, 14],
    failOffsetY: [-10, 10],
    onUpdate: (e) => {
      'worklet';
      let t = e.translationX;
      if ((t > 0 && !start) || (t < 0 && !end)) t = t / 6; // no action that way: resist
      x.set(t);
    },
    onDeactivate: (e) => {
      'worklet';
      const t = x.get();
      const action = t > 0 ? start : end;
      const commit = !!action && (Math.abs(t) > W * COMMIT_FRACTION || Math.abs(e.velocityX) > FLING) && Math.sign(e.velocityX || t) === Math.sign(t);
      if (commit && action?.removes) {
        x.set(
          springTo(Math.sign(t) * W, springs.fastSpatial, e.velocityX, (done) => {
            'worklet';
            if (done) scheduleOnRN(action.onCommit);
          }),
        );
        return;
      }
      if (commit && action) scheduleOnRN(action.onCommit);
      x.set(springTo(0, springs.defaultSpatial, e.velocityX));
    },
  });

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const startStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, x.get()) / (W * COMMIT_FRACTION));
    return { opacity: p > 0 ? 1 : 0, transform: [{ scale: interpolate(p, [0, 1], [0.6, 1]) }] };
  });
  const endStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, -x.get()) / (W * COMMIT_FRACTION));
    return { opacity: p > 0 ? 1 : 0, transform: [{ scale: interpolate(p, [0, 1], [0.6, 1]) }] };
  });
  const startBg = useAnimatedStyle(() => ({ opacity: x.get() > 0 ? 1 : 0 }));
  const endBg = useAnimatedStyle(() => ({ opacity: x.get() < 0 ? 1 : 0 }));

  return (
    <View>
      {start && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.under, { backgroundColor: start.bg, ...radiusStyle(radius) }, startBg]}>
          <Animated.View style={[styles.action, startStyle]}>
            <Ico name={start.icon} size={22} color={start.fg} />
            <Text variant="labelLargeEmphasized" color={start.fg} style={{ fontWeight: '700' }}>
              {start.label}
            </Text>
          </Animated.View>
        </Animated.View>
      )}
      {end && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.under, { justifyContent: 'flex-end', backgroundColor: end.bg, ...radiusStyle(radius) }, endBg]}>
          <Animated.View style={[styles.action, endStyle]}>
            <Text variant="labelLargeEmphasized" color={end.fg} style={{ fontWeight: '700' }}>
              {end.label}
            </Text>
            <Ico name={end.icon} size={22} color={end.fg} />
          </Animated.View>
        </Animated.View>
      )}
      <GestureDetector gesture={pan}>
        <Animated.View style={row}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  under: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

const radiusStyle = (r: number | Corners4) => (typeof r === 'number' ? { borderRadius: r } : cornersStyle(r));
