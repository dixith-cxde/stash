import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BLOCK_H, CollectionBlock, NewCollectionBlock } from '@/features/collections/CollectionCards';
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
  // Collections in columns of two, then the "New collection" block.
  const blocks: (string | (typeof collections)[number])[] = [...collections, 'new'];
  const columns: (typeof blocks)[] = [];
  for (let i = 0; i < blocks.length; i += 2) columns.push(blocks.slice(i, i + 2));

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
      <IconButton
        icon={layout === 'shapes' ? 'gridView' : 'category'}
        accessibilityLabel={layout === 'shapes' ? 'Show as cards' : 'Show as shapes'}
        onPress={() => setLayout(layout === 'shapes' ? 'cards' : 'shapes')}
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
            contentContainerStyle={{ paddingHorizontal: Layout.gutter, paddingTop: 16, gap: 8 }}
            accessibilityRole="list"
            accessibilityLabel="Collections"
          >
            {columns.map((col, i) => (
              <View key={i} style={{ gap: 8, height: BLOCK_H * 2 + 8 }}>
                {col.map((c) =>
                  c === 'new' ? (
                    <NewCollectionBlock key="new" onPress={() => router.push('/collection/new')} />
                  ) : typeof c === 'string' ? null : (
                    <CollectionBlock key={c.id} c={c} />
                  ),
                )}
              </View>
            ))}
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
