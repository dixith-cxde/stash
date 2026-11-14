import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { getFeedItem, markFeedItemRead } from '@/db/repo';
import { hideArticle, saveArticle } from '@/features/feeds/ArticleCard';
import { cleanTeaser, hostOf, markdownTextLength, readMinutes } from '@/features/feeds/format';
import { FULL_TEXT_CHARS } from '@/features/feeds/parse';
import { loadArticle } from '@/features/feeds/sync';
import { MarkdownView } from '@/features/notes/MarkdownView';
import { aggregatorInfo, parseReaderMarkdown, READER_FORMAT } from '@/features/reader/discussion';
import { DiscussionSection } from '@/features/reader/DiscussionSection';
import { EndMatter } from '@/features/reader/EndMatter';
import { asMarkdown, cleanArticleWithByline } from '@/features/reader/cleanup';
import { splitEndMatter } from '@/features/reader/endmatter';
import { readerImageUrl, sameImage } from '@/features/reader/images';
import { MetaCard } from '@/features/reader/MetaCard';
import { ReaderImage } from '@/features/reader/ReaderImage';
import { hostSeed } from '@/features/stash/model';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { LoadingIndicator } from '@/shapes/LoadingIndicator';
import { Shape } from '@/shapes/Shape';
import { useSettings } from '@/state/settings';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones, HIGHLIGHT_TONES } from '@/theme/palette';
import { ActionSheet } from '@/ui/ActionSheet';
import { BackPill, HeroIconButton } from '@/ui/BackPill';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

/**
 * Feed article reader (design: Feed article). Shows the feed's own text when it carries the
 * whole article; otherwise fetches the page once and shows its readable body (reader mode).
 * Sections, top to bottom: tonal hero with the title, metadata card, lead image, body,
 * discussion band, "Read on site" footer.
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

/** Justified reading text; Android breaks lines and hyphenates so justified lines stay even. */
const justify =
  Platform.OS === 'android' ? ({ textBreakStrategy: 'highQuality', android_hyphenationFrequency: 'full' } as const) : {};

