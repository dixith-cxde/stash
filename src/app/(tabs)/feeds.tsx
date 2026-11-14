import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { type FeedItemWithFeed, listFeedItems, listFeeds, markAllFeedItemsRead } from '@/db/repo';
import { AddFeedSheet } from '@/features/feeds/AddFeedSheet';
import { ArticleRow, LeadCard } from '@/features/feeds/ArticleCard';
import { FirstRun } from '@/features/feeds/FirstRun';
import { dayLabel } from '@/features/feeds/format';
import { SourceRail } from '@/features/feeds/SourceRail';
import { deleteFeed, refreshFeeds } from '@/features/feeds/sync';
import { haptic } from '@/motion/haptics';
import { useChromeScroll } from '@/motion/ScrollChrome';
import { useColors } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';
import { ActionSheet } from '@/ui/ActionSheet';
import { ButtonGroup } from '@/ui/ButtonGroup';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';

type Show = 'new' | 'all' | 'saved';
type Row =
  | { k: 'lead'; key: string; a: FeedItemWithFeed }
  | { k: 'day'; key: string; title: string; count: number }
  | { k: 'item'; key: string; a: FeedItemWithFeed };

/** Groups articles by day, the newest unread one lifted out as the top story. */
function toRows(items: FeedItemWithFeed[], withLead: boolean): Row[] {
  const rows: Row[] = [];
  let rest = items;
  if (withLead && items[0] && !items[0].readAt) {
    rows.push({ k: 'lead', key: `lead-${items[0].id}`, a: items[0] });
    rest = items.slice(1);
  }
  const groups = new Map<string, FeedItemWithFeed[]>();
  for (const a of rest) {
    const label = dayLabel(a.publishedAt ?? a.createdAt);
    groups.set(label, [...(groups.get(label) ?? []), a]);
  }
  for (const [title, list] of groups) {
    rows.push({ k: 'day', key: `day-${title}`, title, count: list.length });
    for (const a of list) rows.push({ k: 'item', key: a.id, a });
  }
  return rows;
}

/** RSS / Atom intake (design: Feeds): the latest from followed sites, one tap to keep. */
export default function FeedsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const onScroll = useChromeScroll();
  const [feedId, setFeedId] = useState<string | null>(null);
  const [show, setShow] = useState<Show>('new');
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** First run stays up while following starters, until "Show my feed". */
  const [firstRun, setFirstRun] = useState<boolean | null>(null);

  const { data: feeds, loading: feedsLoading } = useDbQuery(listFeeds, [], []);
  const { data: items, loading } = useDbQuery(
    () => listFeedItems({ feedId: feedId ?? undefined, unreadOnly: show === 'new', savedOnly: show === 'saved' }),
    [feedId, show],
    [] as FeedItemWithFeed[],
  );

  // Decided once, when feeds first load (state adjusted during render, React's pattern).
  if (!feedsLoading && firstRun === null) setFirstRun(feeds.length === 0);

  const selected = feeds.find((f) => f.id === feedId) ?? null;
  const unread = selected ? selected.unread : feeds.reduce((n, f) => n + f.unread, 0);
  const rows = useMemo(() => toRows(items, feedId === null && show !== 'saved'), [items, feedId, show]);
  const showFirstRun = !feedsLoading && (feeds.length === 0 || firstRun === true);

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

  const tabs: { key: Show; label: string }[] = [
    { key: 'new', label: unread ? `New · ${unread}` : 'New' },
    { key: 'all', label: 'All' },
    { key: 'saved', label: 'Saved' },
  ];

  const header = (
    <>
      <ScreenHeader
        title="Feeds"
        size="displayLarge"
        subtitle={
          showFirstRun
            ? 'Follow the sites you read'
            : `${unread} new · ${feeds.length} source${feeds.length === 1 ? '' : 's'}`
        }
        trailing={
          showFirstRun ? undefined : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton icon="moreVert" accessibilityLabel="Feed options" variant="tonal" corners={[16, 16, 16, 16]} onPress={() => setMenu(true)} />
              <IconButton icon="add" accessibilityLabel="Follow a site" variant="tonal" corners={[16, 16, 16, 16]} onPress={() => setAdding(true)} />
            </View>
          )
        }
      />
      {showFirstRun ? (
        <FirstRun onDone={() => setFirstRun(false)} />
      ) : (
        <>
          <SourceRail feeds={feeds} value={feedId} onChange={setFeedId} />
          <View style={{ paddingHorizontal: Layout.gutter, paddingTop: 16, paddingBottom: 4 }}>
            <ButtonGroup items={tabs} value={show} onChange={setShow} accessibilityLabel="Show" />
          </View>
        </>
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Animated.FlatList
        data={showFirstRun ? [] : rows}
        keyExtractor={(r) => r.key}
        renderItem={({ item: r }) =>
          r.k === 'lead' ? (
            <View style={styles.lead}>
              <LeadCard a={r.a} />
            </View>
          ) : r.k === 'day' ? (
            <View style={styles.day}>
              <Text variant="titleLarge" style={{ fontWeight: '700' }}>
                {r.title}
              </Text>
              <Text variant="titleSmall" color="onSurfaceVariant">
                {String(r.count)}
              </Text>
            </View>
          ) : (
            <View style={styles.item}>
              <ArticleRow a={r.a} />
            </View>
          )
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          showFirstRun || loading ? undefined : (
            <EmptyState
              shape={show === 'saved' ? 'clover4Leaf' : 'cookie12Sided'}
              title={show === 'saved' ? 'Nothing saved here' : show === 'new' ? 'All caught up' : 'No articles yet'}
              body={
                show === 'saved'
                  ? 'Tap the bookmark on any article to keep it in your stash.'
                  : show === 'new'
                    ? 'New articles will land here. Pull down to check now.'
                    : 'Pull down to fetch the latest articles.'
              }
            />
          )
        }
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          showFirstRun ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void pull()}
              progressViewOffset={insets.top}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surfaceContainerHigh}
            />
          )
        }
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: Layout.navBarClearance + insets.bottom }}
        initialNumToRender={8}
        windowSize={7}
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

const styles = StyleSheet.create({
  lead: { paddingHorizontal: Layout.gutter, paddingTop: 12 },
  day: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: Layout.gutter + 8, paddingTop: 24, paddingBottom: 10 },
  item: { paddingHorizontal: Layout.gutter, paddingBottom: 4 },
});
