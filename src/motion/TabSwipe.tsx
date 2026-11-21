import type { ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { makeMutable, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { springTo, useSprings } from './springs';
import { setPeek } from './tabTransition';

/** Past this share of the width, or this fling speed (px/s), letting go changes tab. */
const COMMIT_FRACTION = 0.28;
const FLING = 600;
/** Dragging toward a side with no tab moves at this fraction of the finger (rubber band). */
const EDGE_RESIST = 0.25;

/**
 * Every tab's horizontal offset, by route name. Module-level so one tab's gesture worklet can
 * move its neighbours (captured when it is created) on the UI thread, frame by frame.
 */
const offsets = new Map<string, SharedValue<number>>();
function offsetOf(name: string) {
  let x = offsets.get(name);
  if (!x) {
    x = makeMutable(0);
    offsets.set(name, x);
  }
  return x;
}

/**
 * JS side of a swipe. `peeking` holds the tabs shown beside each other (see setPeek); they go
 * back to the plain fade-through once the swipe settles and no new drag has started.
 */
const swipe = { dragging: false, peeking: new Set<string>() };

function startPeek(names: string[]) {
  swipe.dragging = true;
  for (const n of names) {
    swipe.peeking.add(n);
    setPeek(n, true);
  }
}

function release() {
  swipe.dragging = false;
}

/**
 * The swipe has settled: hide the neighbours again (their progress is ±1, so the fade-through
 * makes them transparent) and park them at 0 behind the focused tab. `keep` is the tab now on
 * screen, which may still be finishing its spring.
 */
export function endTabSwipe(keep: string) {
  if (swipe.dragging || !swipe.peeking.size) return;
  for (const n of swipe.peeking) {
    setPeek(n, false);
    if (n !== keep) offsetOf(n).set(0);
  }
  swipe.peeking.clear();
}

/**
 * Wraps one tab screen. The screen follows the finger sideways with the previous and next tabs
 * attached on either side, like a pager: they stay mounted (the navigator keeps inactive tabs
 * attached) and "peek" in while dragging. Let go far or fast enough and both keep going on the
 * same spring and the tab changes; let go early and they spring back. It waits for 24dp of
 * sideways travel and gives way to vertical scrolling after 14dp; gestures inside that claim
 * the swipe sooner win (Feeds' swipe rows, the horizontal rails).
 *
 * The navigator's `transitionEnd` (and a spring-back) call endTabSwipe.
 */
export function TabSwipe({ order, current, onGo, children }: { order: readonly string[]; current: string; onGo: (name: string) => void; children: ReactNode }) {
  const springs = useSprings();
  const { width: W } = useWindowDimensions();
  const x = offsetOf(current);

  const i = order.indexOf(current);
  const prev = i > 0 ? order[i - 1] : null;
  const next = i >= 0 && i < order.length - 1 ? order[i + 1] : null;
  const prevX = prev ? offsetOf(prev) : null;
  const nextX = next ? offsetOf(next) : null;
  const involved = [current, prev, next].filter((n): n is string => !!n);

  const pan = usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-14, 14],
    onActivate: () => {
      'worklet';
      // Park the neighbours just off-screen before they become visible.
      prevX?.set(x.get() - W);
      nextX?.set(x.get() + W);
      scheduleOnRN(startPeek, involved);
    },
    onUpdate: (e) => {
      'worklet';
      const t = e.translationX;
      const at = (t < 0 && !nextX) || (t > 0 && !prevX) ? t * EDGE_RESIST : t;
      x.set(at);
      prevX?.set(at - W);
      nextX?.set(at + W);
    },
    onDeactivate: (e) => {
      'worklet';
      const t = x.get();
      const v = e.velocityX;
      const to = t < 0 ? next : prev;
      const incoming = t < 0 ? nextX : prevX;
      const far = Math.abs(t) > W * COMMIT_FRACTION || Math.abs(v) > FLING;
      const sameWay = Math.sign(v || t) === Math.sign(t);
      scheduleOnRN(release);
      if (!to || !incoming || !far || !sameWay) {
        x.set(
          springTo(0, springs.defaultSpatial, v, (done) => {
            'worklet';
            if (done) scheduleOnRN(endTabSwipe, current);
          }),
        );
        prevX?.set(springTo(-W, springs.defaultSpatial, v));
        nextX?.set(springTo(W, springs.defaultSpatial, v));
        return;
      }
      // Outgoing keeps moving off-screen; the incoming tab follows from right beside it.
      x.set(springTo(Math.sign(t) * W, springs.defaultSpatial, v));
      incoming.set(springTo(0, springs.defaultSpatial, v));
      scheduleOnRN(onGo, to);
    },
  });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1 }, style]} collapsable={false}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
