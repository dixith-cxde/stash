import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { getFeedItem, markFeedItemRead } from '@/db/repo';
import { hideArticle, saveArticle } from '@/features/feeds/ArticleCard';
import { cleanTeaser, hostOf, readMinutes } from '@/features/feeds/format';
import { loadArticle } from '@/features/feeds/sync';
import { MarkdownView } from '@/features/notes/MarkdownView';
import { hostSeed } from '@/features/stash/model';
import { relativeTime } from '@/lib/format';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { LoadingIndicator } from '@/shapes/LoadingIndicator';
import { Shape } from '@/shapes/Shape';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones, HIGHLIGHT_TONES } from '@/theme/palette';
import { ActionSheet } from '@/ui/ActionSheet';
import { BackPill, HeroIconButton } from '@/ui/BackPill';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

/**
 * Feed article reader (design: Feed article). Shows the feed's own text when it carries the
 * whole article; otherwise fetches the page once and shows its readable body (reader mode).
 */
export default function ArticleScreen() {
  const { origin } = useLocalSearchParams<{ origin?: string }>();
  return (
    <TransitionScreen kind="container" origin={origin}>
      <ArticleBody />
    </TransitionScreen>
  );
}

const isWeb = (u: string | null): u is string => !!u && /^https?:\/\//i.test(u);

