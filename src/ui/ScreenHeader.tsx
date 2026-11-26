import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';

import { Text } from './Text';

const BAR_HEIGHT = 64;

/**
 * Slim top row of a tab (64dp): an optional quiet leading element (Home's brand mark) and up to
 * two icon buttons. Tabs carry no headline; the nav bar already says where you are.
 */
export function TopRow({ leading, trailing }: { leading?: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <View style={[styles.actions, { justifyContent: 'space-between' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: Layout.textInset - Layout.gutter }}>{leading}</View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{trailing}</View>
    </View>
  );
}

/**
 * Status bar backdrop for a tab: clear at the top of the page, filling with the surface color
 * once content scrolls under the status bar (effects only: opacity, no bounce).
 */
export function StatusScrim({ scrollY }: { scrollY: SharedValue<number> }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 24], [0, 0.96], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.collapsed, { height: insets.top, backgroundColor: colors.surface }, style]}
    />
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
});
