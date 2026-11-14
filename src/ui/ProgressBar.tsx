import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { springTo, useSprings } from '@/motion/springs';
import { useColors } from '@/theme/AppTheme';

type Props = {
  /** 0..1 */
  value: number;
  /** Track thickness (design: 4 on cards, 6 on the note checklist). */
  height?: number;
  color?: string;
  trackColor?: string;
  accessibilityLabel?: string;
};

/** Linear progress whose fill springs to each new value (defaultSpatial). */
export function ProgressBar({ value, height = 4, color, trackColor, accessibilityLabel }: Props) {
  const colors = useColors();
  const springs = useSprings();
  const clamped = Math.min(1, Math.max(0, value));
  const p = useSharedValue(clamped);

  useEffect(() => {
    p.set(springTo(clamped, springs.defaultSpatial));
  }, [clamped, springs, p]);

  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, p.get())) * 100}%` }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: trackColor ?? colors.surfaceContainerHighest, overflow: 'hidden' }}
    >
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color ?? colors.primary }, fill]} />
    </View>
  );
}
