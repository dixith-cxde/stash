import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { MotionSpec } from '@/motion/tokens';
import { usePressMorph } from '@/motion/usePressMorph';
import { cornerStyle, useSelection } from '@/motion/useSelection';
import { useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';

import { Button } from './Button';
import { Ico } from './Ico';

type Props = {
  label: string;
  icon?: IconName;
  onPress: () => void;
  /** Trailing menu button. */
  onMenu: () => void;
  menuOpen?: boolean;
  menuLabel: string;
  height?: number;
};

const INNER = 8;

/**
 * M3 Expressive split button (design: "Save link | ⌄"). Two connected filled buttons with a
 * 2dp gap; the trailing one rounds its inner corners and turns its chevron 180° while its
 * menu is open (fastSpatial).
 */
export function SplitButton({ label, icon, onPress, onMenu, menuOpen = false, menuLabel, height = 56 }: Props) {
  const colors = useColors();
  const outer = height / 2;
  const open = useSelection(menuOpen);
  const { gesture, progress } = usePressMorph({ kind: 'button', corner: 0, onPress: onMenu });

  const trailing = useAnimatedStyle(() => {
    const inner = INNER + (outer - INNER) * open.shape.get();
    const p = progress.get();
    return { ...cornerStyle([inner, outer, outer, inner], 12, p), transform: [{ scale: 1 + (MotionSpec.buttonPressScale - 1) * p }] };
  });
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${open.shape.get() * 180}deg` }] }));

  return (
    <View style={styles.row}>
      <Button label={label} icon={icon} onPress={onPress} height={height} corners={[outer, INNER, INNER, outer]} grow />
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel={menuLabel}
          accessibilityState={{ expanded: menuOpen }}
          style={[styles.trailing, { width: height, height, backgroundColor: colors.primary }, trailing]}
        >
          <Animated.View style={chevron}>
            <Ico name="expandMore" size={24} color={colors.onPrimary} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
  trailing: { alignItems: 'center', justifyContent: 'center' },
});
