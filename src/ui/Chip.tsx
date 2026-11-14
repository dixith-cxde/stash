import { StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolateColor, LinearTransition, useAnimatedStyle } from 'react-native-reanimated';

import { fadeIn, fadeOut } from '@/motion/layout';
import { Spring } from '@/motion/tokens';
import { usePressMorph } from '@/motion/usePressMorph';
import { cornerStyle, useSelection } from '@/motion/useSelection';
import { useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';

import { Ico } from './Ico';
import { Text } from './Text';

const H = 36;
const fs = Spring.fastSpatial;
/** Width changes: expand on fastSpatial (androidx Chip). */
const resize = LinearTransition.springify().mass(fs.mass).stiffness(fs.stiffness).damping(fs.damping);
/** Leading check: fades in on slowEffects, out on fastEffects (androidx Chip). */
const checkIn = fadeIn(Spring.slowEffects);
const checkOut = fadeOut(Spring.fastEffects);

type Props = {
  label: string;
  onPress?: () => void;
  /** Filter chip state. Undefined = assist chip (outlined action, e.g. "+ Tag"). */
  selected?: boolean;
  /** Leading icon for assist chips. */
  icon?: IconName;
  accessibilityLabel?: string;
};

/**
 * M3 Expressive chip. Filter chips go from an outlined rounded square (10dp) to a filled
 * pill (18dp) with a ✓ that fades in, widening on fastSpatial; colors use defaultEffects.
 */
export function Chip({ label, onPress, selected, icon, accessibilityLabel }: Props) {
  const colors = useColors();
  const filter = selected !== undefined;
  const on = !!selected;
  const sel = useSelection(on);
  const { gesture, progress } = usePressMorph({
    kind: 'card',
    corner: 0,
    pressedScale: 0.96,
    onPress,
  });

  const offBorder = colors.outline;
  const onBg = colors.secondaryContainer;
  const offFg = colors.onSurfaceVariant;
  const onFg = colors.onSecondaryContainer;

  const box = useAnimatedStyle(() => {
    const r = 10 + (H / 2 - 10) * sel.shape.get();
    const c = sel.color.get();
    return {
      ...cornerStyle([r, r, r, r], 8, progress.get()),
      backgroundColor: interpolateColor(c, [0, 1], ['transparent', onBg]),
      borderColor: interpolateColor(c, [0, 1], [offBorder, onBg]),
      transform: [{ scale: 1 - 0.04 * progress.get() }],
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        layout={resize}
        accessible
        accessibilityRole={filter ? 'checkbox' : 'button'}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={filter ? { checked: on } : undefined}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && onPress?.()}
        style={[styles.chip, box]}
      >
        {on && (
          <Animated.View entering={checkIn} exiting={checkOut}>
            <Ico name="check" size={18} color={onFg} />
          </Animated.View>
        )}
        {!filter && icon && <Ico name={icon} size={18} color={colors.primary} />}
        <Text variant="labelMedium" color={on ? onFg : offFg}>
          {label}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

/** Static tag pill shown on items (design: #design on secondaryContainer, 12dp corners). */
export function TagPill({ label, small }: { label: string; small?: boolean }) {
  const colors = useColors();
  return (
    <Animated.View
      style={[
        styles.tag,
        { backgroundColor: colors.secondaryContainer, height: small ? 24 : 36, borderRadius: small ? 8 : 12, paddingHorizontal: small ? 10 : 12 },
      ]}
    >
      <Text variant={small ? 'labelSmall' : 'labelMedium'} color="onSecondaryContainer">
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: H,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tag: { paddingHorizontal: 10, justifyContent: 'center', alignSelf: 'flex-start' },
});
