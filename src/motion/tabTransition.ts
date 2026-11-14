import type { BottomTabNavigationOptions } from 'expo-router/tabs';

import { MotionSpec, Spring } from './tokens';

const { stiffness, damping, mass } = Spring.defaultSpatial;

/**
 * Fade through between tabs (docs/animation.md §6), run by the tab navigator on the native
 * driver: it starts in the same commit as the tab change and never waits on JS.
 *
 * Each tab's progress goes ±1 → 0 as it comes in and 0 → ∓1 as it leaves. The outgoing tab
 * fades out over the first half; the incoming one stays hidden until halfway, then fades in
 * while it scales 0.92 → 1. One defaultSpatial spring drives both.
 */
export const TAB_TRANSITION: Pick<BottomTabNavigationOptions, 'transitionSpec' | 'sceneStyleInterpolator'> = {
  transitionSpec: { animation: 'spring', config: { stiffness, damping, mass } },
  sceneStyleInterpolator: ({ current }) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, -0.5, 0, 0.5, 1],
        outputRange: [0, 0, 1, 0, 0],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          scale: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [MotionSpec.fadeThroughScale, 1, MotionSpec.fadeThroughScale],
          }),
        },
      ],
    },
  }),
};
