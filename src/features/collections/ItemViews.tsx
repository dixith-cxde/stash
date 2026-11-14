import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { BookmarkWithTags, HighlightWithTags } from '@/db/repo';
import { cardKind, formatDuration, glyphFor, hostSeed, kindIcon, kindLabel, sourceLabel } from '@/features/stash/model';
import { relativeTime } from '@/lib/format';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones, HIGHLIGHT_TONES } from '@/theme/palette';
import { Ico } from '@/ui/Ico';
import { ProgressBar } from '@/ui/ProgressBar';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';
import type { Corners4 } from '@/motion/useSelection';
import { TransformCard } from '@/ui/TransformCard';

/** Route for a bookmark: notes open the note reader, everything else the item page. */
export const itemHref = (b: Pick<BookmarkWithTags, 'id' | 'type' | 'url'> & Partial<Pick<BookmarkWithTags, 'filePath' | 'mimeType' | 'title'>>) =>
  (cardKind(b) === 'note' ? `/note/${b.id}` : `/item/${b.id}`) as `/item/${string}`;

function meta(b: BookmarkWithTags): string {
  const k = cardKind(b);
  if (k === 'pdf') {
    if (b.pageCount && b.lastPage && b.lastPage > 1) return `PDF · page ${b.lastPage} of ${b.pageCount}`;
    return b.pageCount ? `PDF · ${b.pageCount} pp${b.readAt ? '' : ' · unread'}` : 'PDF';
  }
  if (k === 'video') return `YouTube${b.durationSec ? ` · ${formatDuration(b.durationSec)}` : ''}`;
  if (k === 'note') return `Note · edited ${relativeTime(b.updatedAt)}`;
  const when = relativeTime(b.createdAt).replace(' ago', '');
  // Links that are apps / repos / docs say so; files say their type ("Markdown", ".csv").
  const label = kindLabel(b);
  if (label && k === 'link') return `${label} · ${when}`;
  return `${sourceLabel(b)} · ${when}`;
}

function useTile(b: BookmarkWithTags) {
  const { colors, dark } = useAppTheme();
  const k = cardKind(b);
  if (k === 'pdf') return { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer };
  if (k === 'note') return { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer };
  const t = collectionTones(hostSeed(b.url ?? b.title), dark);
  return { bg: t.container, fg: t.onContainer };
}

function Art({ b, size }: { b: BookmarkWithTags; size: number }) {
  const tile = useTile(b);
  const img = b.imageUrl ?? b.thumbPath;
  const glyph = glyphFor(b);
  const k = cardKind(b);
  // Generic files keep their extension glyph ("ZIP"); apps, repos, docs and text files get icons.
  const icon = k === 'file' ? null : kindIcon(b);
  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: tile.bg }]}>
      {img ? (
        <Image source={img} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : k === 'video' ? (
        <Ico name="playArrowFill" size={size * 0.4} color={tile.fg} />
      ) : icon ? (
        <Ico name={icon} size={size * 0.42} color={tile.fg} />
      ) : (
        <Text variant="labelLargeEmphasized" color={tile.fg} style={{ fontWeight: '700', fontSize: glyph.length > 1 ? size * 0.23 : size * 0.43 }}>
          {glyph}
        </Text>
      )}
    </View>
  );
}

/** Collection list row (design: 56dp art tile, meta, title, optional PDF progress). */
export function ItemRow({ b, corners }: { b: BookmarkWithTags; corners?: Corners4 }) {
  const { colors } = useAppTheme();
  const progress = b.pageCount && b.lastPage && b.lastPage > 1 ? b.lastPage / b.pageCount : 0;
  return (
    <TransformCard href={itemHref(b)} color={colors.surfaceContainer} corner={20} corners={corners} accessibilityLabel={b.title} contentStyle={styles.row}>
      <View style={styles.rowArt}>
        <Art b={b} size={56} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="labelMedium" color="onSurfaceVariant" numberOfLines={1}>
          {meta(b)}
        </Text>
        <Text variant="labelLargeEmphasized" numberOfLines={1} style={{ marginTop: 2 }}>
          {b.title || 'Untitled'}
        </Text>
        {progress > 0 && (
          <View style={{ marginTop: 8 }}>
            <ProgressBar value={progress} wavy />
          </View>
        )}
      </View>
    </TransformCard>
  );
}

/** Collection grid tile (design: 96dp cover, meta, two-line title). */
export function ItemTile({ b }: { b: BookmarkWithTags }) {
  const { colors } = useAppTheme();
  return (
    <TransformCard href={itemHref(b)} color={colors.surfaceContainer} corner={24} accessibilityLabel={b.title} style={{ flex: 1 }}>
      <View style={{ height: 96 }}>
        <Art b={b} size={96} />
      </View>
      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14 }}>
        <Text variant="labelMedium" color="onSurfaceVariant" numberOfLines={1} style={{ fontSize: 11 }}>
          {meta(b)}
        </Text>
        <Text variant="labelLarge" numberOfLines={2} style={{ fontWeight: '700', marginTop: 4, minHeight: 36 }}>
          {b.title || 'Untitled'}
        </Text>
      </View>
    </TransformCard>
  );
}

/** A highlight as a tinted quote card (design: Item detail highlights). */
/**
 * A highlight as a tinted quote card. `unit` names its position ("Page 4" in a PDF). With
 * `onPress` it is tappable (jump to where it was taken).
 */
export function HighlightCard({
  h,
  showSource,
  unit = 'Paragraph',
  onPress,
}: {
  h: HighlightWithTags;
  showSource?: boolean;
  unit?: 'Page' | 'Paragraph';
  onPress?: () => void;
}) {
  const { dark } = useAppTheme();
  const tone = HIGHLIGHT_TONES[h.color][dark ? 'dark' : 'light'];
  const where = [h.page ? `${unit} ${h.page}` : null, h.note ? `your note: ${h.note}` : null, showSource ? h.bookmarkTitle ?? h.sourceTitle : null]
    .filter(Boolean)
    .join(' · ');
  const body = (
    <>
      <Text variant="bodyLarge" color={tone.fg} style={{ fontWeight: '600', lineHeight: 23}}>
        {`“${h.text}”`}
      </Text>
      {where ? (
        <Text variant="labelMedium" color={tone.fg} style={{ marginTop: 8, opacity: 0.8 }}>
          {onPress ? `${where} · Go to page` : where}
        </Text>
      ) : null}
    </>
  );
  return onPress ? (
    <PressableSurface kind="card" corner={24} onPress={onPress} accessibilityLabel={`Highlight: ${h.text}. ${where}. Go to page`} style={{ padding: 16, backgroundColor: tone.bg }}>
      {body}
    </PressableSurface>
  ) : (
    <View style={{ borderRadius: 24, padding: 16, backgroundColor: tone.bg }} accessible accessibilityLabel={`Highlight: ${h.text}`}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  rowArt: { width: 56, height: 56, borderRadius: 16, overflow: 'hidden' },
});
