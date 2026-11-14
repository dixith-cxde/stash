import { useTapGesture } from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { springTo, useSprings } from './springs';
import { MotionSpec } from './tokens';

export type PressMorphKind =
  /** Buttons and icon buttons: no bounce (androidx Button uses DefaultEffects). */
  | 'button'
  /** Cards, tiles, selectable items: bouncy fastSpatial in, gentler defaultSpatial out. */
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

/**
 * Press feedback as shape: corners tighten and the surface dips while the finger is down,
 * then springs back. Runs entirely on the UI thread; only `onPress` hops to JS.
 * See docs/animation.md §5.
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
  const pressIn = kind === 'card' ? springs.fastSpatial : springs.defaultEffects;
  const release = kind === 'card' ? springs.defaultSpatial : springs.defaultEffects;

  const gesture = useTapGesture({
    enabled: !disabled,
    maxDuration: 100_000,
    onBegin: () => {
      'worklet';
      progress.value = springTo(1, pressIn);
      if (onPressIn) scheduleOnRN(onPressIn);
    },
    onActivate: () => {
      'worklet';
      if (onPress) scheduleOnRN(onPress);
    },
    onFinalize: () => {
      'worklet';
      progress.value = springTo(0, release);
    },
  });

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      borderRadius: corner + (pressedCorner - corner) * p,
      transform: [{ scale: 1 + (pressedScale - 1) * p }],
    };
  });

  return { gesture, style, progress };
}
