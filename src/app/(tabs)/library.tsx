import { useState } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionCard, PILL_LEFT, PILL_RIGHT, SmartViewTile } from '@/features/collections/CollectionCards';
import type { Collection } from '@/features/stash/queries';
import { useCollections, useTotals } from '@/features/stash/queries';
import { enterRiseAt, reflow } from '@/motion/layout';
import { CollectionSelection } from '@/features/select/CollectionSelection';
import { SelectionScope, useSelectionMode, useSelectionStore } from '@/features/select/store';
import { useChromeScroll } from '@/motion/ScrollChrome';
import { useAppTheme } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';
import { EmptyState } from '@/ui/EmptyState';
import type { IconName } from '@/theme/icons';
import { LIST_GAP } from '@/ui/List';
import { SortButton } from '@/ui/SortButton';
import { Overline, SectionHeader, StatusScrim } from '@/ui/ScreenHeader';

type Sort = 'recent' | 'name' | 'size';
const SORTS: Record<Sort, { label: string; icon: IconName; by: (a: Collection, b: Collection) => number }> = {
  recent: { label: 'Recent', icon: 'schedule', by: (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() },
  name: { label: 'Name', icon: 'title', by: (a, b) => a.name.localeCompare(b.name) },
  size: { label: 'Size', icon: 'layers', by: (a, b) => b.itemCount - a.itemCount },
};
const SORT_OPTIONS = (Object.keys(SORTS) as Sort[]).map((key) => ({ key, label: SORTS[key].label, icon: SORTS[key].icon }));

export default function Library() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useChromeScroll(scrollY);
  const { data: totals } = useTotals();
  const { data: collections, loading } = useCollections();
  const [sort, setSort] = useState<Sort>('recent');
  const sorted = [...collections].sort(SORTS[sort].by);
  const rows: Collection[][] = [];
  for (let i = 0; i < sorted.length; i += 2) rows.push(sorted.slice(i, i + 2));
  // Long press a collection to select; several can be merged or deleted together.
  const selection = useSelectionStore();
  useSelectionMode(selection, sorted.map((c) => c.id));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: Layout.navBarClearance + insets.bottom }}
        >
          <Overline>Smart views</Overline>
          <View style={{ paddingHorizontal: Layout.gutter, gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: LIST_GAP }}>
              <SmartViewTile
                href="/collection/all"
                label="All items"
                corners={PILL_LEFT}
                detail={String(totals.all)}
                icon="gridView"
                tile={{ bg: colors.surfaceContainerHighest, fg: colors.onSecondaryContainer }}
              />
              <SmartViewTile
                href="/collection/pdfs"
                label="PDFs"
                corners={PILL_RIGHT}
                detail={totals.pdfsInProgress ? `${totals.pdfs} · ${totals.pdfsInProgress} in progress` : String(totals.pdfs)}
                glyph="PDF"
                tile={{ bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: LIST_GAP }}>
              <SmartViewTile
                href="/collection/notes"
                label="Notes"
                corners={PILL_LEFT}
                detail={String(totals.notes)}
                icon="markdown"
                tile={{ bg: colors.secondaryContainer, fg: colors.onSecondaryContainer }}
              />
              <SmartViewTile
                href="/collection/highlights"
                label="Highlights"
                corners={PILL_RIGHT}
                detail={String(totals.highlights)}
                icon="inkHighlighter"
                tile={{ bg: colors.primaryContainer, fg: colors.onPrimaryContainer }}
              />
            </View>
          </View>

          <SectionHeader title="Collections" trailing={<SortButton options={SORT_OPTIONS} value={sort} onChange={setSort} />} />
          {sorted.length === 0 && !loading ? (
            <EmptyState title="No collections yet" body="Group what you save: research, recipes, a trip. Tap + and choose Collection to start one." />
          ) : (
            <SelectionScope value={selection}>
            <View style={{ paddingHorizontal: Layout.gutter, gap: Layout.gridGap }}>
              {rows.map((row, r) => (
                <Animated.View key={row.map((c) => c.id).join('|')} layout={reflow} entering={enterRiseAt(r)} style={{ flexDirection: 'row', gap: Layout.gridGap }}>
                  {row.map((c) => (
                    <CollectionCard key={c.id} c={c} index={sorted.indexOf(c)} height={168} />
                  ))}
                  {row.length === 1 && <View style={{ flex: 1 }} />}
                </Animated.View>
              ))}
            </View>
            </SelectionScope>
          )}
        </Animated.ScrollView>
        <StatusScrim scrollY={scrollY} />
      </>
      <CollectionSelection store={selection} collections={sorted} />
    </View>
  );
}
