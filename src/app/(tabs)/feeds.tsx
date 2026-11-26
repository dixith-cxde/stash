import { useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { type FeedItemWithFeed, listFeedItems, listFeeds, markAllFeedItemsRead } from '@/db/repo';
import { AddFeedSheet } from '@/features/feeds/AddFeedSheet';
import { ArticleRow, LeadCard, ROW_GAP } from '@/features/feeds/ArticleCard';
import { FirstRun } from '@/features/feeds/FirstRun';
import { ReadingQueue } from '@/features/feed/ReadingQueue';
import { readingQueue } from '@/features/stash/model';
import { useFeed } from '@/features/stash/queries';
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
import { type ListPosition, listPosition } from '@/ui/List';
import { PullToRefresh } from '@/ui/PullToRefresh';
import { StatusScrim } from '@/ui/ScreenHeader';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';

type Show = 'new' | 'all' | 'saved';

/** Wait (ms) after focusing the tab before checking feeds. */
const REFRESH_DELAY = 1200;

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList<Row>);

/** Same fields → same object, so memoized rows skip re-rendering when the list re-queries. */
const rowSignature = (a: FeedItemWithFeed) =>
  `${a.title}|${a.readAt?.getTime() ?? ''}|${a.bookmarkId ?? ''}|${a.imageUrl ?? ''}|${a.chars}|${a.feedTitle}|${a.feedSiteUrl ?? ''}|${a.summary?.length ?? 0}|${a.publishedAt?.getTime() ?? ''}`;
type Row =
  | { k: 'lead'; key: string; a: FeedItemWithFeed }
  | { k: 'day'; key: string; title: string; count: number }
  | { k: 'item'; key: string; a: FeedItemWithFeed; pos: ListPosition };

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
    list.forEach((a, i) => rows.push({ k: 'item', key: a.id, a, pos: listPosition(i, list.length) }));
  }
  return rows;
}

/** RSS / Atom intake (design: Feeds): the latest from followed sites, one tap to keep. */
export default function FeedsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useChromeScroll(scrollY);
  const [feedId, setFeedId] = useState<string | null>(null);
  const [show, setShow] = useState<Show>('new');
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** First run stays up while following starters, until "Show my feed". */
  const [firstRun, setFirstRun] = useState<boolean | null>(null);

  const { data: feeds, loading: feedsLoading } = useDbQuery(listFeeds, [], []);
  // The segment switches at once; the list follows in a transition that never blocks taps.
  const listShow = useDeferredValue(show);
  // Continue reading: saved feed articles you have not finished.
  const { data: saved } = useFeed({});
  const queue = useMemo(
    () => readingQueue(saved.flatMap((f) => (f.kind === 'bookmark' && f.item.sourceApp === 'Feeds' ? [f.item] : []))),
    [saved],
  );
  // One query feeds all three tabs; switching filters in memory instead of re-querying.
  const stable = useRef(new Map<string, { sig: string; a: FeedItemWithFeed }>());
  const { data: all, loading } = useDbQuery(
    async () => {
      const fresh = await listFeedItems({ feedId: feedId ?? undefined });
      const next = new Map<string, { sig: string; a: FeedItemWithFeed }>();
      const out = fresh.map((a) => {
        const sig = rowSignature(a);
        const prev = stable.current.get(a.id);
        const keep = prev && prev.sig === sig ? prev : { sig, a };
        next.set(a.id, keep);
        return keep.a;
      });
      stable.current = next;
      return out;
    },
    [feedId],
    [] as FeedItemWithFeed[],
  );
  const items = useMemo(
    () => (listShow === 'new' ? all.filter((a) => !a.readAt) : listShow === 'saved' ? all.filter((a) => a.bookmarkId) : all.slice(0, 150)),
    [all, listShow],
  );

  // Decided once, when feeds first load (state adjusted during render, React's pattern).
  if (!feedsLoading && firstRun === null) setFirstRun(feeds.length === 0);

  const selected = feeds.find((f) => f.id === feedId) ?? null;
  const unread = selected ? selected.unread : feeds.reduce((n, f) => n + f.unread, 0);
  const rows = useMemo(() => toRows(items, feedId === null && listShow !== 'saved'), [items, feedId, listShow]);
  const showFirstRun = !feedsLoading && (feeds.length === 0 || firstRun === true);

  // Battery: only feeds older than the refresh interval are fetched, and only while here.
  // Started after the tab has settled: parsing runs on the JS thread and would delay the
  // first taps on older phones.
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => void refreshFeeds(), REFRESH_DELAY);
      return () => clearTimeout(t);
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

  const header = showFirstRun ? (
    <FirstRun onDone={() => setFirstRun(false)} />
  ) : (
    <>
      <SourceRail feeds={feeds} value={feedId} onChange={setFeedId} onAdd={() => setAdding(true)} />
      {feedId === null && <ReadingQueue entries={queue} />}
      <View style={styles.tabs}>
        <View style={{ flex: 1 }}>
          <ButtonGroup items={tabs} value={show} onChange={setShow} accessibilityLabel="Show" />
        </View>
        <IconButton icon="moreVert" accessibilityLabel="Feed options" onPress={() => setMenu(true)} />
      </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <PullToRefresh refreshing={refreshing} onRefresh={() => void pull()} scrollY={scrollY} offset={insets.top} enabled={!showFirstRun}>
      <AnimatedFlashList
        data={showFirstRun ? [] : rows}
        // FlashList 2 can ask about an index that just left the data (fast filter / source
        // taps shrink the list mid-layout): guard instead of crashing on undefined.
        keyExtractor={(r, i) => r?.key ?? `gone-${i}`}
        getItemType={(r) => r?.k ?? 'gone'}
        maintainVisibleContentPosition={{ disabled: true }}
        drawDistance={400}
        renderItem={({ item: r }) =>
          !r ? null : r.k === 'lead' ? (
            <View style={styles.lead}>
              <LeadCard a={r.a} />
            </View>
          ) : r.k === 'day' ? (
            <View style={styles.day}>
              <Text variant="titleLargeEmphasized" style={{ fontWeight: '700' }}>
                {r.title}
              </Text>
              <Text variant="titleMediumEmphasized" color="onSurfaceVariant">
                {String(r.count)}
              </Text>
            </View>
          ) : (
            <View style={styles.item}>
              <ArticleRow a={r.a} position={r.pos} />
            </View>
          )
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          showFirstRun || loading ? undefined : (
            <EmptyState
              title={listShow === 'saved' ? 'Nothing saved here' : listShow === 'new' ? 'All caught up' : 'No articles yet'}
              body={
                listShow === 'saved'
                  ? 'Tap the bookmark on any article to keep it in your stash.'
                  : listShow === 'new'
                    ? 'New articles will land here. Pull down to check now.'
                    : 'Pull down to fetch the latest articles.'
              }
            />
          )
        }
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: Layout.navBarClearance + insets.bottom }}
      />
      </PullToRefresh>

      <StatusScrim scrollY={scrollY} />
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
  item: { paddingHorizontal: Layout.gutter, paddingBottom: ROW_GAP },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: Layout.gutter, paddingRight: Layout.gutter - 8, paddingTop: 16, paddingBottom: 4 },
});
