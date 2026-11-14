import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { springTo, useSprings } from './springs';

type Options = {
  /** Selected slot. */
  index: number;
  /** Width of one slot (0 until measured). */
  slot: number;
  /** Offset of slot 0 from the container's left edge. */
  start?: number;
  /** Gap between the indicator and the slot edges. */
  inset?: number;
  /** Minimum indicator width (e.g. its height, so it never pinches thinner than a circle). */
  minWidth?: number;
};

/**
 * A selection indicator that glides between equal slots with its two edges on different
 * springs: the leading edge moves on fastSpatial, the trailing edge follows on
 * defaultSpatial, so the pill stretches toward its target and settles with a small
 * overshoot. Returns an animated style with translateX + width (position it absolutely at left 0).
 */
export function useGlide({ index, slot, start = 0, inset = 0, minWidth = 0 }: Options) {
  const springs = useSprings();
  const left = useSharedValue(0);
  const right = useSharedValue(0);
  const placed = useSharedValue(false);

  useEffect(() => {
    if (!slot) return;
    const l = start + index * slot + inset;
    const r = start + (index + 1) * slot - inset;
    if (!placed.get()) {
      left.set(l);
      right.set(r);
      placed.set(true);
      return;
    }
    const movingRight = l > left.get();
    left.set(springTo(l, movingRight ? springs.defaultSpatial : springs.fastSpatial));
    right.set(springTo(r, movingRight ? springs.fastSpatial : springs.defaultSpatial));
  }, [index, slot, start, inset, springs, left, right, placed]);

  return useAnimatedStyle(() => ({
    opacity: placed.get() ? 1 : 0,
    transform: [{ translateX: left.get() }],
    width: Math.max(minWidth, right.get() - left.get()),
  }));
}
