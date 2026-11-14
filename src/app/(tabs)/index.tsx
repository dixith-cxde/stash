import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionPill } from '@/features/collections/CollectionCards';
import { Masonry } from '@/features/feed/Masonry';
import { ReadingQueue } from '@/features/feed/ReadingQueue';
import { HomeTour } from '@/features/onboarding/HomeTour';
import { type FeedFilter, matchesFilter, readingQueue } from '@/features/stash/model';
import { useCollections, useFeed, useTotals } from '@/features/stash/queries';
import { useChromeScroll } from '@/motion/ScrollChrome';
import { useSettings } from '@/state/settings';
import { useColors } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';
import { ButtonGroup } from '@/ui/ButtonGroup';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { ScreenHeader } from '@/ui/ScreenHeader';
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
  const onScroll = useChromeScroll();
  const { data: totals } = useTotals();
  const { data: collections } = useCollections();
  const { data: feed, loading } = useFeed({});
  const [filter, setFilter] = useState<FeedFilter>('all');
  const visible = feed.filter((f) => matchesFilter(f, filter));
  const queue = useMemo(() => readingQueue(feed.flatMap((f) => (f.kind === 'bookmark' ? [f.item] : []))), [feed]);

  // First launch: the welcome pages, then a short tour of Home.
  const onboarded = useSettings((s) => s.onboarded);
  const tourDone = useSettings((s) => s.tourDone);
  const setTourDone = useSettings((s) => s.setTourDone);
  useEffect(() => {
    if (onboarded) return;
    const t = setTimeout(() => router.push('/welcome'), 300);
    return () => clearTimeout(t);
  }, [onboarded]);

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
          <SearchPill href="/find" />

          {collections.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Layout.gutter, paddingTop: 16, gap: 8, alignItems: 'center' }}
              accessibilityRole="list"
              accessibilityLabel="Collections"
            >
              {collections.map((c) => (
                <CollectionPill key={c.id} c={c} />
              ))}
              <IconButton icon="add" accessibilityLabel="New collection" variant="tonal" size={48} onPress={() => router.push('/collection/new')} />
            </ScrollView>
          )}

          <ReadingQueue entries={queue} />

          <View style={{ paddingHorizontal: Layout.gutter, paddingTop: 20, paddingBottom: 12 }}>
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
      {onboarded && !tourDone && <HomeTour onDone={() => setTourDone(true)} />}
    </View>
  );
}
