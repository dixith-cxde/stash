import type { Href } from 'expo-router';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

import { SelectOverlay, useSelectScale } from '@/features/select/SelectOverlay';
import { useSelectable } from '@/features/select/store';
import { useContainerSource } from '@/motion/transition/useContainerSource';
import type { Corners4 } from '@/motion/useSelection';

import { cornersStyle } from './List';
import { PressableSurface } from './PressableSurface';

type Props = {
  /** Destination route; it must render a <TransitionScreen kind="container">. */
  href: Href;
  color: string;
  corner?: number;
  /** Per-corner radii (TL, TR, BR, BL) for a card inside a segmented group; the frame clips to them. */
  corners?: Corners4;
  children: React.ReactNode;
  /** Outer box (size, flex). */
  style?: StyleProp<ViewStyle>;
  /** Inner surface (padding, layout). */
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  onLongPress?: () => void;
  /** Multi-select key; defaults to the enclosing `SelectKey`. Needs a `SelectionScope` above. */
  selectKey?: string;
};

/**
 * A pressable card that opens its page with a container transform: press morphs the corners
 * (28 → 14) and dips the card, then the card grows into the page and hides until the page
 * shrinks back into it. The card is measured on the UI thread inside the tap gesture, so
 * navigation starts in the same JS hop as the tap.
 *
 * Inside a selection scope, a long press selects the card and, while anything is selected,
 * a tap toggles it instead of opening it.
 */
export function TransformCard({ href, color, corner: cornerProp = 28, corners, children, style, contentStyle, accessibilityLabel, onLongPress, selectKey }: Props) {
  const corner = corners ? Math.max(...corners) : cornerProp;
  const frameRef = useAnimatedRef<Animated.View>();
  const { openAt, hidden } = useContainerSource({
    corner,
    color,
    ghost: <View style={[{ flex: 1, backgroundColor: color }, contentStyle]}>{children}</View>,
  });
  const select = useSelectable(selectKey);
  const selecting = !!select?.active;
  const sink = useSelectScale(selecting && !!select?.selected);
  return (
    <Animated.View ref={frameRef} style={[style, corners && { ...cornersStyle(corners), overflow: 'hidden' }, { opacity: hidden ? 0 : 1 }, sink]} collapsable={false}>
      <PressableSurface
        corner={corner}
        measureRef={frameRef}
        onPressMeasured={selecting ? undefined : (frame) => openAt(href, frame)}
        onPress={selecting ? select!.toggle : () => openAt(href, null)}
        onLongPress={select ? select.toggle : onLongPress}
        accessibilityRole={selecting ? 'checkbox' : 'link'}
        accessibilityState={selecting ? { checked: select!.selected } : undefined}
        accessibilityLabel={accessibilityLabel}
        style={[{ flexGrow: 1, backgroundColor: color }, contentStyle]}
      >
        {children}
      </PressableSurface>
      {selecting && <SelectOverlay selected={select!.selected} corner={corner} corners={corners} />}
    </Animated.View>
  );
}
