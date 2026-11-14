import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { MotionSpec } from '@/motion/tokens';
import { usePressMorph } from '@/motion/usePressMorph';
import { type Corners4, cornerStyle, useSelection } from '@/motion/useSelection';
import { useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import type { ColorRole } from '@/theme/palette';

import { Ico } from './Ico';

type Variant = 'standard' | 'filled' | 'tonal' | 'outlined';

const VARIANT: Record<Variant, { bg: ColorRole | null; fg: ColorRole }> = {
  standard: { bg: null, fg: 'onSurfaceVariant' },
  filled: { bg: 'primary', fg: 'onPrimary' },
  tonal: { bg: 'secondaryContainer', fg: 'onSecondaryContainer' },
  outlined: { bg: null, fg: 'onSurfaceVariant' },
};

type Props = {
  icon: IconName;
  /** Icon when selected (e.g. the filled variant). */
  selectedIcon?: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: Variant;
  /** Square size in dp (design: 40, 48, 56, 64). */
  size?: number;
  /** Toggle state. When defined, the button morphs square → round as it turns on. */
  selected?: boolean;
  /** Colors when selected (defaults to tertiary, like the design's favorite). */
  selectedColors?: { bg: ColorRole; fg: ColorRole };
  /** Rest corners when not a toggle (defaults to fully round). */
  corners?: Corners4;
  /** Square-variant corner used by toggles when off. */
  squareCorner?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * M3 Expressive icon button. As a toggle (`selected` set) its shape morphs from rounded
 * square to circle on fastSpatial while its colors change on defaultEffects. Presses tighten
 * the corners on defaultEffects.
 */
export function IconButton({
  icon,
  selectedIcon,
  accessibilityLabel,
  onPress,
  variant = 'standard',
  size = 48,
  selected,
  selectedColors = { bg: 'tertiary', fg: 'onTertiary' },
  corners,
  squareCorner = size >= 56 ? 16 : 12,
  style,
}: Props) {
  const colors = useColors();
  const toggle = selected !== undefined;
  const on = !!selected;
  const sel = useSelection(on);
  const { gesture, progress } = usePressMorph({
    kind: 'button',
    corner: 0,
    onPress,
  });

  const v = VARIANT[variant];
  const offBg = v.bg ? colors[v.bg] : 'transparent';
  const offFg = colors[v.fg];
  const onBg = colors[selectedColors.bg];
  const onFg = colors[selectedColors.fg];
  const round = size / 2;
  const pressedCap = size >= 56 ? 12 : 8;

  const container = useAnimatedStyle(() => {
    const r = toggle ? squareCorner + (round - squareCorner) * sel.shape.get() : 0;
    const rest: Corners4 = toggle ? [r, r, r, r] : (corners ?? [round, round, round, round]);
    return {
      ...cornerStyle(rest, pressedCap, progress.get()),
      transform: [{ scale: 1 + (MotionSpec.buttonPressScale - 1) * progress.get() }],
      backgroundColor: toggle ? interpolateColor(sel.color.get(), [0, 1], [offBg, onBg]) : offBg,
    };
  });
  const offLayer = useAnimatedStyle(() => ({ opacity: toggle ? 1 - sel.color.get() : 1 }));
  const onLayer = useAnimatedStyle(() => ({ opacity: toggle ? sel.color.get() : 0 }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole={toggle ? 'togglebutton' : 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={toggle ? { checked: on } : undefined}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && onPress?.()}
        style={[
          {
            width: size,
            height: size,
            borderWidth: variant === 'outlined' ? 1 : 0,
            borderColor: colors.outlineVariant,
          },
          style,
          container,
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, offLayer]}>
          <Ico name={icon} size={size >= 56 ? 24 : 22} color={offFg} />
        </Animated.View>
        {toggle && (
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, onLayer]}>
            <Ico name={selectedIcon ?? icon} size={size >= 56 ? 24 : 22} color={onFg} />
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
