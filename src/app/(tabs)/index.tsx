import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionCarousel } from '@/features/collections/CollectionCarousel';
import { Masonry } from '@/features/feed/Masonry';
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
          contentContainerStyle={{ paddingTop: insets.top, paddingBottom: Layout.navBarClearance + insets.bottom }}
        >
          <ScreenHeader
            title="Stash"
            size="editorial"
            subtitle={`${totals.all} saved · ${totals.unread} to read`}
            trailing={<SettingsButton />}
          />
          <SearchPill href="/find" />

          <CollectionCarousel collections={collections} />

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
        <CollapsedAppBar title="Stash" scrollY={scrollY} trailing={<SettingsButton />} />
      </>
      {onboarded && !tourDone && <HomeTour onDone={() => setTourDone(true)} />}
    </View>
  );
}

function SettingsButton() {
  return <IconButton icon="settings" accessibilityLabel="Settings" onPress={() => router.push('/settings')} />;
}
