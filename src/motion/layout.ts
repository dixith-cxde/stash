/**
 * Layout animation presets for lists (docs/animation.md §7): items that stay reflow on
 * defaultSpatial, new items fade in and rise 12dp, removed items fade and shrink to 92%.
 */
import { FadeIn, FadeOut, LinearTransition, withSpring, withTiming } from 'react-native-reanimated';

import { Duration, Ease, Spring, type SpringToken } from './tokens';

const ds = Spring.defaultSpatial;

export const reflow = LinearTransition.springify().mass(ds.mass).stiffness(ds.stiffness).damping(ds.damping);

/** Fade in on an effects spring (no overshoot). Defaults to defaultEffects. */
export const fadeIn = (t: SpringToken = Spring.defaultEffects) =>
  FadeIn.springify().mass(t.mass).stiffness(t.stiffness).damping(t.damping).overshootClamping(1);

/** Fade out on an effects spring (no overshoot). Defaults to fastEffects: exits are quicker. */
export const fadeOut = (t: SpringToken = Spring.fastEffects) =>
  FadeOut.springify().mass(t.mass).stiffness(t.stiffness).damping(t.damping).overshootClamping(1);

/** Content swaps and small status changes: in on defaultEffects, out on fastEffects. */
export const enterFade = fadeIn();
export const exitFade = fadeOut();

export const enterRise = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 12 }, { scale: 0.98 }] },
    animations: {
      opacity: withSpring(1, Spring.defaultEffects),
      transform: [{ translateY: withSpring(0, ds) }, { scale: withSpring(1, ds) }],
    },
  };
};

export const exitShrink = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: Duration.short3, easing: Ease.emphasizedAccelerate }),
      transform: [{ scale: withTiming(0.92, { duration: Duration.short3, easing: Ease.emphasizedAccelerate }) }],
    },
  };
};
