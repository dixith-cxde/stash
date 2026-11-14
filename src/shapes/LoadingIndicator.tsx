import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { springTo } from '@/motion/springs';
import { ComponentSpring, MotionSpec } from '@/motion/tokens';
import { useColors } from '@/theme/AppTheme';

import { maxRadius, type MorphPair, morphPath, shapeMorph } from './morph';
import type { MaterialShapeName } from './names';

/** androidx LoadingIndicator indeterminate sequence. */
const SEQUENCE: MaterialShapeName[] = ['softBurst', 'cookie9Sided', 'pentagon', 'pill', 'sunny', 'cookie4Sided', 'oval'];

/** Feature-matched morph for each step of the sequence (last → first wraps around). */
const STEPS: MorphPair[] = SEQUENCE.map((s, i) => shapeMorph(s, SEQUENCE[(i + 1) % SEQUENCE.length]));

/** One scale for every shape (androidx sizes the indicator by the shapes' max bounds). */
const RADIUS = Math.max(...STEPS.map((p) => maxRadius(p.from)));

type Props = {
  /** Container size (M3: 48). The shape is 38/48 of it. */
  size?: number;
  /** Draw the circular container behind the shape (M3 "contained" variant). */
  contained?: boolean;
  /** Override the indicator color (defaults to primary, or onPrimaryContainer when contained). */
  color?: string;
  accessibilityLabel?: string;
};

/**
 * M3 Expressive loading indicator: morphs SoftBurst → Cookie9 → Pentagon → Pill → Sunny →
 * Cookie4 → Oval every 650 ms on spring(0.6, 200), turning +90° per morph on top of a
 * 360° / 4666 ms linear spin (androidx LoadingIndicator.kt). With reduced motion it only spins.
 */
export function LoadingIndicator({ size = 48, contained = false, color, accessibilityLabel = 'Loading' }: Props) {
  const colors = useColors();
  const reduced = useReducedMotion();
  const shapeSize = (size * 38) / 48;
  const inset = (size - shapeSize) / 2;

  const step = useSharedValue(0);
  const morph = useSharedValue(1);
  const spin = useSharedValue(0);
  const from = useSharedValue(STEPS[0].from);
  const to = useSharedValue(STEPS[0].from);

  useEffect(() => {
    spin.set(withRepeat(withTiming(360, { duration: MotionSpec.loaderRotationMs, easing: Easing.linear }), -1, false));
    if (reduced) return () => cancelAnimation(spin);
    let i = 0;
    const id = setInterval(() => {
      from.set(STEPS[i].from);
      to.set(STEPS[i].to);
      i = (i + 1) % SEQUENCE.length;
      step.set(step.get() + 1);
      morph.set(0);
      morph.set(springTo(1, ComponentSpring.loaderMorph));
    }, MotionSpec.loaderMorphIntervalMs);
    return () => {
      clearInterval(id);
      cancelAnimation(spin);
    };
  }, [reduced, spin, step, morph, from, to]);

  const path = useDerivedValue(() => {
    const rotation = spin.get() + (step.get() - 1 + morph.get()) * 90;
    return morphPath(from.get(), to.get(), morph.get(), shapeSize, rotation, RADIUS);
  });

  const fill = color ?? (contained ? colors.onPrimaryContainer : colors.primary);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}
    >
      <Canvas style={{ width: size, height: size }}>
        {contained && <Circle cx={size / 2} cy={size / 2} r={size / 2} color={colors.primaryContainer} />}
        <Path path={path} color={fill} transform={[{ translateX: inset }, { translateY: inset }]} />
      </Canvas>
    </View>
  );
}
