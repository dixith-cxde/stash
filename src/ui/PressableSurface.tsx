import { createContext, useContext } from 'react';
import type { AccessibilityRole, StyleProp, ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { type AnimatedRef, type MeasuredDimensions } from 'react-native-reanimated';

import { type PressBlock, type PressMorphKind, usePressMorph } from '@/motion/usePressMorph';

/** The nearest enclosing surface's gesture, for nested surfaces that set `blockParent`. */
const ParentPress = createContext<PressBlock | null>(null);

type Props = {
  children?: React.ReactNode;
  onPress?: () => void;
  onPressIn?: () => void;
  /** See usePressMorph: measure `measureRef` on the UI thread and pass the frame. */
  onPressMeasured?: (frame: MeasuredDimensions | null) => void;
  measureRef?: AnimatedRef<Animated.View>;
  onLongPress?: () => void;
  kind?: PressMorphKind;
  /** Corner radius at rest (the style's borderRadius is ignored; this drives the morph). */
  corner: number;
  pressedCorner?: number;
  pressedScale?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
  /** Nested inside another surface (a button on a card): a press here never presses the parent. */
  blockParent?: boolean;
};

/** A surface that morphs its shape when pressed. The base of every card, tile and button. */
export function PressableSurface({
  children,
  onPress,
  onPressIn,
  onPressMeasured,
  measureRef,
  onLongPress,
  kind,
  corner,
  pressedCorner,
  pressedScale,
  disabled,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  blockParent,
}: Props) {
  const parent = useContext(ParentPress);
  const { gesture, style: morph } = usePressMorph({
    kind,
    corner,
    pressedCorner,
    pressedScale,
    onPress,
    onPressIn,
    onPressMeasured,
    measureRef,
    onLongPress,
    disabled,
    block: blockParent ? (parent ?? undefined) : undefined,
  });
  return (
    <ParentPress.Provider value={gesture}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[{ overflow: 'hidden' }, style, morph]}
          accessible
          accessibilityRole={accessibilityRole}
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled, ...accessibilityState }}
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && onPress?.()}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </ParentPress.Provider>
  );
}
