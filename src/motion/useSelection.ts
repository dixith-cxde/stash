import { useEffect } from 'react';
import { type SharedValue, useAnimatedReaction, useSharedValue } from 'react-native-reanimated';

import { springTo, useSprings } from './springs';
import type { SpringName } from './tokens';

/**
 * Animates a boolean as two progress values (0 → 1), per M3 Expressive: `shape` for
 * size/corners on a spatial spring (bounces), `color` for fills/text on an effects spring
 * (never overshoots). androidx ToggleButton: shape fastSpatial, color defaultEffects.
 */
export function useSelection(
  selected: boolean,
  { shape = 'fastSpatial', color = 'defaultEffects' }: { shape?: SpringName; color?: SpringName } = {},
) {
  const springs = useSprings();
  const shapeP = useSharedValue(selected ? 1 : 0);
  const colorP = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    shapeP.set(springTo(selected ? 1 : 0, springs[shape]));
    colorP.set(springTo(selected ? 1 : 0, springs[color]));
  }, [selected, springs, shape, color, shapeP, colorP]);
  return { shape: shapeP, color: colorP };
}

/** Per-corner radii: top-left, top-right, bottom-right, bottom-left. */
export type Corners4 = [number, number, number, number];

export const uniform = (r: number): Corners4 => [r, r, r, r];

/** Connected-group corners: `outer` on the group's ends, `inner` where buttons meet. */
export function connectedCorners(index: number, count: number, outer: number, inner: number): Corners4 {
  const first = index === 0;
  const last = index === count - 1;
  const l = first ? outer : inner;
  const r = last ? outer : inner;
  return [l, r, r, l];
}

/** Worklet: corner style from rest corners, pressed corner cap and press progress. */
export function cornerStyle(rest: Corners4, pressedCap: number, pressed: number) {
  'worklet';
  const at = (r: number) => r + (Math.min(r, pressedCap) - r) * pressed;
  return {
    borderTopLeftRadius: at(rest[0]),
    borderTopRightRadius: at(rest[1]),
    borderBottomRightRadius: at(rest[2]),
    borderBottomLeftRadius: at(rest[3]),
  };
}

/**
 * useSelection driven from the UI thread: `selected` is a shared value holding the chosen
 * index. A tap can set it in its gesture worklet, so the selection starts moving in the same
 * frame as the tap, without waiting for React to re-render (single-select groups).
 * `initiallySelected` seeds the first frame from props, so render never reads the shared value
 * (a render-time read blocks on the UI thread).
 */
export function useSharedSelection(
  selected: SharedValue<number>,
  index: number,
  initiallySelected: boolean,
  { shape = 'fastSpatial', color = 'defaultEffects' }: { shape?: SpringName; color?: SpringName } = {},
) {
  const springs = useSprings();
  const on = initiallySelected ? 1 : 0;
  const shapeP = useSharedValue(on);
  const colorP = useSharedValue(on);
  const shapeSpring = springs[shape];
  const colorSpring = springs[color];
  useAnimatedReaction(
    () => (selected.get() === index ? 1 : 0),
    (next, prev) => {
      if (prev === null || next === prev) return;
      shapeP.set(springTo(next, shapeSpring));
      colorP.set(springTo(next, colorSpring));
    },
  );
  return { shape: shapeP, color: colorP };
}
