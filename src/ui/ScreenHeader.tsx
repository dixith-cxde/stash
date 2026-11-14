import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, interpolateColor, type SharedValue, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';

import { Text } from './Text';

/** Large flexible top app bar (androidx LargeFlexibleTopAppBar): 64dp action row + headline. */
const BAR_HEIGHT = 64;
/** Scroll offset where the large headline has moved under the collapsed bar. */
const COLLAPSE_AT = 88;

type Props = {
  title: string;
  subtitle?: string;
  /**
   * `large` = large flexible app bar headline (displaySmall emphasized). `editorial` = the
   * Home wordmark, the one editorial hero moment.
   */
  size?: 'large' | 'editorial';
  /** Up to two icon buttons (M3 app bar rule); one may be tonal/wide for emphasis. */
  trailing?: React.ReactNode;
};

/**
 * Expanded part of a large flexible app bar, placed at the top of the scroll content:
 * action row (64dp) then the headline and subtitle. Pair it with `CollapsedAppBar` outside
 * the scroll view so the title pins to a small bar once this scrolls away.
 */
export function ScreenHeader({ title, subtitle, size = 'large', trailing }: Props) {
  return (
    <View>
      <View style={styles.actions}>{trailing}</View>
      <View style={{ paddingHorizontal: Layout.textInset, paddingBottom: 12, marginTop: size === 'editorial' ? -12 : 0 }}>
        <Text variant={size === 'editorial' ? 'editorialLarge' : 'displaySmallEmphasized'} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="titleMedium" color="onSurfaceVariant" style={{ marginTop: 4 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The collapsed small app bar (64dp, titleLarge) pinned over the top of a tab. Invisible at
 * the top of the page; as the large headline scrolls under it, the container fills with
 * surfaceContainer and the title fades in (effects only: color and opacity, no bounce).
 */
export function CollapsedAppBar({ title, scrollY, trailing }: { title: string; scrollY: SharedValue<number>; trailing?: React.ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const container = useAnimatedStyle(() => {
    const p = interpolate(scrollY.get(), [COLLAPSE_AT - 24, COLLAPSE_AT], [0, 1], Extrapolation.CLAMP);
    return {
      backgroundColor: interpolateColor(p, [0, 1], [`${colors.surfaceContainer.slice(0, 7)}00`, colors.surfaceContainer]),
    };
  });
  // A hidden bar must not catch taps meant for the expanded header's buttons under it.
  const [shown, setShown] = useState(false);
  useAnimatedReaction(
    () => scrollY.get() > COLLAPSE_AT - 12,
    (now, before) => {
      if (now !== before) scheduleOnRN(setShown, now);
    },
  );
  const content = useAnimatedStyle(() => {
    const p = interpolate(scrollY.get(), [COLLAPSE_AT - 8, COLLAPSE_AT + 16], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * 8 }] };
  });
  return (
    <Animated.View pointerEvents={shown ? 'box-none' : 'none'} style={[styles.collapsed, { paddingTop: insets.top }, container]}>
      <Animated.View style={[styles.collapsedRow, content]}>
        <Text variant="titleLargeEmphasized" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </Text>
        {trailing}
      </Animated.View>
    </Animated.View>
  );
}

/** Section title row: "Collections 6 ··· See all". */
export function SectionHeader({ title, count, trailing }: { title: string; count?: number; trailing?: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: Layout.textInset,
        paddingRight: Layout.gutter,
        paddingTop: 28,
        paddingBottom: 12,
        minHeight: 40,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text variant="titleLargeEmphasized" accessibilityRole="header">
          {title}
        </Text>
        {count !== undefined && (
          <Text variant="titleMedium" color="tertiary" style={{ fontVariant: ['tabular-nums'] }}>
            {count}
          </Text>
        )}
      </View>
      {trailing}
    </View>
  );
}

/** Group label above a list or tile group ("Smart views", "Organize"): titleSmall emphasized in primary. */
export function Overline({ children, inset = true }: { children: string; inset?: boolean }) {
  return (
    <Text variant="titleSmallEmphasized" color="primary" style={inset ? { paddingHorizontal: Layout.textInset, paddingTop: 24, paddingBottom: 10 } : undefined}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  actions: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: Layout.gutter,
  },
  collapsed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  collapsedRow: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: Layout.textInset,
    paddingRight: Layout.gutter,
  },
});
