import { useFocusEffect } from 'expo-router';
import { createContext, use, useCallback } from 'react';
import { type SharedValue, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { springTo, useSprings } from './springs';

/** 0 = floating chrome (nav bar) shown, 1 = hidden. */
const ChromeContext = createContext<SharedValue<number> | null>(null);

export function ChromeProvider({ children }: { children: React.ReactNode }) {
  const hidden = useSharedValue(0);
  return <ChromeContext value={hidden}>{children}</ChromeContext>;
}

export function useChromeHidden(): SharedValue<number> | null {
  return use(ChromeContext);
}

/** Scroll distance (dp) in one direction before the chrome reacts. */
const THRESHOLD = 12;
/** Near the top the chrome is always shown. */
const TOP_ZONE = 24;

/**
 * Scroll handler for tab screens: hides the floating nav bar while scrolling down and brings
 * it back on any upward scroll or near the top (androidx FloatingToolbar exitAlways
 * behaviour; snaps on defaultEffects so it never bounces off-screen). Focusing the screen
 * shows it again.
 */
export function useChromeScroll() {
  const hidden = use(ChromeContext);
  const springs = useSprings();
  const last = useSharedValue(0);
  const travel = useSharedValue(0);

  // The chrome is shared by every tab: a tab (or a page closing over it) always comes back
  // with the nav bar shown, whatever the previous screen's scroll left it at.
  useFocusEffect(
    useCallback(() => {
      travel.set(0);
      if (hidden && hidden.get() !== 0) hidden.set(springTo(0, springs.defaultEffects));
    }, [hidden, springs, travel]),
  );

  return useAnimatedScrollHandler({
    onScroll: (e) => {
      if (!hidden) return;
      const y = e.contentOffset.y;
      const dy = y - last.get();
      last.set(y);
      // Accumulate travel in the current direction; reset when it flips.
      const t = travel.get();
      travel.set(Math.sign(dy) === Math.sign(t) ? t + dy : dy);
      const target = y < TOP_ZONE ? 0 : travel.get() > THRESHOLD ? 1 : travel.get() < -THRESHOLD ? 0 : -1;
      if (target !== -1 && target !== Math.round(hidden.get())) hidden.set(springTo(target, springs.defaultEffects));
    },
  });
}
