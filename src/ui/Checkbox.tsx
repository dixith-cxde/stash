import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { useSelection } from '@/motion/useSelection';
import { useColors } from '@/theme/AppTheme';

import { Ico } from './Ico';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';

const BOX = 22;

/** The animated box alone (design: 22dp, 7dp corners → 11dp round when checked). */
export function CheckboxBox({ checked }: { checked: boolean }) {
  const colors = useColors();
  // androidx Checkbox: check on defaultSpatial, color on fast/default effects.
  const sel = useSelection(checked, { shape: 'defaultSpatial', color: 'fastEffects' });
  const on = colors.primary;
  const off = colors.onSurfaceVariant;

  const box = useAnimatedStyle(() => {
    const c = sel.color.get();
    return {
      borderRadius: 7 + 4 * sel.shape.get(),
      backgroundColor: interpolateColor(c, [0, 1], ['transparent', on]),
      borderColor: interpolateColor(c, [0, 1], [off, on]),
    };
  });
  const mark = useAnimatedStyle(() => ({
    opacity: sel.color.get(),
    transform: [{ scale: 0.4 + 0.6 * sel.shape.get() }],
  }));

  return (
    <Animated.View style={[styles.box, box]}>
      <Animated.View style={mark}>
        <Ico name="check" size={16} color={colors.onPrimary} />
      </Animated.View>
    </Animated.View>
  );
}

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

/** A checklist row (design: Note "Points to cover"): box morph + strikethrough label. */
export function CheckboxRow({ checked, onChange, label }: Props) {
  const colors = useColors();
  return (
    <PressableSurface
      kind="card"
      corner={16}
      pressedScale={0.98}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      style={[styles.row, { backgroundColor: colors.surfaceContainer }]}
    >
      <CheckboxBox checked={checked} />
      <View style={{ flex: 1 }}>
        <Text
          variant="bodyLarge"
          color={checked ? 'onSurfaceVariant' : 'onSurface'}
          style={checked ? { textDecorationLine: 'line-through' } : undefined}
        >
          {label}
        </Text>
      </View>
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  box: { width: BOX, height: BOX, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
});
