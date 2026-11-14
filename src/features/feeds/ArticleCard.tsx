import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRecyclingState } from '@shopify/flash-list';
import { memo } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { type FeedItemWithFeed, markFeedItemRead, setFeedItemHidden } from '@/db/repo';
import { hostSeed } from '@/features/stash/model';
import { relativeTime } from '@/lib/format';
import { haptic } from '@/motion/haptics';
import { useSelection } from '@/motion/useSelection';
import { Shape } from '@/shapes/Shape';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones } from '@/theme/palette';
import { ActionSheet } from '@/ui/ActionSheet';
import { Ico } from '@/ui/Ico';
import { PressableSurface } from '@/ui/PressableSurface';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';
import { TransformCard } from '@/ui/TransformCard';

import { cleanTeaser, readMinutes } from './format';
import { SwipeRow } from './SwipeRow';
import { cornersStyle, type ListPosition, listCorners } from '@/ui/List';
import { saveFeedItem } from './sync';

/** Hides an article from the list, with Undo. */
export async function hideArticle(id: string) {
  await setFeedItemHidden(id, true);
  haptic.remove();
  showSnackbar('Article hidden', { label: 'Undo', onPress: () => void setFeedItemHidden(id, false) });
}

export async function saveArticle(id: string) {
  try {
    const { existed } = await saveFeedItem(id);
    haptic.save();
    showSnackbar(existed ? 'Already in your stash' : 'Saved to your stash');
  } catch {
    showSnackbar("Couldn't save the article");
  }
}

/** The tone a source is drawn in, stable per site. */
export function useSourceTone(a: { feedSiteUrl: string | null; url?: string | null; feedTitle: string }) {
  const { dark } = useAppTheme();
  return collectionTones(hostSeed(a.feedSiteUrl ?? a.url ?? a.feedTitle), dark);
}

/** First letter of a site's name, without a leading "The". */
export const sourceGlyph = (title: string) => (title.replace(/^the\s+/i, '').trim().charAt(0) || '•').toUpperCase();

/** "6h · 4 min": age and read time, kept whole while the source name truncates beside it. */
function when(a: FeedItemWithFeed) {
  const mins = readMinutes(a.chars);
  return [relativeTime(a.publishedAt ?? a.createdAt).replace(' ago', ''), mins ? `${mins} min` : null].filter(Boolean).join(' · ');
}

/**
 * Save toggle (design: Feeds): a round tonal button that becomes a filled square once saved.
 * Saving is one-way here; the saved state links to the stash item.
 */
function SaveButton({ a }: { a: FeedItemWithFeed }) {
  const { colors } = useAppTheme();
  const saved = !!a.bookmarkId;
  const sel = useSelection(saved);
  const style = useAnimatedStyle(() => ({
    borderRadius: 22 - 8 * sel.shape.get(),
    backgroundColor: interpolateColor(sel.color.get(), [0, 1], [colors.surfaceContainerHighest, colors.primary]),
  }));
  return (
    <PressableSurface
      kind="button"
      corner={22}
      onPress={saved ? undefined : () => void saveArticle(a.id)}
      accessibilityLabel={saved ? 'Saved to your stash' : 'Save to your stash'}
      accessibilityState={{ checked: saved }}
      style={styles.saveHit}
    >
      <Animated.View style={[styles.save, style]}>
        <Ico name={saved ? 'bookmarkFill' : 'bookmarkAdd'} size={20} color={saved ? colors.onPrimary : colors.onSurface} />
      </Animated.View>
    </PressableSurface>
  );
}

