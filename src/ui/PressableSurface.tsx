import type { AccessibilityRole, StyleProp, ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { type AnimatedRef, type MeasuredDimensions } from 'react-native-reanimated';

import { type PressMorphKind, usePressMorph } from '@/motion/usePressMorph';

type Props = {
  children?: React.ReactNode;
  onPress?: () => void;
  onPressIn?: () => void;
  /** See usePressMorph: measure `measureRef` on the UI thread and pass the frame. */
  onPressMeasured?: (frame: MeasuredDimensions | null) => void;
  measureRef?: AnimatedRef<Animated.View>;
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
};

/** A surface that morphs its shape when pressed. The base of every card, tile and button. */
export function PressableSurface({
  children,
  onPress,
  onPressIn,
  onPressMeasured,
  measureRef,
  kind,
  corner,
  pressedCorner,
  pressedScale,
  disabled,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: Props) {
  const { gesture, style: morph } = usePressMorph({
    kind,
    corner,
    pressedCorner,
    pressedScale,
    onPress,
    onPressIn,
    onPressMeasured,
    measureRef,
    disabled,
  });
  return (
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
  );
}
