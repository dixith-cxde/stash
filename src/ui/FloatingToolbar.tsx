import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { withAlpha } from '@/theme/palette';
import { Corner, Layout } from '@/theme/tokens';

import { Ico } from './Ico';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';

/** androidx FloatingToolbar: 64dp, 8dp padding, 16dp from the screen edge. */
export const TOOLBAR_HEIGHT = 64;
const PADDING = 8;
/** Scroll clearance for pages that show a floating toolbar. */
export const TOOLBAR_CLEARANCE = TOOLBAR_HEIGHT + 16 + 24;

type Props = {
  /** Icon buttons (round, never square, in a floating toolbar). */
  children: React.ReactNode;
  /** Standard = surfaceContainer (focus on content); vibrant = primaryContainer (a mode, e.g. editing). */
  vibrant?: boolean;
  /** The page's one high-emphasis action, shown as an extended FAB beside the toolbar. */
  fab?: { label: string; icon: IconName; onPress: () => void };
};

/**
 * M3 Expressive floating toolbar for a page's contextual actions, pinned 16dp above the
 * bottom inset, with an optional extended FAB for the primary action (standard toolbar →
 * primaryContainer FAB, vibrant → tertiaryContainer FAB). Only one action is emphasized.
 */
export function FloatingToolbar({ children, vibrant, fab }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const shadow = `0px 6px 20px ${withAlpha(colors.shadow, 0.35)}`;
  const fabBg = vibrant ? colors.tertiaryContainer : colors.primaryContainer;
  const fabFg = vibrant ? colors.onTertiaryContainer : colors.onPrimaryContainer;
  return (
    <View pointerEvents="box-none" style={[styles.row, { bottom: insets.bottom + 16 }]}>
      <View
        accessibilityRole="toolbar"
        style={[styles.bar, { backgroundColor: vibrant ? colors.primaryContainer : colors.surfaceContainer, boxShadow: shadow }]}
      >
        {children}
      </View>
      {fab && (
        <PressableSurface
          corner={Corner.large}
          pressedCorner={Corner.medium}
          onPress={fab.onPress}
          accessibilityLabel={fab.label}
          style={[styles.fab, { backgroundColor: fabBg, boxShadow: shadow }]}
        >
          <Ico name={fab.icon} size={24} color={fabFg} />
          <Text variant="titleMediumEmphasized" color={fabFg} numberOfLines={1}>
            {fab.label}
          </Text>
        </PressableSurface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: Layout.gutter,
    right: Layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bar: {
    height: TOOLBAR_HEIGHT,
    borderRadius: TOOLBAR_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: PADDING,
  },
  fab: {
    height: TOOLBAR_HEIGHT,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
});
