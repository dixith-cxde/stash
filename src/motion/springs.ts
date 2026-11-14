import { ReduceMotion, useReducedMotion, withSpring } from 'react-native-reanimated';

import { Spring, type SpringName, type SpringToken, StandardSpring } from './tokens';

/**
 * Spring tokens adjusted for the reduced-motion setting: spatial springs lose their bounce
 * (MotionScheme.standard()), effects springs are unchanged. Call once per component and pass
 * the result into worklets.
 */
export function useSprings(): Record<SpringName, SpringToken> {
  const reduced = useReducedMotion();
  return reduced ? { ...Spring, ...StandardSpring } : Spring;
}

/** withSpring with a token and an optional release velocity (gesture continuity). */
export function springTo(toValue: number, token: SpringToken, velocity?: number, callback?: (finished?: boolean) => void) {
  'worklet';
  return withSpring(toValue, { ...token, velocity, reduceMotion: ReduceMotion.System }, callback);
}

/**
 * An effects spring that still runs when reduced motion is on. springTo (like every
 * Reanimated animation by default) jumps straight to its target under reduced motion; use
 * this only for the cross-fade that stands in for spatial motion (docs/animation.md §10.6).
 */
export function fadeTo(toValue: number, token: SpringToken, callback?: (finished?: boolean) => void) {
  'worklet';
  return withSpring(toValue, { ...token, reduceMotion: ReduceMotion.Never }, callback);
}
