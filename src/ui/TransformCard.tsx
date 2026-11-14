import type { Href } from 'expo-router';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

import { useContainerSource } from '@/motion/transition/useContainerSource';

import { PressableSurface } from './PressableSurface';

type Props = {
  /** Destination route; it must render a <TransitionScreen kind="container">. */
  href: Href;
  color: string;
  corner?: number;
  children: React.ReactNode;
  /** Outer box (size, flex). */
  style?: StyleProp<ViewStyle>;
  /** Inner surface (padding, layout). */
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  onLongPress?: () => void;
};

/**
 * A pressable card that opens its page with a container transform: press morphs the corners
 * (28 → 14) and dips the card, then the card grows into the page and hides until the page
 * shrinks back into it.
 */
export function TransformCard({ href, color, corner = 28, children, style, contentStyle, accessibilityLabel }: Props) {
  const { ref, open, hidden } = useContainerSource({
    corner,
    color,
    ghost: <View style={[{ flex: 1, backgroundColor: color }, contentStyle]}>{children}</View>,
  });
  return (
    <View ref={ref} style={[style, { opacity: hidden ? 0 : 1 }]} collapsable={false}>
      <PressableSurface
        corner={corner}
        onPress={() => open(href)}
        accessibilityRole="link"
        accessibilityLabel={accessibilityLabel}
        style={[{ flexGrow: 1, backgroundColor: color }, contentStyle]}
      >
        {children}
      </PressableSurface>
    </View>
  );
}