/** A short paragraph that opens with a quote mark reads as a pull quote. */
const isPullQuote = (p: string) => /^[“"]/.test(p) && p.length < 220;

/** Avatar letter: first letter of the feed's name, ignoring a leading "The ". */
const initial = (name: string) => (name.replace(/^the\s+/i, '').trim()[0] ?? '?').toUpperCase();

/** Dock height plus its gap above the bottom inset, so the last line clears it. */
const DOCK_CLEARANCE = 64 + 20 + 32;

function ArticleBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const { data: a } = useDbQuery(() => getFeedItem(id), [id], null);
  const [menu, setMenu] = useState(false);

  // Opening marks it read, once: "Mark as unread" must not be undone while the page closes.
  useEffect(() => {
    void markFeedItemRead(id);
  }, [id]);

  // Reader mode: fetch the full article the first time it is opened (once, then cached).
  const [tried, setTried] = useState(false);
  const needsFetch = !!a && a.article === null;
  const itemId = a?.id;
  useEffect(() => {
    if (!needsFetch || !a) return;
    let live = true;
    void loadArticle(a).finally(() => live && setTried(true));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, needsFetch]);

  // Hero decoration drifts at half the scroll speed (parallax), as on the collection page.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => scrollY.set(e.contentOffset.y));
  const decor = useAnimatedStyle(() => ({ transform: [{ translateY: scrollY.get() * 0.5 }, { rotate: `${scrollY.get() * 0.08}deg` }] }));

  if (!a) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const tone = collectionTones(hostSeed(a.feedSiteUrl ?? a.url ?? a.feedTitle), dark);
  const quote = HIGHLIGHT_TONES.yellow[dark ? 'dark' : 'light'];
  const full = a.article ? a.article : null;
  const fetching = a.article === null && !tried && isWeb(a.url);
  const body = cleanTeaser(a.content) ?? cleanTeaser(a.summary) ?? '';
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const minutes = readMinutes(a.chars);
  const meta = [relativeTime(a.publishedAt ?? a.createdAt), minutes ? `${minutes} min read` : null].filter(Boolean).join(' · ');
  const web = isWeb(a.url) ? a.url : null;
  const openWeb = () => web && void WebBrowser.openBrowserAsync(web, { toolbarColor: colors.surface });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + DOCK_CLEARANCE }}
      >
        <View style={[styles.hero, { backgroundColor: tone.container, paddingTop: insets.top + 12 }]}>
          <Animated.View style={[styles.decor, decor]} pointerEvents="none">
            <Shape name="cookie12Sided" size={260} color={tone.accent} />
          </Animated.View>
          <View style={styles.heroBar}>
            <BackPill label="Feeds" onPress={close} onHero={tone.onContainer} />
            <HeroIconButton icon="moreVert" label="Article options" onPress={() => setMenu(true)} onHero={tone.onContainer} />
          </View>

          <View style={styles.heroText}>
            <View style={styles.source}>
              <View style={[styles.avatar, { backgroundColor: tone.onContainer }]}>
                <Text variant="titleMedium" color={tone.container} style={{ fontSize: 17, fontWeight: '800' }}>
                  {initial(a.feedTitle)}
                </Text>
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text variant="labelLarge" color={tone.onContainer} numberOfLines={1} style={{ fontWeight: '700' }}>
                  {a.feedTitle}
                </Text>
                <Text variant="labelMedium" color={tone.onContainer} numberOfLines={1} style={{ fontWeight: '600', opacity: 0.8 }}>
                  {meta}
                </Text>
              </View>
            </View>
            <Text
              variant="headlineLarge"
              color={tone.onContainer}
              accessibilityRole="header"
              selectable
              style={{ marginTop: 16, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6 }}
            >
              {a.title}
            </Text>
            {a.author ? (
              <Text variant="labelLarge" color={tone.onContainer} style={{ marginTop: 10, fontWeight: '600', opacity: 0.8 }}>
                {`By ${a.author}`}
              </Text>
            ) : null}
          </View>
        </View>

        {a.imageUrl ? (
          <Image source={a.imageUrl} style={[styles.image, { backgroundColor: colors.surfaceContainerHigh }]} contentFit="cover" transition={200} />
        ) : null}

        <View style={styles.body}>
          {full ? (
            <MarkdownView
              markdown={full}
              reading
              onOpenLink={(u) => void WebBrowser.openBrowserAsync(u, { toolbarColor: colors.surface })}
            />
          ) : fetching ? (
            <View style={styles.loading}>
              <LoadingIndicator size={48} />
              <Text variant="bodyMedium" color="onSurfaceVariant">
                Getting the full article…
              </Text>
            </View>
          ) : paragraphs.length ? (
            paragraphs.map((p, i) =>
              isPullQuote(p) ? (
                <View key={i} style={[styles.quote, { backgroundColor: quote.bg }]}>
                  <Text variant="bodyLarge" color={quote.fg} selectable style={{ fontSize: 18, lineHeight: 26, fontWeight: '700' }}>
                    {p}
                  </Text>
                </View>
              ) : (
                <Text key={i} variant="bodyLarge" selectable style={{ fontSize: 17, lineHeight: 28 }}>
                  {p}
                </Text>
              ),
            )
          ) : (
            <Text variant="bodyLarge" color="onSurfaceVariant" style={{ fontSize: 17, lineHeight: 28 }}>
              {web ? 'Couldn’t load the full article. Check your connection, or read it on the site.' : 'This feed only shares headlines.'}
            </Text>
          )}
        </View>

        {web && (
          <View style={styles.readOn}>
            <Button label={`Read on ${hostOf(web) ?? 'the site'}`} icon="openInNew" variant="tonal" height={48} onPress={openWeb} style={{ maxWidth: '100%' }} />
          </View>
        )}
      </Animated.ScrollView>

      <View style={[styles.dock, { bottom: insets.bottom + 20 }]}>
        {a.bookmarkId ? (
          <Button
            label="Saved to Stash"
            icon="bookmarkFill"
            height={64}
            corners={[32, 12, 12, 32]}
            colors={{ bg: 'primaryContainer', fg: 'onPrimaryContainer' }}
            grow
            accessibilityLabel="Saved to Stash. Open the saved item"
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: a.bookmarkId! } })}
            style={styles.shadow}
          />
        ) : (
          <Button label="Save to Stash" icon="bookmarkAdd" height={64} corners={[32, 12, 12, 32]} grow onPress={() => void saveArticle(a.id)} style={styles.shadow} />
        )}
        {web && (
          <IconButton icon="openInNew" accessibilityLabel="Open in browser" variant="tonal" size={64} corners={[12, 12, 12, 12]} onPress={openWeb} style={styles.shadow} />
        )}
        <IconButton
          icon="share"
          accessibilityLabel="Share"
          variant="tonal"
          size={64}
          corners={[12, 32, 32, 12]}
          onPress={() => void Share.share({ message: a.url ? `${a.title}\n${a.url}` : a.title })}
          style={styles.shadow}
        />
      </View>

      {menu && (
        <ActionSheet
          title={a.title}
          onDismiss={() => setMenu(false)}
          actions={[
            { label: 'Mark as unread', icon: 'markEmailUnread', onPress: () => void markFeedItemRead(a.id, false).then(close) },
            { label: 'Hide from Feeds', icon: 'visibilityOff', onPress: () => void hideArticle(a.id).then(close) },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden', paddingBottom: 28 },
  decor: { position: 'absolute', right: -80, top: -70 },
  heroBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  heroText: { paddingHorizontal: 24, paddingTop: 28 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  image: { marginHorizontal: 16, marginTop: 16, height: 200, borderRadius: 28 },
  body: { paddingHorizontal: 24, paddingTop: 24, gap: 16 },
  quote: { borderRadius: 24, paddingVertical: 18, paddingHorizontal: 20, marginVertical: 4 },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  readOn: { paddingHorizontal: 24, paddingTop: 24, alignItems: 'flex-start' },
  dock: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 4 },
  shadow: { boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.45)' },
});
