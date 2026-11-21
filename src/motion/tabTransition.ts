import type { BottomTabNavigationOptions } from 'expo-router/tabs';
import { Animated } from 'react-native';

import { MotionSpec, Spring } from './tokens';

const { stiffness, damping, mass } = Spring.defaultSpatial;
const fx = Spring.defaultEffects;

type TabTransition = Pick<BottomTabNavigationOptions, 'transitionSpec' | 'sceneStyleInterpolator'>;

/**
 * Per-tab "peek" (0 or 1, native driver). While a tab is part of a swipe (the dragged tab and
 * its neighbours) its peek is 1: the fade-through is overridden (full opacity, no scale), so
 * TabSwipe can slide the neighbour in beside the dragged tab and keep it visible through the
 * tab change. Back to 0 once the swipe settles; tab-bar taps never touch it.
 */
const peeks = new Map<string, Animated.Value>();
const ONE = new Animated.Value(1);

function peekValue(name: string) {
  let v = peeks.get(name);
  if (!v) {
    v = new Animated.Value(0);
    peeks.set(name, v);
  }
  return v;
}

export function setPeek(name: string, on: boolean) {
  peekValue(name).setValue(on ? 1 : 0);
}

/**
 * The navigator calls the interpolator on every render. Building the Animated graph once per
 * tab (per progress value, which the navigator keeps for the route's lifetime) and returning
 * the same style keeps the native driver from tearing it down and rebuilding it each time.
 */
type Interpolator = NonNullable<TabTransition['sceneStyleInterpolator']>;
type SceneStyle = ReturnType<Interpolator>;
function perProgress(build: (progress: Animated.Value) => SceneStyle): Interpolator {
  const styles = new WeakMap<object, SceneStyle>();
  return ({ current }) => {
    let s = styles.get(current.progress);
    if (!s) {
      s = build(current.progress as Animated.Value);
      styles.set(current.progress, s);
    }
    return s;
  };
}

/** One options object per tab, so the screen options stay the same between renders. */
const full = new Map<string, TabTransition>();
const reduced = new Map<string, TabTransition>();
function cachedTransition(cache: Map<string, TabTransition>, name: string, make: () => TabTransition) {
  let t = cache.get(name);
  if (!t) {
    t = make();
    cache.set(name, t);
  }
  return t;
}

/** Outgoing tab gone by halfway; incoming tab hidden until halfway, then fades in. */
const fadeThroughOpacity = (progress: Animated.Value) =>
  progress.interpolate({
    inputRange: [-1, -0.5, 0, 0.5, 1],
    outputRange: [0, 0, 1, 0, 0],
    extrapolate: 'clamp',
  });

/** max(fade-through opacity, peek). */
const opacityFor = (progress: Animated.Value, peek: Animated.Value) =>
  Animated.add(fadeThroughOpacity(progress), peek).interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

/**
 * Fade through between tabs (docs/animation.md §6), run by the tab navigator on the native
 * driver: it starts in the same commit as the tab change and never waits on JS.
 *
 * Each tab's progress goes ±1 → 0 as it comes in and 0 → ∓1 as it leaves. The outgoing tab
 * fades out over the first half; the incoming one stays hidden until halfway, then fades in
 * while it scales 0.92 → 1. One defaultSpatial spring drives both. A peeking tab (swipe) keeps
 * full opacity and scale 1.
 */
export function tabTransition(name: string): TabTransition {
  return cachedTransition(full, name, () => {
    const peek = peekValue(name);
    const notPeeking = peek.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
    return {
      transitionSpec: { animation: 'spring', config: { stiffness, damping, mass } },
      sceneStyleInterpolator: perProgress((progress) => {
        // scale = 1 + (fadeThroughScale - 1) · |progress| · (1 - peek)
        const shrink = progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [MotionSpec.fadeThroughScale - 1, 0, MotionSpec.fadeThroughScale - 1],
        });
        return {
          sceneStyle: {
            opacity: opacityFor(progress, peek),
            transform: [{ scale: Animated.add(ONE, Animated.multiply(shrink, notPeeking)) }],
          },
        };
      }),
    };
  });
}

/**
 * Reduced motion (docs/animation.md §10.6): the same fade through without the scale, on a
 * defaultEffects spring (no overshoot). The tab navigator runs RN Animated, which ignores
 * Reanimated's reduced-motion handling, so this has to be chosen explicitly.
 */
export function tabTransitionReduced(name: string): TabTransition {
  return cachedTransition(reduced, name, () => {
    const peek = peekValue(name);
    return {
      transitionSpec: {
        animation: 'spring',
        config: { stiffness: fx.stiffness, damping: fx.damping, mass: fx.mass, overshootClamping: true },
      },
      sceneStyleInterpolator: perProgress((progress) => ({ sceneStyle: { opacity: opacityFor(progress, peek) } })),
    };
  });
}
