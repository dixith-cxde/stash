import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { type FeedItemWithFeed, listFeedItems, listFeeds, markAllFeedItemsRead } from '@/db/repo';
import { AddFeedSheet, STARTER_FEEDS } from '@/features/feeds/AddFeedSheet';
import { ArticleCard } from '@/features/feeds/ArticleCard';
import { addFeed, deleteFeed, refreshFeeds } from '@/features/feeds/sync';
import { haptic } from '@/motion/haptics';
import { useChromeScroll } from '@/motion/ScrollChrome';
import { useColors } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';
import { ActionSheet } from '@/ui/ActionSheet';
import { Button } from '@/ui/Button';
import { ButtonGroup } from '@/ui/ButtonGroup';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { showSnackbar } from '@/ui/Snackbar';

type Show = 'unread' | 'all';
const SHOW: { key: Show; label: string }[] = [
  { key: 'unread', label: 'New' },
  { key: 'all', label: 'All' },
];

/** RSS / Atom intake (rebuild plan §0): the latest from followed sites, one tap to keep. */
export default function FeedsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const onScroll = useChromeScroll();
  const [feedId, setFeedId] = useState<string | null>(null);
  const [show, setShow] = useState<Show>('unread');
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: feeds, loading: feedsLoading } = useDbQuery(listFeeds, [], []);
  const { data: items, loading } = useDbQuery(
    () => listFeedItems({ feedId: feedId ?? undefined, unreadOnly: show === 'unread' }),
    [feedId, show],
    [] as FeedItemWithFeed[],
  );
  const selected = feeds.find((f) => f.id === feedId) ?? null;
  const unread = feeds.reduce((n, f) => n + f.unread, 0);

  // Battery: only feeds older than the refresh interval are fetched, and only while here.
  useFocusEffect(
    useCallback(() => {
      void refreshFeeds();
    }, []),
  );

  const pull = async () => {
    setRefreshing(true);
    const added = await refreshFeeds({ force: true });
    setRefreshing(false);
    showSnackbar(added ? `${added} new article${added === 1 ? '' : 's'}` : 'You’re up to date');
  };

  const header = (
    <>
      <ScreenHeader
        title="Feeds"
        size="displayLarge"
        subtitle={feeds.length ? `${unread} new · ${feeds.length} source${feeds.length === 1 ? '' : 's'}` : 'Follow the sites you read'}
        trailing={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {feeds.length > 0 && (
              <IconButton icon="moreVert" accessibilityLabel="More" variant="tonal" corners={[16, 16, 16, 16]} onPress={() => setMenu(true)} />
            )}
            <IconButton icon="add" accessibilityLabel="Add a feed" variant="tonal" corners={[16, 16, 16, 16]} onPress={() => setAdding(true)} />
          </View>
        }
      />
      {feeds.length > 0 && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Layout.gutter, gap: 8, paddingTop: 16 }}
            accessibilityLabel="Sources"
          >
            <Chip label="All sources" selected={feedId === null} onPress={() => setFeedId(null)} />
            {feeds.map((f) => (
              <Chip
                key={f.id}
                label={f.unread ? `${f.title} · ${f.unread}` : f.title}
                selected={f.id === feedId}
                onPress={() => setFeedId(f.id === feedId ? null : f.id)}
              />
            ))}
          </ScrollView>
          <View style={{ paddingHorizontal: Layout.gutter, paddingTop: 16, paddingBottom: 12 }}>
            <ButtonGroup items={SHOW} value={show} onChange={setShow} accessibilityLabel="Show" />
          </View>
        </>
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Animated.FlatList
        data={items}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: Layout.gutter }}>
            <ArticleCard a={item} />
          </View>
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={
          feedsLoading || loading ? undefined : feeds.length === 0 ? (
            <View style={{ paddingHorizontal: Layout.gutter }}>
              <EmptyState shape="cookie9Sided" title="No feeds yet" body="Follow a site and its new articles land here. Save the ones worth keeping." />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {STARTER_FEEDS.map((f) => (
                  <Chip
                    key={f.url}
                    label={f.label}
                    icon="add"
                    onPress={() =>
                      void addFeed(f.url)
                        .then(() => {
                          haptic.save();
                          showSnackbar(`Following ${f.label}`);
                        })
                        .catch(() => showSnackbar(`Couldn't reach ${f.label}`))
                    }
                  />
                ))}
              </View>
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <Button label="Add a feed" icon="rssFeed" onPress={() => setAdding(true)} />
              </View>
            </View>
          ) : (
            <EmptyState
              shape="clover4Leaf"
              title={show === 'unread' ? 'All caught up' : 'No articles yet'}
              body={show === 'unread' ? 'Nothing new right now. Pull down to check again.' : 'Pull down to fetch the latest articles.'}
            />
          )
        }
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void pull()} progressViewOffset={insets.top} colors={[colors.primary]} progressBackgroundColor={colors.surfaceContainerHigh} />
        }
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: Layout.navBarClearance + insets.bottom }}
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
      />

      {adding && <AddFeedSheet onDismiss={() => setAdding(false)} onAdded={(id) => setFeedId(id)} />}
      {menu && (
        <ActionSheet
          title={selected ? selected.title : 'Feeds'}
          onDismiss={() => setMenu(false)}
          actions={[
            {
              label: selected ? `Mark ${selected.title} as read` : 'Mark everything as read',
              icon: 'doneAll',
              onPress: () => void markAllFeedItemsRead(selected?.id),
            },
            { label: 'Check for new articles', icon: 'rssFeed', onPress: () => void pull() },
            ...(selected
              ? [
                  {
                    label: `Unfollow ${selected.title}`,
                    icon: 'delete' as const,
                    destructive: true,
                    onPress: () =>
                      void deleteFeed(selected.id).then(() => {
                        haptic.remove();
                        setFeedId(null);
                        showSnackbar(`Unfollowed ${selected.title}`);
                      }),
                  },
                ]
              : []),
          ]}
        />
      )}
    </View>
  );
}

function Separator() {
  return <View style={{ height: 8 }} />;
}
