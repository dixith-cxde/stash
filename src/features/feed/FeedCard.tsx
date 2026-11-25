import { Image } from 'expo-image';
import { memo, useCallback, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import type { BookmarkWithTags, HighlightWithTags } from '@/db/repo';
import { useSelectable } from '@/features/select/store';
import {
  cardKind,
  DECOR_SHAPES,
  type FeedItem,
  filePreview,
  formatDuration,
  glyphFor,
  hostSeed,
  kindIcon,
  kindLabel,
  sourceLabel,
  tasksIn,
} from '@/features/stash/model';
import { relativeTime } from '@/lib/format';
import { Shape } from '@/shapes/Shape';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones, STASH_PALETTE } from '@/theme/palette';
import { MONO_FAMILY } from '@/theme/type';
import { TagPill } from '@/ui/Chip';
import { Ico } from '@/ui/Ico';
import { ActionSheet, type SheetAction } from '@/ui/ActionSheet';
import { PressableSurface } from '@/ui/PressableSurface';
import { ProgressBar } from '@/ui/ProgressBar';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';
import { TransformCard } from '@/ui/TransformCard';

import { copiedMessage, type CopyTargets, copyTargets } from './copy';

const R = 28;

/** One card of the Home / Collection masonry, by content type (design: Home artboard). */
export const FeedCard = memo(function FeedCard({ f }: { f: FeedItem }) {
  // Long-press menu: one boolean per card; the sheet itself mounts only while open.
  const [menu, setMenu] = useState(false);
  const openMenu = useCallback(() => setMenu(true), []);
  const closeMenu = useCallback(() => setMenu(false), []);
  return (
    <>
      <CardFor f={f} onLongPress={openMenu} />
      {menu && <CardMenu copy={copyTargets(f)} onDismiss={closeMenu} />}
    </>
  );
});

/** Props every card kind takes. */
type CardProps = { onLongPress: () => void };

function CardFor({ f, onLongPress }: { f: FeedItem } & CardProps) {
  if (f.kind === 'highlight') return <QuoteCard h={f.highlight} copy={copyTargets(f)} onLongPress={onLongPress} />;
  const b = f.item;
  switch (cardKind(b)) {
    case 'pdf':
      return <PdfCard b={b} highlights={f.highlightCount} onLongPress={onLongPress} />;
    case 'note':
      return <NoteCard b={b} copy={copyTargets(f)} onLongPress={onLongPress} />;
    case 'video':
      return <VideoCard b={b} copy={copyTargets(f)} onLongPress={onLongPress} />;
    case 'image':
      return <ImageCard b={b} onLongPress={onLongPress} />;
    case 'file':
      return <FileCard b={b} onLongPress={onLongPress} />;
    case 'markdown':
    case 'textfile':
      return <TextFileCard b={b} copy={copyTargets(f)} onLongPress={onLongPress} />;
    default:
      return <LinkCard b={b} copy={copyTargets(f)} onLongPress={onLongPress} />;
  }
}

/** Copies, then confirms with a snackbar ("Link copied", "Note copied"…). No haptic: copy isn't save/cancel/delete. */
async function copyOut(c: CopyTargets, what: 'link' | 'text') {
  const value = what === 'link' ? c.link : c.text;
  if (!value) return;
  const Clipboard = await import('expo-clipboard');
  await Clipboard.setStringAsync(value);
  showSnackbar(copiedMessage(c, what));
}

const copyLabel = (c: CopyTargets) => `Copy ${(c.noun ?? 'Text').toLowerCase()}`;

/** Long-press menu: copy the link and/or the text, share. */
function CardMenu({ copy: c, onDismiss }: { copy: CopyTargets; onDismiss: () => void }) {
  const actions: SheetAction[] = [];
  if (c.link) actions.push({ label: 'Copy link', icon: 'link', onPress: () => void copyOut(c, 'link') });
  if (c.text) actions.push({ label: copyLabel(c), icon: 'contentCopy', onPress: () => void copyOut(c, 'text') });
  const message = c.text ? [c.text, c.link].filter(Boolean).join('\n\n') : [c.title, c.link].filter(Boolean).join('\n');
  actions.push({ label: 'Share', icon: 'share', onPress: () => void Share.share({ message, title: c.title }) });
  return <ActionSheet title={c.title} actions={actions} onDismiss={onDismiss} />;
}

