import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { BookmarkWithTags } from '@/db/repo';
import { MarkdownView } from '@/features/notes/MarkdownView';
import { type CardKind, kindIcon, kindLabel } from '@/features/stash/model';
import { useAppTheme } from '@/theme/AppTheme';
import { STASH_PALETTE } from '@/theme/palette';
import { MONO_FAMILY } from '@/theme/type';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';

import { headLines, prefersMonospace } from './kinds';

/** Kinds that get an inline preview on the item page. */
export const hasFilePreview = (k: CardKind, b: Pick<BookmarkWithTags, 'thumbPath' | 'filePath' | 'content'>) =>
  (k === 'pdf' && !!b.thumbPath) || (k === 'image' && !!(b.thumbPath ?? b.filePath)) || ((k === 'markdown' || k === 'textfile') && !!b.content);

/** A PDF page stays paper-light in both themes. */
const PAPER = STASH_PALETTE.light;

/**
 * Item page preview (no file reads: everything comes from the row): the PDF's first-page
 * thumbnail with its page position, the image itself, or the first lines of a Markdown /
 * text file from the excerpt saved with it. Tapping it, or Open, goes to the right viewer.
 */
export function FilePreview({ b, kind, onOpen }: { b: BookmarkWithTags; kind: CardKind; onOpen: () => void }) {
  const { colors } = useAppTheme();
  const label = kind === 'pdf' ? 'PDF' : kind === 'image' ? 'Image' : (kindLabel(b) ?? 'File');
  const icon = kind === 'pdf' ? 'pictureAsPdf' : kind === 'image' ? 'image' : (kindIcon(b) ?? 'description');
  const where =
    kind === 'pdf' && b.pageCount
      ? b.lastPage && b.lastPage > 1
        ? `Page ${b.lastPage} of ${b.pageCount}`
        : `${b.pageCount} page${b.pageCount === 1 ? '' : 's'}`
      : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
      <View style={styles.head}>
        <Ico name={icon} size={20} color={colors.primary} />
        <Text variant="overline" color="primary" style={{ flex: 1 }}>
          {`Preview · ${label}`}
        </Text>
        {where && (
          <Text variant="labelMedium" color="onSurfaceVariant">
            {where}
          </Text>
        )}
      </View>

      <PressableSurface corner={20} pressedCorner={28} onPress={onOpen} accessibilityLabel={`Open ${b.title}`} style={styles.body}>
        {kind === 'pdf' && b.thumbPath ? (
          <View style={[styles.pdfStage, { backgroundColor: colors.surfaceContainerHighest }]}>
            <View style={[styles.page, { backgroundColor: PAPER.surfaceContainerLow }]}>
              <Image source={b.thumbPath} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={150} />
            </View>
          </View>
        ) : kind === 'image' ? (
          <View style={[styles.imageStage, { backgroundColor: colors.surfaceContainerHighest }]}>
            <Image source={b.thumbPath ?? b.filePath} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
          </View>
        ) : kind === 'markdown' ? (
          <View style={[styles.textStage, { backgroundColor: colors.surfaceContainerLow }]} pointerEvents="none">
            <MarkdownView markdown={headLines(b.content ?? '', 18, 400)} />
          </View>
        ) : (
          <View style={[styles.textStage, { backgroundColor: colors.surfaceContainerLow }]}>
            <Text
              variant={prefersMonospace(b) ? 'bodySmall' : 'bodyMedium'}
              numberOfLines={14}
              style={prefersMonospace(b) ? { fontFamily: MONO_FAMILY, lineHeight: 18 } : { fontWeight: '400' }}
            >
              {headLines(b.content ?? '', 14)}
            </Text>
          </View>
        )}
      </PressableSurface>

      <Button label={kind === 'image' ? 'View' : 'Open'} icon="openInNew" variant="tonal" onPress={onOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 16, borderRadius: 28, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  body: { overflow: 'hidden' },
  pdfStage: { height: 260, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 20 },
  page: { width: 180, height: 240, borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: 'hidden' },
  imageStage: { height: 280 },
  textStage: { maxHeight: 320, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 12 },
});
