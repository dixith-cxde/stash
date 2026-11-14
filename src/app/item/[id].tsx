import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { type BookmarkWithTags, deleteBookmarks, getBookmark, type HighlightWithTags, queryHighlights, setArchived, updateBookmark } from '@/db/repo';
import { HighlightCard } from '@/features/collections/ItemViews';
import { OrganizeCard } from '@/features/detail/OrganizeCard';
import { FilePreview, hasFilePreview } from '@/features/files/FilePreview';
import { formatBytes } from '@/features/files/kinds';
import { cardKind, highlightsMarkdown, hostSeed, kindIcon, kindLabel, openAction, readingMinutes, sourceLabel } from '@/features/stash/model';
import { relativeTime } from '@/lib/format';
import { openItem } from '@/lib/nav';
import { haptic } from '@/motion/haptics';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { Shape } from '@/shapes/Shape';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones, withAlpha } from '@/theme/palette';
import { FONT_FAMILY, Type } from '@/theme/type';
import { ActionSheet } from '@/ui/ActionSheet';
import { BackPill, HeroIconButton } from '@/ui/BackPill';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { IconButton } from '@/ui/IconButton';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';

export default function ItemScreen() {
  const { origin } = useLocalSearchParams<{ origin?: string }>();
  return (
    <TransitionScreen kind="container" origin={origin}>
      <ItemBody />
    </TransitionScreen>
  );
}

function ItemBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const { data: b } = useDbQuery(() => getBookmark(id), [id], null);
  const { data: hls } = useDbQuery(() => queryHighlights({ bookmarkId: id }), [id], []);
  const [menu, setMenu] = useState(false);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => scrollY.set(e.contentOffset.y));
  const parallax = useAnimatedStyle(() => ({ transform: [{ translateY: scrollY.get() * 0.4 }] }));

  if (!b) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const kind = cardKind(b);
  const tone = collectionTones(hostSeed(b.url ?? b.title), dark);
  const site = b.siteName || sourceLabel(b);
  const minutes = readingMinutes(b.wordCount);
  const isFile = !!b.filePath;
  const metaLine = [
    sourceLabel(b),
    isFile ? formatBytes(b.fileSize) : null,
    `Saved ${relativeTime(b.createdAt)}`,
    minutes ? `${minutes} min read` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  // Files show themselves in the preview card below; the hero keeps the tone artwork.
  const art = isFile ? null : (b.imageUrl ?? b.thumbPath);
  // Links: what the URL points at ("App · Play Store", "Repo · owner/name", "Docs · MDN").
  const linkLabel = kind === 'link' ? kindLabel(b) : null;
  const linkIcon = kind === 'link' ? kindIcon(b) : null;
  const action = openAction(b);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        <View style={[styles.hero, { backgroundColor: tone.container }]}>
          <Animated.View style={[StyleSheet.absoluteFill, parallax]} pointerEvents="none">
            {art ? (
              <Image source={art} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            ) : (
              <>
                <Shape name="sunny" size={360} color={tone.accent} style={{ position: 'absolute', left: -90, top: -40 }} />
                <Shape name="cookie9Sided" size={150} color={tone.onContainer} style={{ position: 'absolute', right: -20, bottom: -30 }} />
                <Text variant="editorialLarge" color={tone.onContainer} numberOfLines={2} style={styles.siteMark}>
                  {site.split(/\s+/).slice(0, 2).join('\n')}
                </Text>
              </>
            )}
          </Animated.View>
          <View style={[styles.heroBar, { paddingTop: insets.top + 12 }]}>
            <BackPill label="Back" onPress={close} onHero={art ? colors.onSurface : tone.onContainer} />
            <HeroIconButton icon="moreVert" label="More" onPress={() => setMenu(true)} onHero={art ? colors.onSurface : tone.onContainer} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.favicon, { backgroundColor: tone.onContainer }]}>
              {b.favicon ? <Image source={b.favicon} style={StyleSheet.absoluteFill} /> : null}
            </View>
            <Text variant="bodySmall" color="onSurfaceVariant" style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {metaLine}
            </Text>
          </View>
          {linkLabel && (
            <View style={[styles.kindChip, { backgroundColor: colors.secondaryContainer }]}>
              {linkIcon && <Ico name={linkIcon} size={16} color={colors.onSecondaryContainer} />}
              <Text variant="labelLarge" color="onSecondaryContainer" numberOfLines={1}>
                {linkLabel}
              </Text>
            </View>
          )}
          <Text variant="headlineMediumEmphasized" style={{ marginTop: 12 }} accessibilityRole="header">
            {b.title || 'Untitled'}
          </Text>
          {b.description ? (
            <Text variant="bodyMedium" color="onSurfaceVariant" style={{ marginTop: 10, fontWeight: '400' }}>
              {b.description}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button label={action.label} icon={action.icon} height={56} corners={[28, 12, 12, 28]} grow onPress={() => void openItem(b)} />
          <IconButton
            icon="star"
            selectedIcon="starFill"
            accessibilityLabel="Favorite"
            variant="tonal"
            size={56}
            selected={b.isFavorite}
            onPress={() => void updateBookmark(b.id, { isFavorite: !b.isFavorite })}
          />
          <IconButton
            icon="share"
            accessibilityLabel="Share"
            variant="tonal"
            size={56}
            corners={[12, 28, 28, 12]}
            onPress={() => void Share.share({ message: b.url ? `${b.title}\n${b.url}` : b.title, title: b.title })}
          />
        </View>

        {hasFilePreview(kind, b) && <FilePreview b={b} kind={kind} onOpen={() => void openItem(b)} />}

        <OrganizeCard b={b} />

        {hls.length > 0 && (
          <>
            <View style={styles.section}>
              <Text variant="titleLargeEmphasized" accessibilityRole="header">
                Highlights
              </Text>
              <Text variant="labelLarge" color="onSurfaceVariant" style={{ flex: 1 }}>
                {String(hls.length)}
              </Text>
              <IconButton icon="share" accessibilityLabel="Export highlights as Markdown" variant="tonal" size={40} onPress={() => void exportHighlights(b, hls)} />
            </View>
            <View style={{ gap: 8, paddingHorizontal: 16 }}>
              {hls.map((h) => (
                <HighlightCard
                  key={h.id}
                  h={h}
                  unit={kind === 'pdf' ? 'Page' : 'Paragraph'}
                  onPress={
                    kind === 'pdf' && h.page && b.filePath
                      ? () => router.push({ pathname: '/pdf/[id]', params: { id: b.id, page: String(h.page) } })
                      : undefined
                  }
                />
              ))}
            </View>
          </>
        )}

        <NoteField id={b.id} initial={b.note ?? ''} />
      </Animated.ScrollView>

      {menu && (
        <ActionSheet
          title={b.title}
          onDismiss={() => setMenu(false)}
          actions={[
            ...(b.url ? [{ label: 'Copy link', icon: 'contentCopy' as const, onPress: () => void copy(b.url!) }] : []),
            {
              label: b.isArchived ? 'Unarchive' : 'Archive',
              icon: b.isArchived ? 'unarchive' : 'archive',
              onPress: () => {
                void setArchived([b.id], !b.isArchived);
                showSnackbar(b.isArchived ? 'Moved back to your stash' : 'Archived', {
                  label: 'Undo',
                  onPress: () => void setArchived([b.id], b.isArchived),
                });
              },
            },
            {
              label: 'Delete',
              icon: 'delete',
              destructive: true,
              onPress: () => {
                void deleteBookmarks([b.id]).then(() => {
                  haptic.remove();
                  showSnackbar('Deleted');
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

/** Shares the item's highlights as Markdown (to notes apps, mail, Obsidian…). */
async function exportHighlights(b: BookmarkWithTags, hls: HighlightWithTags[]) {
  await Share.share({ message: highlightsMarkdown(b, hls), title: `Highlights: ${b.title}` });
}

async function copy(text: string) {
  const Clipboard = await import('expo-clipboard');
  await Clipboard.setStringAsync(text);
  showSnackbar('Link copied');
}

/** YOUR NOTE: saves as you type (debounced). */
function NoteField({ id, initial }: { id: string; initial: string }) {
  const { colors } = useAppTheme();
  const [text, setText] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <View style={[styles.note, { backgroundColor: colors.surfaceContainer }]}>
      <Text variant="titleSmallEmphasized" color="primary">
        Your note
      </Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => void updateBookmark(id, { note: t }), 500);
        }}
        multiline
        placeholder="Why did you save this?"
        placeholderTextColor={withAlpha(colors.onSurfaceVariant, 0.7)}
        accessibilityLabel="Your note"
        style={{ color: colors.onSurface, fontFamily: FONT_FAMILY, ...Type.bodyMedium, marginTop: 6, padding: 0, minHeight: 66, textAlignVertical: 'top' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 300, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden' },
  heroBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  siteMark: { position: 'absolute', left: 24, bottom: 28, fontSize: 56, lineHeight: 56, letterSpacing: -2 },
  kindChip: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 12, height: 32, borderRadius: 16 },
  favicon: { width: 20, height: 20, borderRadius: 6, overflow: 'hidden' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 24, paddingTop: 20 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 12 },
  note: { marginHorizontal: 16, marginTop: 16, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 18 },
});
