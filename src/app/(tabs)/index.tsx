import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BLOCK_GAP, blockCorners, CollectionBlock, NewCollectionBlock } from '@/features/collections/CollectionCards';
import { Masonry } from '@/features/feed/Masonry';
import { ShapeWall } from '@/features/feed/ShapeWall';
import { HomeTour } from '@/features/onboarding/HomeTour';
import { type FeedFilter, matchesFilter } from '@/features/stash/model';
import { useCollections, useFeed, useTotals } from '@/features/stash/queries';
import { useChromeScroll } from '@/motion/ScrollChrome';
import { useSettings } from '@/state/settings';
import { useColors } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';
import { ButtonGroup } from '@/ui/ButtonGroup';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { IconToggleGroup } from '@/ui/IconToggleGroup';
import { CollapsedAppBar, ScreenHeader } from '@/ui/ScreenHeader';
import { SearchPill } from '@/ui/SearchPill';

const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'links', label: 'Links' },
  { key: 'pdfs', label: 'PDFs' },
  { key: 'notes', label: 'Notes' },
  { key: 'quotes', label: 'Quotes' },
];

export default function Home() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useChromeScroll(scrollY);
  const { data: totals } = useTotals();
  const { data: collections } = useCollections();
  const { data: feed, loading } = useFeed({});
  const [filter, setFilter] = useState<FeedFilter>('all');
  const visible = feed.filter((f) => matchesFilter(f, filter));
  const layout = useSettings((s) => s.homeLayout);
  const setLayout = useSettings((s) => s.setHomeLayout);
  // Collections as one connected group in two rows; "New collection" closes it.
  const blocks: ((typeof collections)[number] | 'new')[] = [...collections, 'new'];
  const half = Math.ceil(blocks.length / 2);
  const rows = [blocks.slice(0, half), blocks.slice(half)].filter((r) => r.length);

  // First launch: the welcome pages, then a short tour of Home.
  const onboarded = useSettings((s) => s.onboarded);
  const tourDone = useSettings((s) => s.tourDone);
  const setTourDone = useSettings((s) => s.setTourDone);
  useEffect(() => {
    if (onboarded) return;
    const t = setTimeout(() => router.push('/welcome'), 300);
    return () => clearTimeout(t);
  }, [onboarded]);

  const actions = (
    <>
      <IconToggleGroup
        items={[
          { key: 'cards', icon: 'gridView', label: 'Cards' },
          { key: 'shapes', icon: 'category', label: 'Playful' },
        ]}
        value={layout === 'shapes' ? 'shapes' : 'cards'}
        onChange={setLayout}
        accessibilityLabel="Home layout"
      />
      <SettingsButton />
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: insets.top, paddingBottom: Layout.navBarClearance + insets.bottom }}
        >
          <ScreenHeader
            title="Stash"
            size="editorial"
            subtitle={`${totals.all} saved · ${totals.unread} to read`}
            trailing={actions}
          />
          <SearchPill href="/find" />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Layout.gutter, paddingTop: 16 }}
            accessibilityRole="list"
            accessibilityLabel="Collections"
          >
            <View style={{ gap: BLOCK_GAP }}>
              {rows.map((row, r) => (
                <View key={r} style={{ flexDirection: 'row', gap: BLOCK_GAP }}>
                  {row.map((c, i) => {
                    const corners = blockCorners(r as 0 | 1, i, row.length, rows[1 - r]?.length ?? 0);
                    return c === 'new' ? <NewCollectionBlock key="new" corners={corners} /> : <CollectionBlock key={c.id} c={c} corners={corners} />;
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: Layout.gutter, paddingTop: 20, paddingBottom: 12 }}>
            <ButtonGroup items={FILTERS} value={filter} onChange={setFilter} accessibilityLabel="Filter by type" />
          </View>

          {visible.length > 0 ? (
            layout === 'shapes' ? <ShapeWall items={visible} /> : <Masonry items={visible} />
          ) : loading ? null : (
            <EmptyState
              shape={filter === 'all' ? 'cookie9Sided' : 'clover4Leaf'}
              title={filter === 'all' ? 'Nothing saved yet' : 'Nothing here yet'}
              body={
                filter === 'all'
                  ? 'Share a link, PDF or text to Stash from any app, or tap + to add one.'
                  : 'Items of this type will show up here.'
              }
            />
          )}
        </Animated.ScrollView>
        <CollapsedAppBar title="Stash" scrollY={scrollY} trailing={actions} />
      </>
      {onboarded && !tourDone && <HomeTour onDone={() => setTourDone(true)} />}
    </View>
  );
}

function SettingsButton() {
  return <IconButton icon="settings" accessibilityLabel="Settings" onPress={() => router.push('/settings')} />;
}
