import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { getFeedItem, markFeedItemRead } from '@/db/repo';
import { saveArticle } from '@/features/feeds/ArticleCard';
import { relativeTime } from '@/lib/format';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { useColors } from '@/theme/AppTheme';
import { ActionSheet } from '@/ui/ActionSheet';
import { BackPill, HeroIconButton } from '@/ui/BackPill';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

/** Feed article reader: the article's text as the feed delivered it, with save and open. */
export default function ArticleScreen() {
  const { origin } = useLocalSearchParams<{ origin?: string }>();
  return (
    <TransitionScreen kind="container" origin={origin}>
      <ArticleBody />
    </TransitionScreen>
  );
}

const isWeb = (u: string | null): u is string => !!u && /^https?:\/\//i.test(u);

function ArticleBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const { data: a } = useDbQuery(() => getFeedItem(id), [id], null);
  const [menu, setMenu] = useState(false);

  // Opening marks it read, once: "Mark as unread" must not be undone while the page closes.
  useEffect(() => {
    void markFeedItemRead(id);
  }, [id]);

  if (!a) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  const body = a.content ?? a.summary ?? '';
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const when = a.publishedAt ?? a.createdAt;
  const openWeb = () => isWeb(a.url) && void WebBrowser.openBrowserAsync(a.url, { toolbarColor: colors.surface });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Animated.ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120 + insets.bottom }}>
        <View style={styles.bar}>
          <BackPill label="Feeds" onPress={close} />
          <HeroIconButton icon="moreVert" label="More" onPress={() => setMenu(true)} />
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.badge, { backgroundColor: colors.secondaryContainer }]}>
              <Ico name="rssFeed" size={16} color={colors.onSecondaryContainer} />
              <Text variant="labelSmall" color="onSecondaryContainer" numberOfLines={1} style={{ fontWeight: '700', maxWidth: 200 }}>
                {a.feedTitle}
              </Text>
            </View>
            <Text variant="bodySmall" color="onSurfaceVariant" style={{ fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
              {relativeTime(when)}
            </Text>
          </View>
          <Text variant="headlineLarge" style={{ marginTop: 12 }} accessibilityRole="header" selectable>
            {a.title}
          </Text>
          {a.author ? (
            <Text variant="labelLarge" color="onSurfaceVariant" style={{ marginTop: 8 }}>
              {`By ${a.author}`}
            </Text>
          ) : null}
        </View>

        {a.imageUrl ? (
          <Image source={a.imageUrl} style={[styles.hero, { backgroundColor: colors.surfaceContainerHigh }]} contentFit="cover" transition={200} />
        ) : null}

        <View style={{ paddingHorizontal: 24, paddingTop: 20, gap: 14 }}>
          {paragraphs.length ? (
            paragraphs.map((p, i) => (
              <Text key={i} variant="bodyLarge" selectable style={{ lineHeight: 26 }}>
                {p}
              </Text>
            ))
          ) : (
            <Text variant="bodyLarge" color="onSurfaceVariant">
              This feed only shares headlines. Open the article to read it.
            </Text>
          )}
          {isWeb(a.url) && paragraphs.length > 0 && (
            <View style={{ alignSelf: 'flex-start', marginTop: 8 }}>
              <Button label="Read on the site" icon="openInNew" variant="tonal" onPress={openWeb} />
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <View style={[styles.dock, { bottom: insets.bottom + 20 }]}>
        {a.bookmarkId ? (
          <Button
            label="Saved · Open"
            icon="bookmarkFill"
            height={64}
            corners={[32, 12, 12, 32]}
            grow
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: a.bookmarkId! } })}
            style={styles.shadow}
          />
        ) : (
          <Button label="Save to Stash" icon="bookmarkAdd" height={64} corners={[32, 12, 12, 32]} grow onPress={() => void saveArticle(a.id)} style={styles.shadow} />
        )}
        {isWeb(a.url) && (
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
          actions={[{ label: 'Mark as unread', icon: 'markEmailUnread', onPress: () => void markFeedItemRead(a.id, false).then(close) }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  badge: { height: 26, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 10, borderRadius: 13 },
  hero: { marginHorizontal: 16, marginTop: 20, height: 200, borderRadius: 28 },
  dock: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 4 },
  shadow: { boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.45)' },
});