/** An article row: source tile or thumbnail, unread dot and meta, two-line title, save. */
export const ArticleRow = memo(function ArticleRow({ a, position = 'single' }: { a: FeedItemWithFeed; position?: ListPosition }) {
  const { colors } = useAppTheme();
  const tone = useSourceTone(a);
  const unread = !a.readAt;
  const saved = !!a.bookmarkId;
  // Recycled by the list: per-row state resets when the cell shows another article.
  const [menu, setMenu] = useRecyclingState(false, [a.id]);
  const corners = listCorners(position);
  return (
    <>
    <SwipeRow
      radius={corners}
      resetKey={a.id}
      start={
        saved
          ? undefined
          : { icon: 'bookmarkAdd', label: 'Save', bg: colors.primary, fg: colors.onPrimary, onCommit: () => void saveArticle(a.id) }
      }
      end={{
        icon: 'visibilityOff',
        label: 'Hide',
        bg: colors.secondaryContainer,
        fg: colors.onSecondaryContainer,
        removes: true,
        onCommit: () => void hideArticle(a.id),
      }}
    >
    <View style={[styles.row, cornersStyle(corners), { backgroundColor: unread ? colors.surfaceContainer : colors.surfaceContainerLow }]}>
      <TransformCard
        href={`/article/${a.id}`}
        color={unread ? colors.surfaceContainer : colors.surfaceContainerLow}
        corner={16}
        accessibilityLabel={a.title}
        onLongPress={() => setMenu(true)}
        style={{ flex: 1 }}
        contentStyle={styles.rowBody}
      >
        <View style={[styles.tile, { backgroundColor: tone.container, opacity: unread ? 1 : 0.7 }]}>
          {a.imageUrl ? (
            <Image source={a.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={a.id} transition={120} />
          ) : (
            <Text variant="titleLargeEmphasized" color={tone.onContainer} style={{ fontWeight: '700' }}>
              {sourceGlyph(a.feedTitle)}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.meta}>
            {unread && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
            <Text variant="labelMedium" color={unread ? 'primary' : 'onSurfaceVariant'} numberOfLines={1} style={{ fontWeight: '700', flexShrink: 1 }}>
              {a.feedTitle}
            </Text>
            <Text variant="labelMedium" color="onSurfaceVariant" numberOfLines={1} style={{ flexShrink: 0 }}>
              {`· ${when(a)}`}
            </Text>
          </View>
          <Text
            variant="titleMediumEmphasized"
            color={unread ? 'onSurface' : 'onSurfaceVariant'}
            numberOfLines={2}
            style={{ marginTop: 3, fontSize: 15, lineHeight: 20, fontWeight: unread ? '700' : '500' }}
          >
            {a.title}
          </Text>
        </View>
      </TransformCard>
      <SaveButton a={a} />
    </View>
    </SwipeRow>
    {menu && (
      <ActionSheet
        title={a.title}
        onDismiss={() => setMenu(false)}
        actions={[
          unread
            ? { label: 'Mark as read', icon: 'doneAll', onPress: () => void markFeedItemRead(a.id, true) }
            : { label: 'Mark as unread', icon: 'markEmailUnread', onPress: () => void markFeedItemRead(a.id, false) },
          saved
            ? { label: 'Open in your stash', icon: 'bookmarkFill', onPress: () => router.push({ pathname: '/item/[id]', params: { id: a.bookmarkId! } }) }
            : { label: 'Save to Stash', icon: 'bookmarkAdd', onPress: () => void saveArticle(a.id) },
          ...(a.url ? [{ label: 'Share', icon: 'share' as const, onPress: () => void Share.share({ message: `${a.title}\n${a.url}` }) }] : []),
          { label: 'Hide', icon: 'visibilityOff', onPress: () => void hideArticle(a.id) },
        ]}
      />
    )}
    </>
  );
});

/** The newest unread article as a large tonal card in its source's color (design: Top story). */
export const LeadCard = memo(function LeadCard({ a }: { a: FeedItemWithFeed }) {
  const tone = useSourceTone(a);
  return (
    <TransformCard href={`/article/${a.id}`} color={tone.container} corner={28} accessibilityLabel={`Top story: ${a.title}`}>
      <View style={[styles.leadArt, { backgroundColor: tone.accent }]}>
        {a.imageUrl ? (
          <Image source={a.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <View style={styles.leadDecor} pointerEvents="none">
            <Shape name="cookie12Sided" size={220} color={tone.container} />
          </View>
        )}
        <View style={[styles.chip, { backgroundColor: tone.container }]}>
          <Ico name="rssFeed" size={16} color={tone.onContainer} />
          <Text variant="labelMedium" color={tone.onContainer} style={{ fontWeight: '700' }}>
            Top story
          </Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 }}>
        <View style={styles.meta}>
          <View style={[styles.dot, { backgroundColor: tone.onContainer }]} />
          <Text variant="labelMedium" color={tone.onContainer} numberOfLines={1} style={{ fontWeight: '700', opacity: 0.85, flexShrink: 1 }}>
            {a.feedTitle}
          </Text>
          <Text variant="labelMedium" color={tone.onContainer} numberOfLines={1} style={{ opacity: 0.85, flexShrink: 0 }}>
            {`· ${when(a)}`}
          </Text>
        </View>
        <Text variant="headlineSmallEmphasized" color={tone.onContainer} numberOfLines={3} style={{ marginTop: 8, fontWeight: '700' }}>
          {a.title}
        </Text>
        {cleanTeaser(a.summary) ? (
          <Text variant="bodyMedium" color={tone.onContainer} numberOfLines={2} style={{ marginTop: 6, opacity: 0.8 }}>
            {cleanTeaser(a.summary)}
          </Text>
        ) : null}
      </View>
    </TransformCard>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 10, overflow: 'hidden' },
  rowBody: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  tile: { width: 56, height: 56, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  saveHit: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  save: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  leadArt: { height: 148, overflow: 'hidden', justifyContent: 'flex-end' },
  leadDecor: { position: 'absolute', right: -50, top: -60 },
  chip: { position: 'absolute', left: 20, bottom: 16, height: 28, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8, paddingRight: 12 },
});