/** The first image in the body, so a lead image that repeats it is not shown twice. */
const firstImage = (md: string) => /!\[[^\]]*\]\(([^)\s]+)/.exec(md)?.[1] ?? null;

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
  const readerMode = useSettings((s) => s.readerMode);
  const [tried, setTried] = useState(false);
  const needsFetch = readerMode && !!a && a.article == null;
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

  // Parsed once per article: the body without its comment thread, the page byline, the thread.
  const full = readerMode && a?.article ? a.article : null;
  const parsed = useMemo(() => (full ? parseReaderMarkdown(full) : null), [full]);
  // HTML becomes Markdown; byline/date scraps the meta card shows, share bars and empty
  // headings go; related links, author and tags at the end become cards and chips.
  const pageUrl = a?.url ?? null;
  const feedAuthor = a?.author ?? null;
  const end = useMemo(() => {
    if (!parsed) return null;
    const clean = cleanArticleWithByline(asMarkdown(parsed.body, pageUrl), [parsed.meta?.byline, feedAuthor]);
    return { ...splitEndMatter(clean.body), byline: clean.byline };
  }, [parsed, pageUrl, feedAuthor]);

  // An article cached in an older reader format (before tables) is extracted again, once; the
  // old copy stays on screen until the new one is saved.
  const stale = readerMode && !!a?.article && !!parsed && (parsed.meta?.v ?? 0) < READER_FORMAT;
  const retried = useRef<string | null>(null);
  useEffect(() => {
    if (!stale || !a || retried.current === a.id) return;
    retried.current = a.id;
    void loadArticle(a, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale, itemId]);
  const content = a?.content ?? null;
  const summary = a?.summary ?? null;
  const aggregator = useMemo(() => aggregatorInfo(content, summary), [content, summary]);
  const toolbarColor = colors.surface;
  const openUrl = useCallback((u: string) => void WebBrowser.openBrowserAsync(u, { toolbarColor }), [toolbarColor]);

  if (!a) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const tone = collectionTones(hostSeed(a.feedSiteUrl ?? a.url ?? a.feedTitle), dark);
  const quote = HIGHLIGHT_TONES.yellow[dark ? 'dark' : 'light'];
  const teaser = cleanTeaser(a.content) ?? cleanTeaser(a.summary) ?? '';
  // A full-text feed item cached before formatting was kept shows its text while the page loads.
  // Link aggregators (Hacker News) only carry "Article URL / Comments URL" lines: never show
  // those as the article, only the loader and then the fetched page.
  const fetching = needsFetch && !tried && isWeb(a.url) && (!!aggregator || teaser.length < FULL_TEXT_CHARS);
  const paragraphs = (aggregator ? '' : teaser)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const web = isWeb(a.url) ? a.url : null;
  const host = hostOf(web);
  const minutes = readMinutes(parsed ? Math.min(a.chars, markdownTextLength(parsed.body)) : a.chars);
  // On link aggregators the feed's author is whoever posted the link; the page byline is the writer.
  const byline = parsed?.meta?.byline ?? end?.byline ?? null;
  const writer =
    end?.author ?? (byline ? { name: byline, url: null, bio: null } : a.author && !aggregator ? { name: a.author, url: null, bio: null } : null);
  const author = byline ? `By ${byline}` : a.author ? (aggregator ? `Posted by ${a.author}` : `By ${a.author}`) : null;
  const leadImage = readerImageUrl(a.imageUrl, web);
  const showLead = !!leadImage && !(parsed && sameImage(leadImage, readerImageUrl(firstImage(parsed.body), web)));
  const openWeb = () => web && openUrl(web);

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
            <Text
              variant="headlineLarge"
              color={tone.onContainer}
              accessibilityRole="header"
              selectable
              style={{ fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6 }}
            >
              {a.title}
            </Text>
          </View>
        </View>

        <MetaCard
          feedTitle={a.feedTitle}
          host={host}
          tone={tone}
          author={author}
          published={a.publishedAt ?? a.createdAt}
          minutes={minutes}
        />

        {showLead && leadImage ? <ReaderImage uri={leadImage} corner={28} style={styles.lead} /> : null}

        <View style={styles.body}>
          {end && end.body.trim() ? (
            <MarkdownView markdown={end.body} reading baseUrl={web} onOpenLink={openUrl} />
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
                <Text key={i} variant="bodyLarge" selectable {...justify} style={styles.paragraph}>
                  {p}
                </Text>
              ),
            )
          ) : (
            <View style={[styles.empty, { backgroundColor: colors.surfaceContainerLow }]}>
              <Ico name="info" size={20} color={colors.onSurfaceVariant} />
              <Text variant="bodyMedium" color="onSurfaceVariant" style={{ flex: 1 }}>
                {web
                  ? readerMode
                    ? 'Couldn’t load the full article. Check your connection, or read it on the site.'
                    : 'This feed only shares headlines. Turn on reader mode in Settings to fetch full articles.'
                  : 'This feed only shares headlines.'}
              </Text>
            </View>
          )}
        </View>

        {end && <EndMatter author={writer} tags={end.tags} related={end.related} onOpen={openUrl} />}

        <DiscussionSection discussion={parsed?.discussion ?? null} aggregator={aggregator} host={host} baseUrl={web} onOpen={openUrl} />

        {web && (
          <View style={styles.footer}>
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <Text variant="labelLarge" color="onSurfaceVariant">
              Original article
            </Text>
            <Button label={`Read on ${host ?? 'the site'}`} icon="openInNew" variant="tonal" height={48} onPress={openWeb} style={{ maxWidth: '100%' }} />
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
  lead: { marginHorizontal: 16, marginTop: 16 },
  // 20dp gutters keep a ~60-character measure at 17sp on a phone.
  body: { paddingHorizontal: 22, paddingTop: 8 },
  paragraph: { marginTop: 18, fontSize: 17, lineHeight: 28, textAlign: 'justify' },
  quote: { borderRadius: 24, paddingVertical: 18, paddingHorizontal: 20, marginTop: 20 },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 16, marginTop: 16 },
  footer: { paddingHorizontal: 24, paddingTop: 28, gap: 12, alignItems: 'flex-start' },
  divider: { alignSelf: 'stretch', height: StyleSheet.hairlineWidth, marginBottom: 8 },
  dock: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 4 },
  shadow: { boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.45)' },
});
