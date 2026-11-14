import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { FeedItemWithFeed } from '@/db/repo';
import { hostSeed } from '@/features/stash/model';
import { relativeTime } from '@/lib/format';
import { haptic } from '@/motion/haptics';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones } from '@/theme/palette';
import { IconButton } from '@/ui/IconButton';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';
import { TransformCard } from '@/ui/TransformCard';

import { saveFeedItem } from './sync';

export async function saveArticle(id: string) {
  try {
    const { existed } = await saveFeedItem(id);
    haptic.save();
    showSnackbar(existed ? 'Already in your stash' : 'Saved to your stash');
  } catch {
    showSnackbar("Couldn't save the article");
  }
}

/** First letter of a feed's name on its tone, the feed's avatar when it has no icon. */
export function FeedGlyph({ title, seed, size }: { title: string; seed: string; size: number }) {
  const { dark } = useAppTheme();
  const tone = collectionTones(hostSeed(seed), dark);
  return (
    <View style={[styles.glyph, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: tone.container }]}>
      <Text variant="labelLarge" color={tone.onContainer} style={{ fontWeight: '800', fontSize: size * 0.45 }}>
        {(title.replace(/^the\s+/i, '').trim().charAt(0) || '•').toUpperCase()}
      </Text>
    </View>
  );
}

/** An article in the Feeds list: source and age, title, summary, thumbnail, one-tap save. */
export const ArticleCard = memo(function ArticleCard({ a }: { a: FeedItemWithFeed }) {
  const { colors } = useAppTheme();
  const read = !!a.readAt;
  const saved = !!a.bookmarkId;
  const when = a.publishedAt ?? a.createdAt;
  return (
    <TransformCard
      href={`/article/${a.id}`}
      color={read ? colors.surfaceContainerLow : colors.surfaceContainer}
      corner={24}
      accessibilityLabel={a.title}
      contentStyle={styles.card}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.meta}>
          {!read && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
          <Text variant="labelSmall" color={read ? 'onSurfaceVariant' : 'primary'} numberOfLines={1} style={{ flexShrink: 1, fontWeight: '700' }}>
            {a.feedTitle}
          </Text>
          <Text variant="labelSmall" color="onSurfaceVariant">
            {`· ${relativeTime(when).replace(' ago', '')}`}
          </Text>
        </View>
        <Text variant="titleMedium" numberOfLines={3} style={{ marginTop: 6, opacity: read ? 0.72 : 1 }}>
          {a.title}
        </Text>
        {a.summary ? (
          <Text variant="bodyMedium" color="onSurfaceVariant" numberOfLines={2} style={{ marginTop: 4 }}>
            {a.summary}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'center', gap: 8 }}>
        {a.imageUrl ? (
          <Image source={a.imageUrl} style={[styles.thumb, { backgroundColor: colors.surfaceContainerHighest }]} contentFit="cover" transition={150} recyclingKey={a.id} />
        ) : null}
        <IconButton
          icon={saved ? 'bookmarkFill' : 'bookmarkAdd'}
          accessibilityLabel={saved ? 'Saved to your stash' : 'Save to your stash'}
          variant={saved ? 'filled' : 'tonal'}
          size={40}
          onPress={saved ? undefined : () => void saveArticle(a.id)}
        />
      </View>
    </TransformCard>
  );
});

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, padding: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  thumb: { width: 72, height: 72, borderRadius: 16 },
  glyph: { alignItems: 'center', justifyContent: 'center' },
});
