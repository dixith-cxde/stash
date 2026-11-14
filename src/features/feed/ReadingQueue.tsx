import { Image } from 'expo-image';
import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { BookmarkWithTags } from '@/db/repo';
import { cardKind, hostSeed, type QueueEntry, sourceLabel } from '@/features/stash/model';
import { openItem } from '@/lib/nav';
import { useAppTheme } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';
import { collectionTones } from '@/theme/palette';
import { Ico } from '@/ui/Ico';
import { PressableSurface } from '@/ui/PressableSurface';
import { ProgressBar } from '@/ui/ProgressBar';
import { Text } from '@/ui/Text';

const CARD_W = 248;

/**
 * Home's "Continue reading" row: part-read PDFs with their progress, then unread articles
 * and documents. A tap opens the content directly (reader, PDF, file viewer).
 */
export const ReadingQueue = memo(function ReadingQueue({ entries }: { entries: QueueEntry[] }) {
  if (!entries.length) return null;
  return (
    <View style={{ paddingTop: 20 }}>
      <Text variant="titleMediumEmphasized" style={styles.title} accessibilityRole="header">
        Continue reading
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Layout.gutter, gap: 8 }}
        accessibilityRole="list"
        accessibilityLabel="Continue reading"
      >
        {entries.map((e) => (
          <QueueCard key={e.item.id} item={e.item} progress={e.progress} />
        ))}
      </ScrollView>
    </View>
  );
});

function QueueCard({ item, progress }: { item: BookmarkWithTags; progress: number | null }) {
  const { colors, dark } = useAppTheme();
  const tone = collectionTones(hostSeed(item.url ?? item.title), dark);
  const pdf = cardKind(item) === 'pdf';
  const art = item.thumbPath ?? item.imageUrl;
  const detail =
    progress != null && item.lastPage && item.pageCount ? `Page ${item.lastPage} of ${item.pageCount}` : pdf ? 'PDF · not started' : `${sourceLabel(item)} · unread`;
  return (
    <PressableSurface
      kind="card"
      corner={20}
      onPress={() => void openItem(item)}
      accessibilityLabel={`${item.title}. ${detail}`}
      style={[styles.card, { backgroundColor: colors.surfaceContainer }]}
    >
      <View style={[styles.thumb, { backgroundColor: tone.container }]}>
        {art ? (
          <Image source={art} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={150} />
        ) : (
          <Ico name={pdf ? 'pictureAsPdf' : 'menuBook'} size={22} color={tone.onContainer} />
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="labelLargeEmphasized" numberOfLines={2}>
          {item.title || 'Untitled'}
        </Text>
        <Text variant="labelMedium" color="onSurfaceVariant" numberOfLines={1}>
          {detail}
        </Text>
        {progress != null && <ProgressBar value={progress} wavy />}
      </View>
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: Layout.gutter + 4, paddingBottom: 10, fontWeight: '700' },
  card: { width: CARD_W, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  thumb: { width: 52, height: 64, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
