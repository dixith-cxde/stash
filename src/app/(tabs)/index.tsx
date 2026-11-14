import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionCard, NewCollectionCard } from '@/features/collections/CollectionCards';
import { Masonry } from '@/features/feed/Masonry';
import { type FeedFilter, matchesFilter } from '@/features/stash/model';
import { useCollections, useFeed, useTotals } from '@/features/stash/queries';
import { useChromeScroll } from '@/motion/ScrollChrome';
import { useColors } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { ButtonGroup } from '@/ui/ButtonGroup';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { ScreenHeader, SectionHeader } from '@/ui/ScreenHeader';
import { SearchPill } from '@/ui/SearchPill';

const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'links', label: 'Links' },
  { key: 'pdfs', label: 'PDFs' },
  { key: 'notes', label: 'Notes' },
  { key: 'quotes', label: 'Quotes' },
];

const RAIL_W = 148;
const RAIL_H = 176;
const RAIL_GAP = 10;

export default function Home() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const onScroll = useChromeScroll();
  const { data: totals } = useTotals();
  const { data: collections } = useCollections();
  const { data: feed, loading } = useFeed({});
  const [filter, setFilter] = useState<FeedFilter>('all');
  const visible = feed.filter((f) => matchesFilter(f, filter));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: Layout.navBarClearance + insets.bottom }}
        >
          <ScreenHeader
            title="Stash"
            size="displayLarge"
            subtitle={`${totals.all} saved · ${totals.unread} to read`}
            trailing={
              <IconButton
                icon="settings"
                accessibilityLabel="Settings"
                variant="tonal"
                corners={[16, 16, 16, 16]}
                onPress={() => router.push('/settings')}
              />
            }
          />
          <SearchPill onPress={() => router.navigate('/search')} />

          <SectionHeader
            title="Collections"
            count={collections.length}
            trailing={<Button label="See all" variant="text" size="xs" onPress={() => router.navigate('/library')} />}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={RAIL_W + RAIL_GAP}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: Layout.gutter, gap: RAIL_GAP }}
            accessibilityRole="list"
            accessibilityLabel="Collections"
          >
            {collections.map((c, i) => (
              <CollectionCard key={c.id} c={c} index={i} width={RAIL_W} height={RAIL_H} />
            ))}
            <NewCollectionCard height={RAIL_H} onPress={() => router.push('/collection/new')} />
          </ScrollView>

          <View style={{ paddingHorizontal: Layout.gutter, paddingTop: 28, paddingBottom: 12 }}>
            <ButtonGroup items={FILTERS} value={filter} onChange={setFilter} accessibilityLabel="Filter by type" />
          </View>

          {visible.length > 0 ? (
            <Masonry items={visible} />
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
      </>
    </View>
  );
}
