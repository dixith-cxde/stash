import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { deleteBookmarks, getBookmark, queryHighlights, setArchived, updateBookmark } from '@/db/repo';
import { HighlightCard } from '@/features/collections/ItemViews';
import { OrganizeCard } from '@/features/detail/OrganizeCard';
import { cardKind, hostSeed, readingMinutes, sourceLabel } from '@/features/stash/model';
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

const READ_LABEL = { link: 'Read', video: 'Watch', pdf: 'Open PDF', note: 'Open', image: 'View', file: 'Open' } as const;

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
  const metaLine = [sourceLabel(b), `Saved ${relativeTime(b.createdAt)}`, minutes ? `${minutes} min read` : null]
    .filter(Boolean)
    .join(' · ');
  const art = b.imageUrl ?? b.thumbPath;

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
                <Text variant="displayLarge" color={tone.onContainer} numberOfLines={2} style={styles.siteMark}>
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
          <Text variant="headlineMedium" style={{ marginTop: 12 }} accessibilityRole="header">
            {b.title || 'Untitled'}
          </Text>
          {b.description ? (
            <Text variant="bodyMedium" color="onSurfaceVariant" style={{ marginTop: 10, fontWeight: '400' }}>
              {b.description}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button label={READ_LABEL[kind]} icon="menuBook" height={56} corners={[28, 12, 12, 28]} grow onPress={() => void openItem(b)} />
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

        <OrganizeCard b={b} />

        {hls.length > 0 && (
          <>
            <View style={styles.section}>
              <Text variant="titleLarge" accessibilityRole="header">
                Highlights
              </Text>
              <Text variant="labelMedium" color="onSurfaceVariant">
                {String(hls.length)}
              </Text>
            </View>
            <View style={{ gap: 8, paddingHorizontal: 16 }}>
              {hls.map((h) => (
                <HighlightCard key={h.id} h={h} />
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
      <Text variant="overline" color="primary">
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
  favicon: { width: 20, height: 20, borderRadius: 6, overflow: 'hidden' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 24, paddingTop: 20 },
  section: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 12 },
  note: { marginHorizontal: 16, marginTop: 16, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 18 },
});