/**
 * Quiet copy button for a card's top or meta row: 32dp target, no fill, 18dp glyph. It blocks
 * the card's own press, so a tap copies without opening the card. Negative margins keep the
 * row's height and the card's edge padding as they were.
 */
function CopyButton({ copy: c, color, edge = true }: { copy: CopyTargets; color: string; edge?: boolean }) {
  const what = c.primary;
  // While selecting, the whole card is one toggle target.
  const select = useSelectable();
  if (!what || select?.active) return null;
  return (
    <PressableSurface
      kind="button"
      corner={16}
      blockParent
      onPress={() => void copyOut(c, what)}
      accessibilityLabel={what === 'link' ? 'Copy link' : copyLabel(c)}
      style={[styles.copy, edge && styles.copyEdge]}
    >
      <Ico name="contentCopy" size={18} color={color} />
    </PressableSurface>
  );
}

const ago = (d: Date) => relativeTime(d).replace(' ago', '');

function Meta({ children, color = 'onSurfaceVariant' }: { children: string; color?: string }) {
  return (
    <Text variant="labelMedium" color={color} numberOfLines={1}>
      {children}
    </Text>
  );
}

function LinkCard({ b, copy, onLongPress }: { b: BookmarkWithTags; copy: CopyTargets } & CardProps) {
  const { colors, dark } = useAppTheme();
  const tone = collectionTones(hostSeed(b.url), dark);
  const site = b.siteName || sourceLabel(b);
  return (
    <TransformCard
      href={`/item/${b.id}`}
      color={colors.surfaceContainer}
      corner={R}
      accessibilityLabel={b.title}
      onLongPress={onLongPress}
    >
      <View style={[styles.linkCover, { backgroundColor: tone.container }]}>
        {b.imageUrl ? (
          <Image source={b.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <>
            <Shape name={DECOR_SHAPES[0]} size={150} color={tone.accent} style={{ position: 'absolute', left: -40, top: -50 }} />
            <Text variant="headlineSmallEmphasized" color={tone.onContainer} numberOfLines={1} style={styles.siteMark}>
              {site}
            </Text>
          </>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <View style={[styles.favicon, { backgroundColor: tone.onContainer }]}>
            {b.favicon ? <Image source={b.favicon} style={StyleSheet.absoluteFill} /> : null}
          </View>
          <View style={styles.flex}>
            <Meta>{`${sourceLabel(b)} · ${ago(b.createdAt)}`}</Meta>
          </View>
          <CopyButton copy={copy} color={colors.onSurfaceVariant} />
        </View>
        <Text variant="titleMediumEmphasized" numberOfLines={3} style={{ marginTop: 6 }}>
          {b.title}
        </Text>
        <LinkKindRow b={b} />
        {b.tags[0] && (
          <View style={{ marginTop: 10 }}>
            <TagPill label={`#${b.tags[0].name}`} small />
          </View>
        )}
      </View>
    </TransformCard>
  );
}

/** "App · Play Store", "Repo · owner/name", "Docs · MDN" under a link's title (plain links: nothing). */
function LinkKindRow({ b }: { b: BookmarkWithTags }) {
  const { colors } = useAppTheme();
  const label = kindLabel(b);
  if (!label) return null;
  const icon = kindIcon(b);
  return (
    <View style={[styles.metaRow, { marginTop: 8 }]}>
      {icon && <Ico name={icon} size={16} color={colors.primary} />}
      <Meta color="primary">{label}</Meta>
    </View>
  );
}

function VideoCard({ b, copy, onLongPress }: { b: BookmarkWithTags; copy: CopyTargets } & CardProps) {
  const { colors } = useAppTheme();
  const duration = formatDuration(b.durationSec);
  return (
    <TransformCard
      href={`/item/${b.id}`}
      color={colors.surfaceContainer}
      corner={R}
      accessibilityLabel={b.title}
      onLongPress={onLongPress}
    >
      <View style={[styles.videoCover, { backgroundColor: colors.tertiaryContainer }]}>
        {b.imageUrl ? <Image source={b.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
        <View style={[styles.play, { backgroundColor: colors.tertiary }]}>
          <Ico name="playArrowFill" size={28} color={colors.onTertiary} />
        </View>
        {duration && (
          <View style={[styles.badge, { backgroundColor: colors.surface, right: 10, bottom: 8 }]}>
            <Text variant="labelMedium" style={{ fontWeight: '700' }}>
              {duration}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <View style={styles.flex}>
            <Meta>{`YouTube · ${ago(b.createdAt)}`}</Meta>
          </View>
          <CopyButton copy={copy} color={colors.onSurfaceVariant} />
        </View>
        <Text variant="titleMediumEmphasized" numberOfLines={3} style={{ marginTop: 6 }}>
          {b.title}
        </Text>
      </View>
    </TransformCard>
  );
}

function PdfCard({ b, highlights, onLongPress }: { b: BookmarkWithTags; highlights: number } & CardProps) {
  const { colors } = useAppTheme();
  const progress = b.pageCount && b.lastPage ? b.lastPage / b.pageCount : 0;
  const pages = b.pageCount ? `${b.pageCount} pp` : 'PDF';
  const where =
    b.pageCount && b.lastPage && b.lastPage > 1 ? `Page ${b.lastPage} of ${b.pageCount}` : b.readAt ? 'Opened' : 'Unread';
  return (
    <TransformCard
      href={`/item/${b.id}`}
      color={colors.surfaceContainer}
      corner={R}
      accessibilityLabel={b.title}
      onLongPress={onLongPress}
    >
      <View style={[styles.pdfCover, { backgroundColor: colors.surfaceContainerHighest }]}>
        <View style={[styles.page, { backgroundColor: PAPER.surfaceContainerLow }]}>
          {b.thumbPath ? (
            <Image source={b.thumbPath} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
          ) : (
            <PageSketch />
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: colors.tertiaryContainer, top: 10, right: 10 }]}>
          <Text variant="labelMedium" color="onTertiaryContainer" style={{ fontWeight: '700' }}>
            {`PDF · ${pages}`}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text variant="titleMediumEmphasized" numberOfLines={3}>
          {b.title}
        </Text>
        <View style={{ marginTop: 6 }}>
          <Meta>{highlights ? `${where} · ${highlights} highlight${highlights === 1 ? '' : 's'}` : where}</Meta>
        </View>
        {progress > 0 && (
          <View style={{ marginTop: 10 }}>
            <ProgressBar value={progress} wavy />
          </View>
        )}
      </View>
    </TransformCard>
  );
}

/** Paper and ink stay light in both themes: it is a page. */
const PAPER = STASH_PALETTE.light;

/** Placeholder page lines until the PDF thumbnail exists. */
function PageSketch() {
  return (
    <View style={{ padding: 12, gap: 6 }}>
      <View style={{ height: 6, width: '80%', borderRadius: 3, backgroundColor: PAPER.onSurface }} />
      <View style={{ height: 4, width: '60%', borderRadius: 2, backgroundColor: PAPER.outline }} />
      {[100, 96, 90, 94].map((w) => (
        <View key={w} style={{ height: 3, width: `${w}%`, borderRadius: 2, backgroundColor: PAPER.outlineVariant, marginTop: 4 }} />
      ))}
    </View>
  );
}

function NoteCard({ b, copy, onLongPress }: { b: BookmarkWithTags; copy: CopyTargets } & CardProps) {
  const { colors } = useAppTheme();
  const tasks = tasksIn(b.content ?? '');
  const done = tasks.filter((t) => t.done).length;
  const preview = tasks.length ? null : (b.content ?? '').replace(/[#>*_`]/g, '').trim().split('\n').slice(0, 3).join(' ');
  return (
    <TransformCard
      href={`/note/${b.id}`}
      color={colors.secondaryContainer}
      corner={R}
      accessibilityLabel={`Note: ${b.title}`}
      contentStyle={{ padding: 16 }}
      onLongPress={onLongPress}
    >
      <View style={styles.noteTop}>
        <Text variant="titleSmallEmphasized" color="onSecondaryContainer" style={{ letterSpacing: 0.6 }}>
          Note
        </Text>
        <View style={styles.topEnd}>
          <CopyButton copy={copy} color={colors.onSecondaryContainer} edge={false} />
          <Ico name="markdown" size={20} color={colors.onSecondaryContainer} />
        </View>
      </View>
      <Text variant="titleMediumEmphasized" color="onSecondaryContainer" numberOfLines={2} style={{ marginTop: 6 }}>
        {b.title || 'Untitled note'}
      </Text>
      {tasks.length > 0 ? (
        <View style={{ gap: 6, marginTop: 10 }}>
          {tasks.slice(0, 3).map((t) => (
            <View key={t.line} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View
                style={[
                  styles.miniBox,
                  t.done
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { borderColor: colors.onSurfaceVariant },
                ]}
              >
                {t.done && <Ico name="check" size={12} color={colors.onPrimary} />}
              </View>
              <Text
                variant="bodySmall"
                color="onSecondaryContainer"
                numberOfLines={1}
                style={[{ flex: 1, fontSize: 14 }, t.done && { textDecorationLine: 'line-through', opacity: 0.75 }]}
              >
                {t.text}
              </Text>
            </View>
          ))}
        </View>
      ) : preview ? (
        <Text variant="bodySmall" color="onSecondaryContainer" numberOfLines={4} style={{ marginTop: 8, opacity: 0.85 }}>
          {preview}
        </Text>
      ) : null}
      <Text variant="labelMedium" color="onSurfaceVariant" style={{ marginTop: 12 }}>
        {tasks.length ? `${done} of ${tasks.length} done · ${ago(b.updatedAt)} ago` : `Edited ${ago(b.updatedAt)} ago`}
      </Text>
    </TransformCard>
  );
}

function QuoteCard({ h, copy, onLongPress }: { h: HighlightWithTags; copy: CopyTargets } & CardProps) {
  const { colors } = useAppTheme();
  const source = h.sourceTitle || h.bookmarkTitle || h.sourceApp || 'Highlight';
  return (
    <TransformCard
      href={h.bookmarkId ? `/item/${h.bookmarkId}` : `/highlight/${h.id}`}
      color={colors.tertiaryContainer}
      corner={R}
      accessibilityLabel={`Highlight: ${h.text}`}
      contentStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16 }}
      onLongPress={onLongPress}
    >
      <View style={styles.noteTop}>
        <Ico name="formatQuote" size={28} color={colors.onTertiaryContainer} />
        <CopyButton copy={copy} color={colors.onTertiaryContainer} />
      </View>
      <Text variant="quote" color="onTertiaryContainer" numberOfLines={8} style={{ marginTop: 6 }}>
        {h.text}
      </Text>
      <Text variant="labelMedium" color="onTertiaryContainer" numberOfLines={1} style={{ marginTop: 10, opacity: 0.8 }}>
        {`Highlight · ${source}`}
      </Text>
    </TransformCard>
  );
}

function ImageCard({ b, onLongPress }: { b: BookmarkWithTags } & CardProps) {
  const { colors } = useAppTheme();
  return (
    <TransformCard
      href={`/item/${b.id}`}
      color={colors.surfaceContainer}
      corner={R}
      accessibilityLabel={b.title}
      onLongPress={onLongPress}
    >
      <View style={{ height: 160, backgroundColor: colors.surfaceContainerHighest }}>
        {(b.thumbPath ?? b.filePath) && (
          <Image source={b.thumbPath ?? b.filePath} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        )}
      </View>
      <View style={styles.body}>
        <Text variant="titleMediumEmphasized" numberOfLines={2}>
          {b.title}
        </Text>
      </View>
    </TransformCard>
  );
}

function FileCard({ b, onLongPress }: { b: BookmarkWithTags } & CardProps) {
  const { colors, dark } = useAppTheme();
  const tone = collectionTones(hostSeed(b.title), dark);
  return (
    <TransformCard href={`/item/${b.id}`} color={colors.surfaceContainer} corner={R} accessibilityLabel={b.title} contentStyle={{ padding: 14, gap: 10 }} onLongPress={onLongPress}>
      <View style={[styles.glyph, { backgroundColor: tone.container }]}>
        <Text variant="labelLargeEmphasized" color={tone.onContainer} style={{ fontWeight: '700' }}>
          {glyphFor(b)}
        </Text>
      </View>
      <Text variant="titleMediumEmphasized" numberOfLines={3}>
        {b.title}
      </Text>
      <Meta>{`${sourceLabel(b)} · ${ago(b.createdAt)}`}</Meta>
    </TransformCard>
  );
}

/** Saved Markdown / text file: type label, title, and the first lines of the file. */
function TextFileCard({ b, copy, onLongPress }: { b: BookmarkWithTags; copy: CopyTargets } & CardProps) {
  const { colors } = useAppTheme();
  const markdown = cardKind(b) === 'markdown';
  const preview = filePreview(b, 4);
  return (
    <TransformCard
      href={`/item/${b.id}`}
      color={colors.surfaceContainer}
      corner={R}
      accessibilityLabel={`${kindLabel(b) ?? 'File'}: ${b.title}`}
      contentStyle={{ padding: 16 }}
      onLongPress={onLongPress}
    >
      <View style={styles.noteTop}>
        <Text variant="titleSmallEmphasized" color="primary" numberOfLines={1} style={{ letterSpacing: 0.6, flexShrink: 1 }}>
          {kindLabel(b) ?? 'File'}
        </Text>
        <View style={styles.topEnd}>
          <CopyButton copy={copy} color={colors.onSurfaceVariant} edge={false} />
          <Ico name={kindIcon(b) ?? 'description'} size={20} color={colors.primary} />
        </View>
      </View>
      <Text variant="titleMediumEmphasized" numberOfLines={2} style={{ marginTop: 6 }}>
        {b.title || 'Untitled file'}
      </Text>
      {preview ? (
        <View style={[styles.excerpt, { backgroundColor: colors.surfaceContainerHigh }]}>
          <Text
            variant="bodySmall"
            color="onSurfaceVariant"
            numberOfLines={4}
            style={markdown ? undefined : { fontFamily: MONO_FAMILY, fontSize: 12, lineHeight: 16 }}
          >
            {preview}
          </Text>
        </View>
      ) : null}
      <View style={{ marginTop: 10 }}>
        <Meta>{`${b.readAt ? 'Opened' : 'Unread'} · ${ago(b.createdAt)}`}</Meta>
      </View>
    </TransformCard>
  );
}

const styles = StyleSheet.create({
  excerpt: { marginTop: 10, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  linkCover: { height: 132, overflow: 'hidden', justifyContent: 'flex-end' },
  siteMark: { position: 'absolute', right: 14, bottom: 12, left: 14, textAlign: 'right', fontSize: 30, lineHeight: 34 },
  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1, minWidth: 0 },
  topEnd: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  /** 32dp target; -8 margins keep a 16dp-tall row's height and the card's edge padding unchanged. */
  copy: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginVertical: -8 },
  /** At the row's end: sit the glyph on the card's padding line. */
  copyEdge: { marginRight: -8 },
  favicon: { width: 16, height: 16, borderRadius: 5, overflow: 'hidden' },
  videoCover: { height: 112, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  play: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  pdfCover: { height: 176, alignItems: 'center', justifyContent: 'flex-end' },
  page: { width: 118, height: 154, borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: 'hidden' },
  noteTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  miniBox: { width: 16, height: 16, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  glyph: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
