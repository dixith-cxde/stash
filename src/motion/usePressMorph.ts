import { useTapGesture } from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useSprings } from './springs';
import { MotionSpec } from './tokens';

export type PressMorphKind =
  /** Buttons and icon buttons: no bounce (androidx Button uses effects springs). */
  | 'button'
  /** Cards, tiles, selectable items: bouncy fastSpatial. */
  | 'card';

type Options = {
  kind?: PressMorphKind;
  /** Corner radius at rest. */
  corner: number;
  /** Corner radius while held. Defaults to the card spec (14) for cards. */
  pressedCorner?: number;
  /** Scale while held. Defaults to 0.97 for cards, 1 for buttons. */
  pressedScale?: number;
  onPress?: () => void;
  onPressIn?: () => void;
  disabled?: boolean;
};

/** A touch that moves further than this (dp) is a scroll or drag, never a tap. */
const TAP_SLOP = 10;
/**
 * Holding still this long (ms) shows the pressed shape. Shorter touches that turn into a
 * scroll never morph, so scrolling a list doesn't flash every card under the finger.
 */
const PRESS_DELAY = 70;

/**
 * Press feedback as shape (docs/animation.md §5): corners tighten and the surface dips,
 * then springs back. Every completed tap plays the whole morph, even a quick one: the
 * shape reaches its pressed state, `onPress` fires at that moment (so the feedback is seen
 * before the next screen covers it), then it springs back. Scrolls cancel without firing.
 * Runs on the UI thread; only `onPress` hops to JS.
 */
export function usePressMorph({
  kind = 'card',
  corner,
  pressedCorner = kind === 'card' ? MotionSpec.cardPressCorner : corner,
  pressedScale = kind === 'card' ? MotionSpec.cardPressScale : 1,
  onPress,
  onPressIn,
  disabled,
}: Options) {
  const springs = useSprings();
  const progress = useSharedValue(0);
  const tapped = useSharedValue(false);
  const pressIn = kind === 'card' ? springs.fastSpatial : springs.fastEffects;
  const release = kind === 'card' ? springs.fastSpatial : springs.defaultEffects;

  const gesture = useTapGesture({
    enabled: !disabled,
    maxDuration: 100_000,
    maxDistance: TAP_SLOP,
    onBegin: () => {
      'worklet';
      tapped.set(false);
      progress.set(withDelay(PRESS_DELAY, withSpring(1, pressIn)));
      if (onPressIn) scheduleOnRN(onPressIn);
    },
    onActivate: () => {
      'worklet';
      tapped.set(true);
      progress.set(
        withSequence(
          withSpring(1, { ...pressIn, overshootClamping: true }, (finished) => {
            'worklet';
            if (finished && onPress) scheduleOnRN(onPress);
          }),
          withSpring(0, release),
        ),
      );
    },
    onFinalize: () => {
      'worklet';
      // A completed tap is already springing back via its sequence; anything else (scroll,
      // finger slid off, cancelled) springs back from wherever it got to.
      if (!tapped.get()) progress.set(withSpring(0, release));
    },
  });

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      borderRadius: corner + (pressedCorner - corner) * p,
      transform: [{ scale: 1 + (pressedScale - 1) * p }],
    };
  });

  return { gesture, style, progress };
}
