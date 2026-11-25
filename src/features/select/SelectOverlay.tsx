import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { enterFade } from '@/motion/layout';
import { type Corners4, useSelection } from '@/motion/useSelection';
import { useColors } from '@/theme/AppTheme';
import { withAlpha } from '@/theme/palette';
import { Ico } from '@/ui/Ico';
import { cornersStyle } from '@/ui/List';

const BADGE = 26;

/**
 * Drawn over a card while selecting: a round check badge in the top-right corner (outlined
 * when not chosen, filled primary with a check when chosen) and, on chosen cards, a primary
 * outline plus a light primary wash. Shape on fastSpatial, color on defaultEffects. Mount it
 * only while selecting, so cards carry no extra animated values the rest of the time.
 */
export function SelectOverlay({ selected, corner, corners }: { selected: boolean; corner: number; corners?: Corners4 }) {
  const colors = useColors();
  const sel = useSelection(selected);
  const ring = useAnimatedStyle(() => ({ opacity: sel.color.get() }));
  const fill = useAnimatedStyle(() => ({
    opacity: sel.color.get(),
    transform: [{ scale: 0.4 + 0.6 * sel.shape.get() }],
  }));
  const radius = corners ? cornersStyle(corners) : { borderRadius: corner };
  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill} entering={enterFade}>
      <Animated.View
        style={[StyleSheet.absoluteFill, radius, { borderWidth: 3, borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, 0.12) }, ring]}
      />
      <View style={[styles.badge, { borderColor: colors.onSurface, backgroundColor: withAlpha(colors.surface, 0.7) }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, fill]}>
          <Ico name="check" size={18} color={colors.onPrimary} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** Selected cards sink a little (0.94) on a spatial spring, so choosing one feels physical. */
export function useSelectScale(selected: boolean) {
  const sel = useSelection(selected);
  return useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.06 * sel.shape.get() }] }));
}
