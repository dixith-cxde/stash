import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { springTo, useSprings } from '@/motion/springs';
import { useChromeHidden } from '@/motion/ScrollChrome';
import { useGlide } from '@/motion/useGlide';
import { useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { Layout } from '@/theme/tokens';

import { Ico } from './Ico';
import { PressableSurface } from './PressableSurface';

export type NavItem = { key: string; label: string; icon: IconName; selectedIcon: IconName };

type Props = {
  items: NavItem[];
  selectedKey: string;
  onSelect: (key: string) => void;
  onFab: () => void;
  fabLabel: string;
};

const BAR_PADDING = 8;
const INDICATOR_HEIGHT = 48;
/** Gap between the indicator and its slot edges. */
const INDICATOR_INSET = 2;

/**
 * M3 Expressive floating nav bar with the add FAB beside it (design: 64dp pill, 16dp from the
 * screen edges). Icon-only: each screen shows its own large title.
 * The selection indicator glides between slots (useGlide).
 */
export function FloatingNavBar({ items, selectedKey, onSelect, onFab, fabLabel }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [slot, setSlot] = useState(0);
  const index = Math.max(0, items.findIndex((i) => i.key === selectedKey));
  const indicator = useGlide({ index, slot, start: BAR_PADDING, inset: INDICATOR_INSET, minWidth: INDICATOR_HEIGHT });
  const hidden = useChromeHidden();
  const away = Layout.navBarHeight + Layout.navBarBottom + insets.bottom + 16;
  const barMotion = useAnimatedStyle(() => {
    const h = hidden ? hidden.get() : 0;
    return { opacity: 1 - h * 0.6, transform: [{ translateY: h * away }] };
  });

  const onBarLayout = (e: LayoutChangeEvent) =>
    setSlot((e.nativeEvent.layout.width - BAR_PADDING * 2) / Math.max(1, items.length));

  return (
    <View pointerEvents="box-none" style={[styles.row, { bottom: insets.bottom + Layout.navBarBottom }]}>
      <Animated.View
        accessibilityRole="tablist"
        onLayout={onBarLayout}
        style={[styles.bar, { backgroundColor: colors.surfaceContainerHigh }, barMotion]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { backgroundColor: colors.primaryContainer }, indicator]}
        />
        {items.map((item, i) => (
          <NavSlot
            key={item.key}
            item={item}
            selected={i === index}
            onPress={() => {
              if (i !== index) onSelect(item.key);
            }}
          />
        ))}
      </Animated.View>
      <PressableSurface
        corner={20}
        onPress={onFab}
        accessibilityLabel={fabLabel}
        style={[styles.fab, { backgroundColor: colors.primary }]}
      >
        <Ico name="add" size={28} color={colors.onPrimary} />
      </PressableSurface>
    </View>
  );
}

function NavSlot({ item, selected, onPress }: { item: NavItem; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  const springs = useSprings();
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    on.value = springTo(selected ? 1 : 0, springs.defaultEffects);
  }, [selected, on, springs]);

  return (
    <PressableSurface
      kind="button"
      corner={INDICATOR_HEIGHT / 2}
      pressedScale={0.92}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected }}
      style={styles.slot}
    >
      <IconLayer progress={on} visibleAt={0}>
        <Ico name={item.icon} size={24} color={colors.onSurfaceVariant} />
      </IconLayer>
      <IconLayer progress={on} visibleAt={1}>
        <Ico name={item.selectedIcon} size={24} color={colors.onPrimaryContainer} />
      </IconLayer>
    </PressableSurface>
  );
}

/** One of two stacked icons; cross-fades with the selection (effects spring, no overshoot). */
function IconLayer({
  progress,
  visibleAt,
  children,
}: {
  progress: SharedValue<number>;
  visibleAt: 0 | 1;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: visibleAt ? progress.value : 1 - progress.value,
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, styles.center, style]}>{children}</Animated.View>;
}

const SHADOW = '0px 6px 20px rgba(0, 0, 0, 0.45)';

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: Layout.gutter,
    right: Layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bar: {
    flex: 1,
    height: Layout.navBarHeight,
    borderRadius: Layout.navBarHeight / 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BAR_PADDING,
    boxShadow: SHADOW,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: (Layout.navBarHeight - INDICATOR_HEIGHT) / 2,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_HEIGHT / 2,
  },
  slot: {
    flex: 1,
    height: INDICATOR_HEIGHT,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: Layout.navBarHeight,
    height: Layout.navBarHeight,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: SHADOW,
  },
});
