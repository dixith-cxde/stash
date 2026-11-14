/**
 * Layout animation presets for lists (docs/animation.md §7): items that stay reflow on
 * defaultSpatial, new items fade in and rise 12dp, removed items fade and shrink to 92%.
 */
import { LinearTransition, withSpring, withTiming } from 'react-native-reanimated';

import { Duration, Ease, Spring } from './tokens';

const ds = Spring.defaultSpatial;

export const reflow = LinearTransition.springify().mass(ds.mass).stiffness(ds.stiffness).damping(ds.damping);

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
