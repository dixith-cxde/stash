import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionCard, SmartViewTile } from '@/features/collections/CollectionCards';
import type { Collection } from '@/features/stash/queries';
import { useCollections, useTotals } from '@/features/stash/queries';
import { reflow } from '@/motion/layout';
import { useChromeScroll } from '@/motion/ScrollChrome';
import { useSelection } from '@/motion/useSelection';
import { useAppTheme } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';
import { EmptyState } from '@/ui/EmptyState';
import { Ico } from '@/ui/Ico';
import { IconButton } from '@/ui/IconButton';
import { PressableSurface } from '@/ui/PressableSurface';
import { Overline, ScreenHeader, SectionHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';

type Sort = 'recent' | 'name' | 'size';
const SORTS: Record<Sort, { label: string; next: Sort; by: (a: Collection, b: Collection) => number }> = {
  recent: { label: 'Recent', next: 'name', by: (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() },
  name: { label: 'Name', next: 'size', by: (a, b) => a.name.localeCompare(b.name) },
  size: { label: 'Size', next: 'recent', by: (a, b) => b.itemCount - a.itemCount },
};

export default function Library() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const onScroll = useChromeScroll();
  const { data: totals } = useTotals();
  const { data: collections, loading } = useCollections();
  const [sort, setSort] = useState<Sort>('recent');
  const sorted = [...collections].sort(SORTS[sort].by);
  const rows: Collection[][] = [];
  for (let i = 0; i < sorted.length; i += 2) rows.push(sorted.slice(i, i + 2));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: Layout.navBarClearance + insets.bottom }}
        >
          <ScreenHeader
            title="Library"
            subtitle={`${collections.length} collections · ${totals.all} items`}
            trailing={
              <IconButton
                icon="add"
                accessibilityLabel="New collection"
                variant="tonal"
                corners={[16, 16, 16, 16]}
                onPress={() => router.push('/collection/new')}
              />
            }
          />

          <Overline>Smart views</Overline>
          <View style={{ paddingHorizontal: Layout.gutter, gap: Layout.gridGap }}>
            <View style={{ flexDirection: 'row', gap: Layout.gridGap }}>
              <SmartViewTile
                href="/collection/all"
                label="All items"
                detail={String(totals.all)}
                icon="gridView"
                tile={{ bg: colors.surfaceContainerHighest, fg: colors.onSecondaryContainer }}
              />
              <SmartViewTile
                href="/collection/pdfs"
                label="PDFs"
                detail={totals.pdfsInProgress ? `${totals.pdfs} · ${totals.pdfsInProgress} in progress` : String(totals.pdfs)}
                glyph="PDF"
                tile={{ bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: Layout.gridGap }}>
              <SmartViewTile
                href="/collection/notes"
                label="Notes"
                detail={String(totals.notes)}
                icon="markdown"
                tile={{ bg: colors.secondaryContainer, fg: colors.onSecondaryContainer }}
              />
              <SmartViewTile
                href="/collection/highlights"
                label="Highlights"
                detail={String(totals.highlights)}
                icon="inkHighlighter"
                tile={{ bg: colors.primaryContainer, fg: colors.onPrimaryContainer }}
              />
            </View>
          </View>

          <SectionHeader title="Collections" trailing={<SortButton sort={sort} onPress={() => setSort(SORTS[sort].next)} />} />
          {sorted.length === 0 && !loading ? (
            <EmptyState shape="clover4Leaf" title="No collections yet" body="Group what you save: research, recipes, a trip. Tap + to start one." />
          ) : (
            <View style={{ paddingHorizontal: Layout.gutter, gap: Layout.gridGap }}>
              {rows.map((row) => (
                <Animated.View key={row.map((c) => c.id).join('|')} layout={reflow} style={{ flexDirection: 'row', gap: Layout.gridGap }}>
                  {row.map((c) => (
                    <CollectionCard key={c.id} c={c} index={sorted.indexOf(c)} height={168} />
                  ))}
                  {row.length === 1 && <View style={{ flex: 1 }} />}
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.ScrollView>
      </>
    </View>
  );
}

/** "⇅ Recent" pill: each tap cycles the sort; the icon flips with fastSpatial. */
function SortButton({ sort, onPress }: { sort: Sort; onPress: () => void }) {
  const { colors } = useAppTheme();
  const flip = useSelection(sort === 'name', { shape: 'fastSpatial' });
  const icon = useAnimatedStyle(() => ({ transform: [{ rotate: `${flip.shape.get() * 180}deg` }] }));
  return (
    <PressableSurface
      kind="button"
      corner={20}
      onPress={onPress}
      accessibilityLabel={`Sort by ${SORTS[sort].label}`}
      style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, backgroundColor: colors.surfaceContainerHigh }}
    >
      <Animated.View style={icon}>
        <Ico name="swapVert" size={18} color={colors.onSurfaceVariant} />
      </Animated.View>
      <Text variant="labelMedium" color="onSurfaceVariant">
        {SORTS[sort].label}
      </Text>
    </PressableSurface>
  );
}
