import { useCallback, useLayoutEffect } from 'react';
import {
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import { cancelAnimation, useAnimatedStyle, useSharedValue, withDecay } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { springTo, useSprings } from '@/motion/springs';

export type Size = { w: number; h: number };

type Options = {
  /** The on-screen box the gestures live in. */
  viewport: Size;
  /** The content at scale 1 (laid out from the viewport's top-left). */
  content: Size;
  maxScale?: number;
  /** Scale a double tap zooms to (a second double tap goes back to 1). */
  doubleTapScale?: number;
  /** Single tap (waits for a possible double tap). */
  onTap?: () => void;
  /** The finger dragged the content up (reading further down) by a little. */
  onScrollDown?: () => void;
  /** Scale settled after a pinch or double tap. */
  onZoomEnd?: (scale: number) => void;
};

/** Where an axis may sit: centred when the content is smaller than the viewport, else edge to edge. */
function range(s: number, c: number, v: number): [number, number] {
  'worklet';
  const size = s * c;
  if (size <= v) {
    const mid = (v - size) / 2;
    return [mid, mid];
  }
  return [v - size, 0];
}

function clampTo(t: number, s: number, c: number, v: number) {
  'worklet';
  const [lo, hi] = range(s, c, v);
  return Math.min(hi, Math.max(lo, t));
}

/** Past an edge the content follows the finger at a third of the distance. */
function resist(t: number, s: number, c: number, v: number) {
  'worklet';
  const [lo, hi] = range(s, c, v);
  if (t > hi) return hi + (t - hi) / 3;
  if (t < lo) return lo + (t - lo) / 3;
  return t;
}

/**
 * Free pan and zoom for a piece of content: pinch around the fingers, pan in both directions
 * with fling, double tap to zoom in on a point and back out. Everything runs on the UI thread.
 * Put `gesture` on a GestureDetector around a fixed box of `viewport` size, and `style` on the
 * content inside it (absolutely placed at the top-left, `content` size).
 */
export function useZoomPan({ viewport, content, maxScale = 5, doubleTapScale = 2.5, onTap, onScrollDown, onZoomEnd }: Options) {
  const springs = useSprings();
  const s = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ s: 1, tx: 0, ty: 0, fx: 0, fy: 0 });
  const scrolledDown = useSharedValue(false);
  const V = useSharedValue(viewport);
  const C = useSharedValue(content);

  // Keep the content in bounds when either size changes (rotation, page count known).
  useLayoutEffect(() => {
    V.set(viewport);
    C.set(content);
    tx.set(clampTo(tx.get(), s.get(), content.w, viewport.w));
    ty.set(clampTo(ty.get(), s.get(), content.h, viewport.h));
  }, [viewport, content, V, C, s, tx, ty]);

  const stop = () => {
    'worklet';
    cancelAnimation(s);
    cancelAnimation(tx);
    cancelAnimation(ty);
  };

  /** Spring to `target` scale keeping the content point under (px, py) in place, or centring it. */
  const zoomTo = (target: number, px: number, py: number, centre: boolean) => {
    'worklet';
    const v = V.get();
    const c = C.get();
    const cs = s.get();
    const cx = (px - tx.get()) / cs;
    const cy = (py - ty.get()) / cs;
    const nx = clampTo((centre ? v.w / 2 : px) - target * cx, target, c.w, v.w);
    const ny = clampTo((centre ? v.h / 2 : py) - target * cy, target, c.h, v.h);
    s.set(springTo(target, springs.defaultSpatial));
    tx.set(springTo(nx, springs.defaultSpatial));
    ty.set(springTo(ny, springs.defaultSpatial));
    if (onZoomEnd) scheduleOnRN(onZoomEnd, target);
  };

  const pinch = usePinchGesture({
    onBegin: () => {
      'worklet';
      stop();
    },
    onActivate: (e) => {
      'worklet';
      start.set({ s: s.get(), tx: tx.get(), ty: ty.get(), fx: e.focalX, fy: e.focalY });
    },
    onUpdate: (e) => {
      'worklet';
      const st = start.get();
      let ns = st.s * e.scale;
      if (ns < 1) ns = 1 - (1 - ns) / 3;
      if (ns > maxScale) ns = maxScale + (ns - maxScale) / 3;
      const cx = (st.fx - st.tx) / st.s;
      const cy = (st.fy - st.ty) / st.s;
      s.set(ns);
      tx.set(e.focalX - ns * cx);
      ty.set(e.focalY - ns * cy);
    },
    onDeactivate: (e) => {
      'worklet';
      zoomTo(Math.min(maxScale, Math.max(1, s.get())), e.focalX, e.focalY, false);
    },
  });

  const pan = usePanGesture({
    maxPointers: 1,
    onBegin: () => {
      'worklet';
      stop();
    },
    onActivate: () => {
      'worklet';
      start.set({ s: s.get(), tx: tx.get(), ty: ty.get(), fx: 0, fy: 0 });
      scrolledDown.set(false);
    },
    onUpdate: (e) => {
      'worklet';
      const st = start.get();
      const v = V.get();
      const c = C.get();
      const cs = s.get();
      tx.set(resist(st.tx + e.translationX, cs, c.w, v.w));
      ty.set(resist(st.ty + e.translationY, cs, c.h, v.h));
      if (onScrollDown && !scrolledDown.get() && e.translationY < -24) {
        scrolledDown.set(true);
        scheduleOnRN(onScrollDown);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      const v = V.get();
      const c = C.get();
      const cs = s.get();
      tx.set(withDecay({ velocity: e.velocityX, clamp: range(cs, c.w, v.w), rubberBandEffect: true }));
      ty.set(withDecay({ velocity: e.velocityY, clamp: range(cs, c.h, v.h), rubberBandEffect: true }));
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDistance: 24,
    onActivate: (e) => {
      'worklet';
      if (s.get() > 1.05) zoomTo(1, e.x, e.y, false);
      else zoomTo(doubleTapScale, e.x, e.y, true);
    },
  });

  const singleTap = useTapGesture({
    maxDistance: 10,
    onActivate: () => {
      'worklet';
      if (onTap) scheduleOnRN(onTap);
    },
  });

  const taps = useExclusiveGestures(doubleTap, singleTap);
  const gesture = useSimultaneousGestures(pinch, pan, taps);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: s.get() }],
  }));

  /** Puts content y at the top of the viewport (plus `offset`), at the current scale. */
  const scrollToY = useCallback(
    (y: number, offset = 0) => {
      cancelAnimation(ty);
      ty.set(clampTo(offset - s.get() * y, s.get(), C.get().h, V.get().h));
    },
    [s, ty, C, V],
  );

  return { gesture, style, scale: s, tx, ty, scrollToY };
}

/** The content style that goes with `useZoomPan`: placed at the top-left, scaled from there. */
export const zoomContentBase = { position: 'absolute', left: 0, top: 0, transformOrigin: 'left top' } as const;
