import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { deleteFolder, getFolder, queryHighlights } from '@/db/repo';
import type { Folder, SmartFilter } from '@/db/schema';
import { HighlightCard, ItemRow, ItemTile } from '@/features/collections/ItemViews';
import { type FeedFilter, folderIcon, folderSeed, matchesFilter, TYPE_COUNT_LABEL } from '@/features/stash/model';
import { useFeed } from '@/features/stash/queries';
import { haptic } from '@/motion/haptics';
import { enterRise, exitShrink, reflow } from '@/motion/layout';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { Shape } from '@/shapes/Shape';
import { useAppTheme } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { collectionTones } from '@/theme/palette';
import { Layout } from '@/theme/tokens';
import { ActionSheet } from '@/ui/ActionSheet';
import { BackPill, HeroIconButton } from '@/ui/BackPill';
import { Button } from '@/ui/Button';
import { ButtonGroup } from '@/ui/ButtonGroup';
import { EmptyState } from '@/ui/EmptyState';
import { Ico } from '@/ui/Ico';
import { IconButton } from '@/ui/IconButton';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';

type Scope = {
  title: string;
  seed: string;
  icon: IconName;
  filter: SmartFilter;
  folder?: Folder;
  highlightsOnly?: boolean;
};

/** Smart views live at /collection/all|pdfs|notes|highlights; anything else is a folder id. */
const SMART: Record<string, Omit<Scope, 'folder'>> = {
  all: { title: 'All items', seed: '#6750A4', icon: 'gridView', filter: {} },
  pdfs: { title: 'PDFs', seed: '#7D5260', icon: 'pictureAsPdf', filter: { types: ['pdf'] } },
  notes: { title: 'Notes', seed: '#625B71', icon: 'markdown', filter: { types: ['text'] } },
  highlights: { title: 'Highlights', seed: '#776500', icon: 'inkHighlighter', filter: {}, highlightsOnly: true },
};

const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'links', label: 'Links' },
  { key: 'pdfs', label: 'PDFs' },
  { key: 'notes', label: 'Notes' },
];

export default function CollectionScreen() {
  const { origin } = useLocalSearchParams<{ origin?: string }>();
  return (
    <TransitionScreen kind="container" origin={origin}>
      <CollectionBody />
    </TransitionScreen>
  );
}

function useScope(id: string) {
  const { data: folder, loading } = useDbQuery(() => (SMART[id] ? Promise.resolve(undefined) : getFolder(id)), [id], undefined);
  if (SMART[id]) return { scope: SMART[id] as Scope, loading: false };
  if (!folder) return { scope: null, loading };
  return {
    scope: { title: folder.name, seed: folderSeed(folder), icon: folderIcon(folder), filter: { folderId: folder.id }, folder },
    loading,
  };
}

function CollectionBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const { scope } = useScope(id);
  const tone = collectionTones(scope?.seed ?? '#6750A4', dark);
  const { data: feed } = useFeed(scope?.filter ?? { folderId: '__none__' }, { highlights: 'none' });
  const { data: hls } = useDbQuery(() => (scope?.highlightsOnly ? queryHighlights() : Promise.resolve([])), [scope?.highlightsOnly], []);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [grid, setGrid] = useState(false);
  const [menu, setMenu] = useState(false);

  const items = feed.flatMap((f) => (f.kind === 'bookmark' && matchesFilter(f, filter) ? [f.item] : []));
  const all = feed.flatMap((f) => (f.kind === 'bookmark' ? [f.item] : []));
  const counts = all.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.type]: (acc[b.type] ?? 0) + 1 }), {});
  const summary = scope?.highlightsOnly
    ? `${hls.length} highlights`
    : [
        `${all.length} item${all.length === 1 ? '' : 's'}`,
        ...(['pdf', 'text'] as const).filter((t) => counts[t]).map((t) => `${counts[t]} ${TYPE_COUNT_LABEL[t][counts[t] === 1 ? 0 : 1]}`),
      ].join(' · ');

  // Hero decoration drifts at half the scroll speed (parallax).
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => scrollY.set(e.contentOffset.y));
  const decor = useAnimatedStyle(() => ({ transform: [{ translateY: scrollY.get() * 0.5 }, { rotate: `${scrollY.get() * 0.08}deg` }] }));

  const share = () => {
    const text = [scope?.title, ...all.map((b) => (b.url ? `${b.title}\n${b.url}` : b.title))].join('\n\n');
    void Share.share({ message: text, title: scope?.title });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 48 + insets.bottom }}>
        <View style={[styles.hero, { backgroundColor: tone.container, paddingTop: insets.top }]}>
          <Animated.View style={[styles.decor, decor]} pointerEvents="none">
            <Shape name={scope?.folder ? 'cookie9Sided' : 'clover4Leaf'} size={300} color={tone.accent} />
          </Animated.View>
          <View style={styles.heroBar}>
            <BackPill label="Back" onPress={close} onHero={tone.onContainer} />
            {scope?.folder && <HeroIconButton icon="moreVert" label="Collection options" onPress={() => setMenu(true)} onHero={tone.onContainer} />}
          </View>
          <View style={styles.heroText}>
            <View style={[styles.heroIcon, { backgroundColor: tone.onContainer }]}>
              <Ico name={scope?.icon ?? 'folder'} size={26} color={tone.container} />
            </View>
            <Text variant="displaySmall" color={tone.onContainer} numberOfLines={2} style={{ marginTop: 14 }} accessibilityRole="header">
              {scope?.title ?? ''}
            </Text>
            <Text variant="labelMedium" color={tone.onContainer} style={{ marginTop: 4 }}>
              {summary}
            </Text>
          </View>
        </View>

        {!scope?.highlightsOnly && (
          <>
            <View style={styles.actions}>
              <Button
                label="Add"
                icon="add"
                height={52}
                corners={[26, 10, 10, 26]}
                grow
                onPress={() => router.push({ pathname: '/capture', params: scope?.folder ? { folderId: scope.folder.id } : {} })}
              />
              <Button
                label="New note"
                icon="edit"
                variant="tonal"
                height={52}
                corners={[10, 10, 10, 10]}
                grow
                onPress={() => router.push({ pathname: '/note/[id]/edit', params: { id: 'new', folderId: scope?.folder?.id ?? '' } })}
              />
              <IconButton icon="share" accessibilityLabel="Share collection" variant="tonal" size={52} corners={[10, 26, 26, 10]} onPress={share} />
            </View>

            <View style={styles.filterRow}>
              <View style={{ flex: 1 }}>
                <ButtonGroup items={FILTERS} value={filter} onChange={setFilter} accessibilityLabel="Filter by type" />
              </View>
              <IconButton
                icon={grid ? 'viewAgenda' : 'gridView'}
                accessibilityLabel={grid ? 'Show as list' : 'Show as grid'}
                variant="tonal"
                size={40}
                onPress={() => setGrid((g) => !g)}
              />
            </View>
          </>
        )}

        <View style={{ paddingHorizontal: Layout.gutter, paddingTop: scope?.highlightsOnly ? 16 : 0 }}>
          {scope?.highlightsOnly ? (
            hls.length ? (
              <View style={{ gap: 8 }}>
                {hls.map((h) => (
                  <Animated.View key={h.id} layout={reflow} entering={enterRise} exiting={exitShrink}>
                    <HighlightCard h={h} showSource />
                  </Animated.View>
                ))}
              </View>
            ) : (
              <EmptyState shape="softBurst" title="No highlights yet" body="Select text in any app and choose “Save to Stash”." />
            )
          ) : items.length === 0 ? (
            <EmptyState shape="cookie4Sided" title="Nothing here yet" body="Tap Add to save a link, note or file into this collection." />
          ) : grid ? (
            <View style={{ gap: Layout.gridGap }}>
              {pairs(items).map((row) => (
                <Animated.View key={row.map((b) => b.id).join('|')} layout={reflow} entering={enterRise} exiting={exitShrink} style={{ flexDirection: 'row', gap: Layout.gridGap }}>
                  {row.map((b) => (
                    <ItemTile key={b.id} b={b} />
                  ))}
                  {row.length === 1 && <View style={{ flex: 1 }} />}
                </Animated.View>
              ))}
            </View>
          ) : (
            <View style={{ gap: 4 }}>
              {items.map((b) => (
                <Animated.View key={b.id} layout={reflow} entering={enterRise} exiting={exitShrink}>
                  <ItemRow b={b} />
                </Animated.View>
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {menu && scope?.folder && (
        <ActionSheet
          title={scope.title}
          onDismiss={() => setMenu(false)}
          actions={[
            {
              label: 'Delete collection',
              icon: 'delete',
              destructive: true,
              onPress: () => {
                const f = scope.folder!;
                void deleteFolder(f.id).then(() => {
                  haptic.remove();
                  showSnackbar(`Deleted ${f.name}. Its items stay in your stash.`);
                  close();
                });
              },
            },
          ]}
        />
      )}
    </View>
  );
}

function pairs<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += 2) out.push(xs.slice(i, i + 2));
  return out;
}

const styles = StyleSheet.create({
  hero: { minHeight: 268, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden' },
  decor: { position: 'absolute', right: -90, top: -60 },
  heroBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 12 },
  heroText: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 4, paddingHorizontal: Layout.gutter, paddingTop: 16 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Layout.gutter, paddingTop: 20, paddingBottom: 12 },
});
