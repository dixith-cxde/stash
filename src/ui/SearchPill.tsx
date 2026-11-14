import { useColors } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';

import { Ico } from './Ico';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';

/** The Home search field (design: 56dp pill). Tapping opens the Search tab. */
export function SearchPill({ onPress, placeholder = 'Search your stash' }: { onPress: () => void; placeholder?: string }) {
  const colors = useColors();
  return (
    <PressableSurface
      corner={28}
      pressedCorner={20}
      pressedScale={0.98}
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel={placeholder}
      style={{
        marginHorizontal: Layout.gutter,
        marginTop: 16,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        backgroundColor: colors.surfaceContainerHigh,
      }}
    >
      <Ico name="search" size={24} color={colors.onSurfaceVariant} />
      <Text variant="bodyLarge" color="onSurfaceVariant" style={{ fontWeight: '500' }}>
        {placeholder}
      </Text>
    </PressableSurface>
  );
}
