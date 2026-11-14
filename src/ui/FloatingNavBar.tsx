import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChromeHidden } from '@/motion/ScrollChrome';
import { useSelection } from '@/motion/useSelection';
import { useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { withAlpha } from '@/theme/palette';
import { Corner, Layout } from '@/theme/tokens';
import { FONT_FAMILY, Type } from '@/theme/type';

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
/** Active pill: horizontal nav item (androidx ShortNavigationBar start-icon item, 40dp → 48dp touch). */
const INDICATOR_HEIGHT = 48;
/** Softer top corners, fully rounded bottom: the bar reads as resting on the bottom edge. */
const TOP_CORNER = Corner.large;
const BOTTOM_CORNER = Layout.navBarHeight / 2;
/** How much wider the active slot grows to make room for its label. */
const ACTIVE_GROW = 2.5;
const LABEL_MAX = 96;

/**
 * Floating navigation bar with the add FAB beside it. Asymmetric shape (top corners
 * large, bottom corners full), M3 flexible nav bar colors (secondaryContainer
 * indicator). Only the active destination shows its label, inside the indicator pill;
 * the active slot widens on a spatial spring like a standard button group.
 */
export function FloatingNavBar({ items, selectedKey, onSelect, onFab, fabLabel }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const index = Math.max(0, items.findIndex((i) => i.key === selectedKey));
  const hidden = useChromeHidden();
  const away = Layout.navBarHeight + Layout.navBarBottom + insets.bottom + 16;
  const barMotion = useAnimatedStyle(() => {
    const h = hidden ? hidden.get() : 0;
    return { opacity: 1 - h * 0.6, transform: [{ translateY: h * away }] };
  });

  return (
    <Animated.View pointerEvents="box-none" style={[styles.row, { bottom: insets.bottom + Layout.navBarBottom }, barMotion]}>
      <View
        accessibilityRole="tablist"
        style={[styles.bar, styles.shape, { backgroundColor: colors.surfaceContainerHigh, boxShadow: shadow(colors.shadow) }]}
      >
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
      </View>
      <PressableSurface
        corner={BOTTOM_CORNER}
        pressedCorner={Corner.large}
        onPress={onFab}
        accessibilityLabel={fabLabel}
        style={[styles.fab, styles.fabTop, { backgroundColor: colors.primary, boxShadow: shadow(colors.shadow) }]}
      >
        <Ico name="add" size={28} color={colors.onPrimary} />
      </PressableSurface>
    </Animated.View>
  );
}

function NavSlot({ item, selected, onPress }: { item: NavItem; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  const sel = useSelection(selected, { shape: 'defaultSpatial', color: 'defaultEffects' });

  const slot = useAnimatedStyle(() => ({ flexGrow: 1 + sel.shape.get() * (ACTIVE_GROW - 1) }));
  const pill = useAnimatedStyle(() => ({
    backgroundColor: withAlphaWorklet(colors.secondaryContainer, sel.color.get()),
  }));
  const label = useAnimatedStyle(() => ({
    maxWidth: Math.max(0, sel.shape.get()) * LABEL_MAX,
    opacity: sel.color.get(),
    marginLeft: Math.max(0, sel.shape.get()) * 8,
  }));
  const inactiveIcon = useAnimatedStyle(() => ({ opacity: 1 - sel.color.get() }));
  const activeIcon = useAnimatedStyle(() => ({ opacity: sel.color.get() }));

  return (
    <Animated.View style={[styles.slot, slot]}>
      <PressableSurface
        kind="button"
        corner={INDICATOR_HEIGHT / 2}
        pressedScale={0.94}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected }}
        style={styles.press}
      >
        <Animated.View style={[styles.pill, pill]}>
          <View style={styles.icon}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.center, inactiveIcon]}>
              <Ico name={item.icon} size={24} color={colors.onSurfaceVariant} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.center, activeIcon]}>
              <Ico name={item.selectedIcon} size={24} color={colors.onSecondaryContainer} />
            </Animated.View>
          </View>
          <Animated.Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
            style={[{ fontFamily: FONT_FAMILY, color: colors.onSecondaryContainer }, Type.labelLargeEmphasized, styles.label, label]}
          >
            {item.label}
          </Animated.Text>
        </Animated.View>
      </PressableSurface>
    </Animated.View>
  );
}

/** `#RRGGBB` at a 0..1 alpha, on the UI thread. */
function withAlphaWorklet(color: string, alpha: number) {
  'worklet';
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color.slice(0, 7)}${a}`;
}

const shadow = (c: string) => `0px 6px 20px ${withAlpha(c, 0.4)}`;

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: Layout.gutter,
    right: Layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shape: {
    borderTopLeftRadius: TOP_CORNER,
    borderTopRightRadius: TOP_CORNER,
    borderBottomLeftRadius: BOTTOM_CORNER,
    borderBottomRightRadius: BOTTOM_CORNER,
  },
  bar: {
    flex: 1,
    height: Layout.navBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BAR_PADDING,
    gap: 4,
  },
  slot: {
    flexBasis: 0,
    height: INDICATOR_HEIGHT,
  },
  press: {
    flex: 1,
    height: INDICATOR_HEIGHT,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: INDICATOR_HEIGHT / 2,
    paddingHorizontal: 10,
  },
  icon: {
    width: 24,
    height: 24,
  },
  label: {
    overflow: 'hidden',
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
  },
  /** Specific corners win over the morph's borderRadius: the top stays semi-round, the bottom morphs. */
  fabTop: {
    borderTopLeftRadius: TOP_CORNER,
    borderTopRightRadius: TOP_CORNER,
  },
});
