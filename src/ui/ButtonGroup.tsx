import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolateColor, type SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { MotionSpec } from '@/motion/tokens';
import { usePressMorph } from '@/motion/usePressMorph';
import { useSharedSelection } from '@/motion/useSelection';
import { useColors } from '@/theme/AppTheme';
import type { ColorRole } from '@/theme/palette';
import { FONT_FAMILY, Type } from '@/theme/type';

export type GroupItem<K extends string> = { key: K; label: string };

type Props<K extends string> = {
  items: GroupItem<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
  /** Segment height (design: 40 for filters, 44 for the capture collection picker). */
  height?: number;
  /** Selected colors (design: primary for filters, primaryContainer for collections). */
  selectedColors?: { bg: ColorRole; fg: ColorRole };
};

const INNER = 8;
const INNER_PRESSED = 4;
/** Selected segment grows from flex 1 to 1.4 (design). */
const SELECTED_GROW = 0.4;

/**
 * M3 Expressive connected button group used as a single-select filter. The selected
 * segment widens and rounds its inner corners (fastSpatial) while its fill changes
 * (defaultEffects); a pressed segment grows 15% and squeezes its neighbours (androidx
 * ButtonGroup ExpandedRatio). Every change is an interruptible spring.
 */
export function ButtonGroup<K extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
  height = 40,
  selectedColors = { bg: 'primary', fg: 'onPrimary' },
}: Props<K>) {
  // The chosen index lives on the UI thread: a tap moves the selection in its own frame,
  // and React catches up afterwards (the list below may take a while on older phones).
  const index = items.findIndex((i) => i.key === value);
  const active = useSharedValue(index);
  useEffect(() => {
    active.set(index);
  }, [index, active]);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.row}>
      {items.map((item, i) => (
        <Segment
          key={item.key}
          label={item.label}
          index={i}
          active={active}
          selected={item.key === value}
          first={i === 0}
          last={i === items.length - 1}
          height={height}
          selectedColors={selectedColors}
          onPress={() => {
            if (item.key !== value) onChange(item.key);
          }}
        />
      ))}
    </View>
  );
}

function Segment({
  label,
  index,
  active,
  selected,
  first,
  last,
  height,
  selectedColors,
  onPress,
}: {
  label: string;
  index: number;
  active: SharedValue<number>;
  selected: boolean;
  first: boolean;
  last: boolean;
  height: number;
  selectedColors: { bg: ColorRole; fg: ColorRole };
  onPress: () => void;
}) {
  const colors = useColors();
  const sel = useSharedSelection(active, index, selected);
  const { gesture, progress } = usePressMorph({
    kind: 'card',
    corner: 0,
    pressedScale: 1,
    onPressWorklet: () => {
      'worklet';
      active.set(index);
    },
    onPress,
  });
  const outer = height / 2;
  const offBg = colors.surfaceContainerHigh;
  const onBg = colors[selectedColors.bg];
  const offFg = colors.onSurfaceVariant;
  const onFg = colors[selectedColors.fg];

  const box = useAnimatedStyle(() => {
    const s = sel.shape.get();
    // Inner corners: 8 at rest, 4 while pressed, full when selected (androidx ConnectedButtonGroup).
    const inner = INNER - (INNER - INNER_PRESSED) * progress.get() * (1 - s) + (outer - INNER) * s;
    const l = first ? outer : inner;
    const r = last ? outer : inner;
    return {
      flexGrow: (1 + SELECTED_GROW * s) * (1 + MotionSpec.buttonGroupExpandedRatio * progress.get()),
      borderTopLeftRadius: l,
      borderBottomLeftRadius: l,
      borderTopRightRadius: r,
      borderBottomRightRadius: r,
      backgroundColor: interpolateColor(sel.color.get(), [0, 1], [offBg, onBg]),
    };
  });
  const text = useAnimatedStyle(() => ({ color: interpolateColor(sel.color.get(), [0, 1], [offFg, onFg]) }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && onPress()}
        style={[styles.segment, { height }, box]}
      >
        <Animated.Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
          style={[{ fontFamily: FONT_FAMILY }, Type.labelLarge, selected && { fontWeight: '700' }, text]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
  // Content-sized first (labels never truncate), then the spare width is shared by flexGrow.
  segment: {
    flexBasis: 'auto',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
