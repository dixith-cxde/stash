import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { haptic } from '@/motion/haptics';
import { useGlide } from '@/motion/useGlide';
import { useSelection } from '@/motion/useSelection';
import { useColors } from '@/theme/AppTheme';
import { FONT_FAMILY, Type } from '@/theme/type';

import { PressableSurface } from './PressableSurface';

type Props<K extends string> = {
  items: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
  /** Track color behind the tabs (design: the darkest surface on a sheet). */
  track?: string;
};

const PAD = 4;
const H = 40;

/**
 * Pill tabs with a gliding indicator (design: Capture Link/Note/File, Editor Write/Preview).
 * The indicator stretches between tabs (useGlide); labels cross-fade color on defaultEffects.
 */
export function SegmentedTabs<K extends string>({ items, value, onChange, accessibilityLabel, track }: Props<K>) {
  const colors = useColors();
  const [slot, setSlot] = useState(0);
  const index = Math.max(0, items.findIndex((i) => i.key === value));
  const indicator = useGlide({ index, slot, start: PAD, minWidth: H });

  const onLayout = (e: LayoutChangeEvent) => setSlot((e.nativeEvent.layout.width - PAD * 2) / items.length);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={[styles.track, { backgroundColor: track ?? colors.surface }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.indicator, { backgroundColor: colors.secondaryContainer }, indicator]}
      />
      {items.map((item, i) => (
        <Tab
          key={item.key}
          label={item.label}
          selected={i === index}
          onPress={() => {
            if (i === index) return;
            haptic.select();
            onChange(item.key);
          }}
        />
      ))}
    </View>
  );
}

function Tab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  const sel = useSelection(selected);
  const off = colors.onSurfaceVariant;
  const on = colors.onSecondaryContainer;
  const text = useAnimatedStyle(() => ({ color: interpolateColor(sel.color.get(), [0, 1], [off, on]) }));
  return (
    <PressableSurface
      kind="button"
      corner={H / 2}
      pressedScale={0.96}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={styles.tab}
    >
      <Animated.Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[{ fontFamily: FONT_FAMILY }, Type.labelMedium, { fontWeight: '700' }, text]}>{label}</Animated.Text>
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: PAD, borderRadius: H / 2 + PAD },
  indicator: { position: 'absolute', left: 0, top: PAD, height: H, borderRadius: H / 2 },
  tab: { flex: 1, height: H, alignItems: 'center', justifyContent: 'center' },
});
