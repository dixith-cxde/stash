import { Canvas, Path } from '@shopify/react-native-skia';
import { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { springTo, useSprings } from '@/motion/springs';
import type { SpringToken } from '@/motion/tokens';

import { cubicsAt, maxRadius, morphFrom, type MorphPair, morphPath, shapeMorph } from './morph';
import { polygonFromCubics } from './morphMatch';
import type { MaterialShapeName } from './names';

type Props = {
  shape: MaterialShapeName;
  size: number;
  color: string;
  /** Rotation in degrees; animates with the same spring as the morph. */
  rotation?: number;
  /**
   * 'rotation' (default) sizes every shape by its max radius so it never clips at any angle
   * and all shapes read the same size; 'box' fills the square (use for static rotation 0).
   */
  fit?: 'rotation' | 'box';
  /** Morph spring. Defaults to fastSpatial (shape change is spatial motion). */
  spring?: SpringToken;
  style?: StyleProp<ViewStyle>;
};

/**
 * A MaterialShape that springs into the next `shape` on the UI thread, using androidx
 * Morph's corner-to-corner matching. A change mid-morph continues from the outline as
 * currently drawn, so interruptions never jump.
 */
export function MorphingShape({ shape, size, color, rotation = 0, fit = 'rotation', spring, style }: Props) {
  const springs = useSprings();
  const token = spring ?? springs.fastSpatial;

  const initial = shapeMorph(shape, shape);
  const current = useRef<{ shape: MaterialShapeName; pair: MorphPair }>({ shape, pair: initial });
  const from = useSharedValue(initial.from);
  const to = useSharedValue(initial.to);
  const radius = useSharedValue(fit === 'rotation' ? maxRadius(initial.to) : 0);
  const progress = useSharedValue(1);
  const angle = useSharedValue(rotation);

  useEffect(() => {
    const c = current.current;
    if (c.shape === shape) return;
    const p = Math.min(1, Math.max(0, progress.get()));
    const pair =
      p > 0.999 ? shapeMorph(c.shape, shape) : morphFrom(polygonFromCubics(cubicsAt(c.pair, p)), shape);
    current.current = { shape, pair };
    from.set(pair.from);
    to.set(pair.to);
    if (fit === 'rotation') radius.set(Math.max(maxRadius(pair.from), maxRadius(pair.to)));
    progress.set(0);
    progress.set(springTo(1, token));
  }, [shape, token, fit, from, to, radius, progress]);

  useEffect(() => {
    angle.set(springTo(rotation, token));
  }, [rotation, token, angle]);

  const path = useDerivedValue(() =>
    morphPath(from.get(), to.get(), progress.get(), size, angle.get(), radius.get()),
  );

  return (
    <Canvas style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Path path={path} color={color} />
    </Canvas>
  );
}
