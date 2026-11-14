import type { StyleProp, ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { type Corners4, cornerStyle, uniform } from '@/motion/useSelection';
import { MotionSpec } from '@/motion/tokens';
import { usePressMorph } from '@/motion/usePressMorph';
import { useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import type { ColorRole } from '@/theme/palette';
import { ButtonSize } from '@/theme/tokens';

import { Ico } from './Ico';
import { Text } from './Text';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';
type Size = 'xs' | 's' | 'm';

const VARIANT: Record<ButtonVariant, { bg: ColorRole | null; fg: ColorRole; border?: ColorRole }> = {
  filled: { bg: 'primary', fg: 'onPrimary' },
  tonal: { bg: 'secondaryContainer', fg: 'onSecondaryContainer' },
  outlined: { bg: null, fg: 'onSurface', border: 'outline' },
  text: { bg: null, fg: 'primary' },
};

const PADDING: Record<Size, number> = { xs: 12, s: 16, m: 24 };

type Props = {
  label?: string;
  icon?: IconName;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: Size;
  /** Height override (the design uses 44/48/52/56 for different rows). */
  height?: number;
  /** 'round' (pill) or 'square' (size's square corner). Ignored when `corners` is set. */
  shape?: 'round' | 'square';
  /** Explicit rest corners, e.g. from connectedCorners() for a connected row. */
  corners?: Corners4;
  /** Override container/content colors (role names or literal colors). */
  colors?: { bg?: string; fg?: string };
  disabled?: boolean;
  /** Stretch to fill a row (flex: 1). */
  grow?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * M3 Expressive button. Pressing tightens the corners (round → the size's pressed corner)
 * on defaultEffects, with no bounce, as androidx Button does.
 */
export function Button({
  label,
  icon,
  onPress,
  variant = 'filled',
  size = 'm',
  height,
  shape = 'round',
  corners,
  colors: override,
  disabled,
  grow,
  accessibilityLabel,
  style,
}: Props) {
  const colors = useColors();
  const spec = ButtonSize[size];
  const h = height ?? spec.height;
  const rest = corners ?? uniform(shape === 'round' ? h / 2 : spec.square);
  const { gesture, progress } = usePressMorph({ kind: 'button', corner: 0, onPress, disabled });

  const v = VARIANT[variant];
  const resolve = (c: string | undefined, role: ColorRole | null) =>
    c ? ((colors as Record<string, string>)[c] ?? c) : role ? colors[role] : 'transparent';
  const bg = resolve(override?.bg, v.bg);
  const fg = resolve(override?.fg, v.fg);

  const morph = useAnimatedStyle(() => {
    const p = progress.get();
    return { ...cornerStyle(rest, spec.pressed, p), transform: [{ scale: 1 + (MotionSpec.buttonPressScale - 1) * p }] };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && onPress?.()}
        style={[
          {
            height: h,
            minWidth: h,
            paddingHorizontal: label ? PADDING[size] : 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: bg,
            borderWidth: v.border ? 1 : 0,
            borderColor: v.border ? colors[v.border] : undefined,
            opacity: disabled ? 0.38 : 1,
          },
          grow && { flexGrow: 1, flexBasis: 0 },
          style,
          morph,
        ]}
      >
        {icon && <Ico name={icon} size={spec.icon} color={fg} />}
        {label ? (
          <Text variant="labelLarge" color={fg} style={[{ flexShrink: 1 }, size === 'm' && { fontSize: 16 }]} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}
