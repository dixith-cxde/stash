import { StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { usePressMorph } from '@/motion/usePressMorph';
import { useSelection } from '@/motion/useSelection';
import { useColors } from '@/theme/AppTheme';

import { Ico } from './Ico';

const TRACK_W = 52;
const TRACK_H = 32;
const BORDER = 2;
/** Thumb diameters (androidx Switch): unchecked, checked, pressed. */
const THUMB_OFF = 16;
const THUMB_ON = 24;
const THUMB_PRESSED = 28;
/** Thumb centre travels between these x positions (track coordinates). */
const X_OFF = TRACK_H / 2;
const X_ON = TRACK_W - TRACK_H / 2;

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel?: string;
  /**
   * The parent row handles the press and announces the state (a whole-row toggle):
   * the switch is drawn but not separately focusable.
   */
  decorative?: boolean;
  disabled?: boolean;
};

/**
 * M3 Expressive switch. The thumb grows 16 → 24 and slides on fastSpatial when checked
 * (bouncy), swells to 28 while held, and shows a check; track and thumb colors change on
 * defaultEffects (no overshoot).
 */
export function Switch({ value, onValueChange, accessibilityLabel, decorative, disabled }: Props) {
  const colors = useColors();
  const sel = useSelection(value, { shape: 'fastSpatial', color: 'defaultEffects' });
  const { gesture, progress } = usePressMorph({
    kind: 'card',
    corner: TRACK_H / 2,
    pressedScale: 1,
    onPress: () => onValueChange(!value),
    disabled,
  });

  const trackOff = colors.surfaceContainerHighest;
  const trackOn = colors.primary;
  const borderOff = colors.outline;
  const thumbOff = colors.outline;
  const thumbOn = colors.onPrimary;

  const track = useAnimatedStyle(() => {
    const c = sel.color.get();
    return {
      backgroundColor: interpolateColor(c, [0, 1], [trackOff, trackOn]),
      borderColor: interpolateColor(c, [0, 1], [borderOff, trackOn]),
    };
  });

  const thumb = useAnimatedStyle(() => {
    const s = sel.shape.get();
    const rest = THUMB_OFF + (THUMB_ON - THUMB_OFF) * s;
    const size = rest + (THUMB_PRESSED - rest) * progress.get();
    const cx = X_OFF + (X_ON - X_OFF) * s;
    // Absolute children sit inside the border.
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      left: cx - size / 2 - BORDER,
      top: TRACK_H / 2 - size / 2 - BORDER,
      backgroundColor: interpolateColor(sel.color.get(), [0, 1], [thumbOff, thumbOn]),
    };
  });

  const check = useAnimatedStyle(() => ({
    opacity: sel.color.get(),
    transform: [{ scale: 0.4 + 0.6 * sel.shape.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible={!decorative}
        importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: value, disabled }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && onValueChange(!value)}
        style={[styles.track, disabled && styles.disabled, track]}
      >
        <Animated.View style={[styles.thumb, thumb]}>
          <Animated.View style={check}>
            <Ico name="check" size={16} color={colors.onPrimaryContainer} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  track: { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, borderWidth: BORDER },
  thumb: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  disabled: { opacity: 0.38 },
});
