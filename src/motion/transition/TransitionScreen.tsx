import { router } from 'expo-router';
import { createContext, use, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAppTheme } from '@/theme/AppTheme';

import { fadeTo, springTo, useSprings } from '../springs';
import { MotionSpec, type SpringToken } from '../tokens';
import { type Origin, useTransitions } from './store';

type Kind = 'container' | 'axisY' | 'axisX';
/** `fade`: what every kind becomes with reduced motion on (docs/animation.md §10.6). */
type Mode = Kind | 'fade';

const CloseContext = createContext<() => void>(() => router.back());

/** Close the current transition screen with its exit animation (use for in-page back buttons). */
export const useTransitionClose = () => use(CloseContext);

type Props = {
  kind: Kind;
  /** Container transform: the `origin` route param set by useContainerSource. */
  origin?: string;
  /** Page background (defaults to surface). */
  background?: string;
  children: React.ReactNode;
};

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};
/** Maps p from [a, b] to [0, 1]. */
const band = (p: number, a: number, b: number) => {
  'worklet';
  return clamp01((p - a) / (b - a));
};

/** Back-swipe distance (fraction of width) or fling speed that commits a back. */
const COMMIT_FRACTION = 0.3;
const COMMIT_VELOCITY = 800;
const EDGE = 24;

/**
 * Edge swipe that drives the back preview (0..1 in `back`) and commits past 30% or on a fling.
 */
function useEdgeBack(
  fromLeft: boolean,
  width: number,
  back: SharedValue<number>,
  close: (velocity?: number) => void,
  spring: SpringToken,
) {
  return usePanGesture({
    activeOffsetX: fromLeft ? 8 : -8,
    failOffsetY: [-30, 30],
    onUpdate: (e) => {
      'worklet';
      back.set(clamp01((fromLeft ? e.translationX : -e.translationX) / width));
    },
    onDeactivate: (e) => {
      'worklet';
      const v = fromLeft ? e.velocityX : -e.velocityX;
      if (back.get() > COMMIT_FRACTION || v > COMMIT_VELOCITY) {
        back.set(springTo(0, spring));
        close(-Math.abs(v) / width);
      } else {
        back.set(springTo(0, spring, -v / width));
      }
    },
  });
}

/**
 * Animates a pushed screen in and out (docs/animation.md §6). The route must be presented
 * as `transparentModal` with `animation: 'none'` so the previous screen stays visible.
 *
 * - container: grows out of the tapped card and shrinks back into it (bounds + corners on
 *   defaultSpatial; scrim 32%; page content in over 12–45%, card content out over 0–15%).
 *   Closing hands back to the screen underneath once the page is ~home (p < 0.03).
 * - axisY / axisX: shared axis: slides 30dp and fades (defaultSpatial + defaultEffects).
 *
 * Edge swipes preview the back like Android predictive back: the page scales to 90%,
 * shifts toward the swipe and rounds its corners; release past 30% (or a fling) commits.
 * Hardware back and useTransitionClose() run the same exit.
 *
 * With reduced motion on, every kind becomes a plain cross-fade on effects springs: no
 * growth, slide or bounce (the spatial springs jump to their targets).
 */
