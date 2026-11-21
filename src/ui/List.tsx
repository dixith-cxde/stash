import { Children, cloneElement, isValidElement } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { usePressMorph } from '@/motion/usePressMorph';
import { type Corners4, useSelection } from '@/motion/useSelection';
import { useColors } from '@/theme/AppTheme';
import type { ColorRole } from '@/theme/palette';
import { Corner } from '@/theme/tokens';

import { Text } from './Text';

/** Where an item sits in its segmented group. */
export type ListPosition = 'single' | 'first' | 'middle' | 'last';

/** M3 Expressive segmented list (androidx ListItem segmented): 16 outer, 4 inner, 2dp gaps. */
export const LIST_OUTER = Corner.large;
export const LIST_INNER = Corner.extraSmall;
export const LIST_GAP = 2;

export function listPosition(index: number, count: number): ListPosition {
  if (count <= 1) return 'single';
  return index === 0 ? 'first' : index === count - 1 ? 'last' : 'middle';
}

/** Corners (TL, TR, BR, BL) for a position in a segmented group. */
export function listCorners(position: ListPosition, outer: number = LIST_OUTER, inner: number = LIST_INNER): Corners4 {
  const top = position === 'single' || position === 'first' ? outer : inner;
  const bottom = position === 'single' || position === 'last' ? outer : inner;
  return [top, top, bottom, bottom];
}

/** Per-corner style object from Corners4. */
export function cornersStyle(c: Corners4): ViewStyle {
  return { borderTopLeftRadius: c[0], borderTopRightRadius: c[1], borderBottomRightRadius: c[2], borderBottomLeftRadius: c[3] };
}

/**
 * A segmented list group: its children are separate filled items with 2dp gaps; each gets
 * its `position` so the group reads as one rounded container (expressive containment).
 */
export function ListGroup({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = Children.toArray(children).filter(isValidElement) as React.ReactElement<{ position?: ListPosition }>[];
  return (
    <View accessibilityRole="list" style={[{ gap: LIST_GAP }, style]}>
      {items.map((child, i) => cloneElement(child, { position: listPosition(i, items.length) }))}
    </View>
  );
}

type ItemProps = {
  title: string;
  supporting?: string;
  /** Leading slot: icon, avatar, thumbnail or selection control. */
  leading?: React.ReactNode;
  /** Trailing slot: text, icon, icon button or control. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Selected items morph to 16dp on every corner and fill with primaryContainer. */
  selected?: boolean;
  /** Item fill (surfaceContainer on a surface background; a step higher inside sheets). */
  container?: ColorRole;
  titleColor?: ColorRole;
  /** Set by ListGroup. */
  position?: ListPosition;
  minHeight?: number;
  numberOfLines?: number;
  accessibilityLabel?: string;
};

/**
 * One expressive list item. Press tightens the corners (fastSpatial via the card press
 * morph); selection rounds every corner to 16 (fastSpatial) and changes the fill (effects).
 */
export function ListItem({
  title,
  supporting,
  leading,
  trailing,
  onPress,
  onLongPress,
  selected,
  container = 'surfaceContainer',
  titleColor = 'onSurface',
  position = 'single',
  minHeight = 56,
  numberOfLines = 1,
  accessibilityLabel,
}: ItemProps) {
  const colors = useColors();
  const sel = useSelection(!!selected);
  const { gesture, progress } = usePressMorph({ kind: 'card', corner: 0, pressedScale: 0.99, onPress, onLongPress, disabled: !onPress && !onLongPress });
  const rest = listCorners(position);
  const offBg = colors[container];
  const onBg = colors.primaryContainer;

  const box = useAnimatedStyle(() => {
    const s = sel.shape.get();
    const p = progress.get();
    // Rest corner → 16 when selected, then pulled toward 8 while pressed.
    const at = (r: number) => {
      const base = r + (LIST_OUTER - r) * s;
      return base + (Math.min(base, 8) - base) * p;
    };
    return {
      borderTopLeftRadius: at(rest[0]),
      borderTopRightRadius: at(rest[1]),
      borderBottomRightRadius: at(rest[2]),
      borderBottomLeftRadius: at(rest[3]),
      backgroundColor: interpolateColor(sel.color.get(), [0, 1], [offBg, onBg]),
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel ?? (supporting ? `${title}, ${supporting}` : title)}
        accessibilityState={selected !== undefined ? { selected } : undefined}
        style={[styles.item, { minHeight }, box]}
      >
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <View style={styles.content}>
          <Text variant="bodyLargeEmphasized" color={selected ? 'onPrimaryContainer' : titleColor} numberOfLines={numberOfLines}>
            {title}
          </Text>
          {supporting ? (
            <Text variant="bodyMedium" color={selected ? 'onPrimaryContainer' : 'onSurfaceVariant'} numberOfLines={2}>
              {supporting}
            </Text>
          ) : null}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </Animated.View>
    </GestureDetector>
  );
}

/** A colored icon tile for the leading slot (40dp, 12dp corners). */
export function ListIconTile({ children, bg }: { children: React.ReactNode; bg: string }) {
  return <View style={[styles.tile, { backgroundColor: bg }]}>{children}</View>;
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 16,
    overflow: 'hidden',
  },
  leading: { alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, minWidth: 0, gap: 2 },
  trailing: { alignItems: 'center', justifyContent: 'center' },
  tile: { width: 40, height: 40, borderRadius: Corner.medium, alignItems: 'center', justifyContent: 'center' },
});
