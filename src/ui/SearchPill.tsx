import type { Href } from 'expo-router';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

import { useContainerSource } from '@/motion/transition/useContainerSource';
import { useColors } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';

import { Ico } from './Ico';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';

const CORNER = 28;

/**
 * The Home search field (design: 56dp pill). Tapping grows it into the keyword search page
 * (container transform, animation.md §6).
 */
export function SearchPill({ href, placeholder = 'Search your stash' }: { href: Href; placeholder?: string }) {
  const colors = useColors();
  const frameRef = useAnimatedRef<Animated.View>();
  const bg = colors.surfaceContainerHigh;
  const { openAt, hidden } = useContainerSource({ corner: CORNER, color: bg });
  return (
    <Animated.View
      ref={frameRef}
      collapsable={false}
      style={{ marginHorizontal: Layout.gutter, marginTop: 16, opacity: hidden ? 0 : 1 }}
    >
      <PressableSurface
        corner={CORNER}
        pressedCorner={20}
        pressedScale={0.98}
        measureRef={frameRef}
        onPressMeasured={(frame) => openAt(href, frame)}
        onPress={() => openAt(href, null)}
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, backgroundColor: bg }}
      >
        <Ico name="search" size={24} color={colors.onSurfaceVariant} />
        <Text variant="bodyLarge" color="onSurfaceVariant" style={{ fontWeight: '500' }}>
          {placeholder}
        </Text>
      </PressableSurface>
    </Animated.View>
  );
}