export function TransitionScreen({ kind, origin: originId, background, children }: Props) {
  const { colors } = useAppTheme();
  const springs = useSprings();
  const reduced = useReducedMotion();
  const { width: W, height: H } = useWindowDimensions();
  const [origin] = useState<Origin | undefined>(() =>
    originId ? useTransitions.getState().origins[originId] : undefined,
  );
  useLayoutEffect(() => {
    if (originId) useTransitions.getState().claim(originId);
  }, [originId]);
  const mode: Mode = reduced ? 'fade' : kind === 'container' && !origin ? 'axisY' : kind;
  const fadeOnly = mode === 'fade';
  const bg = background ?? colors.surface;

  const p = useSharedValue(0);
  const fade = useSharedValue(0);
  const back = useSharedValue(0);
  const closing = useSharedValue(false);

  // The page body mounts one frame after the container starts growing: the spring runs on
  // the UI thread meanwhile, so a heavy screen never delays the first frame of the open.
  // Its content only fades in from 12% progress, so the deferral is never visible.
  const [ready, setReady] = useState(mode !== 'container');
  useEffect(() => {
    p.set(springTo(1, springs.defaultSpatial));
    fade.set(fadeOnly ? fadeTo(1, springs.defaultEffects) : springTo(1, springs.defaultEffects));
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, [p, fade, springs, fadeOnly]);

  const finish = useCallback(() => {
    if (originId) useTransitions.getState().settle(originId);
    router.back();
  }, [originId]);

  const close = useCallback(
    (velocity = 0) => {
      'worklet';
      if (closing.get()) return;
      closing.set(true);
      fade.set(fadeOnly ? fadeTo(0, springs.fastEffects) : springTo(0, springs.fastEffects));
      p.set(springTo(0, springs.defaultSpatial, velocity));
    },
    [closing, fade, p, springs, fadeOnly],
  );

  // Hand back to the screen underneath as soon as the page is visually home, instead of
  // waiting for the spring's long, invisible settling tail. A reduced-motion fade waits for
  // the fade instead (p has already jumped home).
  const finished = useSharedValue(false);
  useAnimatedReaction(
    () => closing.get() && (fadeOnly ? fade.get() : p.get()) < 0.03,
    (done) => {
      if (done && !finished.get()) {
        finished.set(true);
        scheduleOnRN(finish);
      }
    },
  );

  const closeFromJs = useCallback(() => close(0), [close]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeFromJs();
      return true;
    });
    return () => sub.remove();
  }, [closeFromJs]);

  const leftPan = useEdgeBack(true, W, back, close, springs.defaultSpatial);
  const rightPan = useEdgeBack(false, W, back, close, springs.defaultSpatial);

  // Predictive-back preview: scale to 90%, shift up to (W/20 − 8) toward the swipe, round corners.
  const preview = () => {
    'worklet';
    const b = back.get();
    return {
      scale: 1 - (1 - MotionSpec.backMinScale) * b,
      shift: (W / 20 - MotionSpec.backMargin) * b,
      corner: MotionSpec.backCorner * b,
    };
  };

  const scrim = useAnimatedStyle(() => ({
    opacity: MotionSpec.scrimOpacity * clamp01(mode === 'container' ? p.get() : fade.get()),
  }));

  // Worklets capture only the numbers: the origin also holds the card's React snapshot,
  // which can't (and shouldn't) be copied to the UI thread.
  const frame = origin
    ? { x: origin.x, y: origin.y, width: origin.width, height: origin.height, corner: origin.corner }
    : undefined;

  const container = useAnimatedStyle(() => {
    const pv = preview();
    if (mode !== 'container' || !frame) {
      const axis = (1 - p.get()) * MotionSpec.sharedAxisDistance;
      return {
        left: 0,
        top: 0,
        width: W,
        height: H,
        opacity: fade.get(),
        borderRadius: pv.corner,
        transform: [
          { translateX: (mode === 'axisX' ? axis : 0) + pv.shift },
          { translateY: mode === 'axisY' ? axis : 0 },
          { scale: pv.scale },
        ],
      };
    }
    const t = p.get();
    return {
      left: frame.x + (0 - frame.x) * t,
      top: frame.y + (0 - frame.y) * t,
      width: frame.width + (W - frame.width) * t,
      height: frame.height + (H - frame.height) * t,
      borderRadius: Math.max(pv.corner, frame.corner * (1 - clamp01(t))),
      backgroundColor: bg,
      transform: [{ translateX: pv.shift }, { scale: pv.scale }],
    };
  });

  // Page content: laid out at full size, scaled with the container width, fading in 25–75%.
  const content = useAnimatedStyle(() => {
    if (mode !== 'container' || !frame) return { opacity: 1, transform: [{ scale: 1 }] };
    const t = p.get();
    const w = frame.width + (W - frame.width) * t;
    return { opacity: band(t, 0.12, 0.45), transform: [{ scale: w / W }] };
  });

  // Card snapshot: drawn at card size, scaled with the container, fading out over 0–25%.
  const ghost = useAnimatedStyle(() => {
    if (mode !== 'container' || !frame) return { opacity: 0 };
    const t = p.get();
    const w = frame.width + (W - frame.width) * t;
    return { opacity: 1 - band(t, 0, 0.15), transform: [{ scale: w / frame.width }] };
  });

  const containerBg = useAnimatedStyle(() => {
    if (mode !== 'container' || !frame) return { opacity: 0 };
    // The card color shows through while the page content is still fading in.
    return { opacity: 1 - band(p.get(), 0.12, 0.45) };
  });

  const ctx = useMemo(() => closeFromJs, [closeFromJs]);

  return (
    <CloseContext value={ctx}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrim]} />
        <Animated.View style={[styles.container, { backgroundColor: bg }, container]}>
          {origin && (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: origin.color }, containerBg]} />
          )}
          <Animated.View style={[{ width: W, height: H, transformOrigin: 'top left' }, content]}>{ready ? children : null}</Animated.View>
          {origin?.ghost && (
            <Animated.View
              pointerEvents="none"
              style={[{ position: 'absolute', left: 0, top: 0, width: origin.width, height: origin.height, transformOrigin: 'top left' }, ghost]}
            >
              {origin.ghost}
            </Animated.View>
          )}
        </Animated.View>
        <GestureDetector gesture={leftPan}>
          <View style={[styles.edge, { left: 0 }]} />
        </GestureDetector>
        <GestureDetector gesture={rightPan}>
          <View style={[styles.edge, { right: 0 }]} />
        </GestureDetector>
      </View>
    </CloseContext>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', overflow: 'hidden' },
  edge: { position: 'absolute', top: 0, bottom: 0, width: EDGE },
});
