import { type ComponentRef, useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import type { MaterialShapeName } from '@/shapes/names';
import { Shape } from '@/shapes/Shape';
import { useAppTheme } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { useSettings } from '@/state/settings';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { Text } from '@/ui/Text';

/** First launch: two short pages on what Stash is, then the Home tour. */
export default function WelcomeScreen() {
  return (
    <TransitionScreen kind="axisY">
      <Welcome />
    </TransitionScreen>
  );
}

type Page = { shape: MaterialShapeName; icon: IconName; title: string; body: string; points: { icon: IconName; text: string }[] };

const PAGES: Page[] = [
  {
    shape: 'cookie9Sided',
    icon: 'bookmarkAdd',
    title: 'Save anything,\nread it later',
    body: 'Stash keeps the things you want to come back to.',
    points: [
      { icon: 'link', text: 'Links, videos, apps and repos' },
      { icon: 'pictureAsPdf', text: 'PDFs, images and text files' },
      { icon: 'share', text: 'Share to Stash from any app, or tap +' },
    ],
  },
  {
    shape: 'clover4Leaf',
    icon: 'search',
    title: 'Keep what matters,\nfind it again',
    body: 'Everything stays on your phone. No account, no cloud.',
    points: [
      { icon: 'folder', text: 'Collections and tags to sort things' },
      { icon: 'inkHighlighter', text: 'Highlights from articles and PDFs' },
      { icon: 'rssFeed', text: 'Feeds: follow sites and read them here' },
    ],
  },
];

function Welcome() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const { width } = useWindowDimensions();
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;

  const done = () => {
    setOnboarded(true);
    close();
  };
  const next = () => (last ? done() : pager.current?.scrollTo({ x: width * (page + 1), animated: true }));
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
      <View style={styles.topBar}>
        {!last && <Button label="Skip" variant="text" size="s" onPress={done} />}
      </View>
      <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={{ flex: 1 }}>
        {PAGES.map((p) => (
          <View key={p.title} style={[styles.page, { width }]}>
            <View style={styles.art}>
              <Shape name={p.shape} size={168} color={colors.primaryContainer} />
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={styles.artIcon}>
                  <Ico name={p.icon} size={64} color={colors.onPrimaryContainer} />
                </View>
              </View>
            </View>
            <Text variant="displaySmallEmphasized" style={{ fontWeight: '700' }}>
              {p.title}
            </Text>
            <Text variant="bodyLarge" color="onSurfaceVariant">
              {p.body}
            </Text>
            <View style={[styles.points, { backgroundColor: colors.surfaceContainerLow }]}>
              {p.points.map((pt) => (
                <View key={pt.text} style={styles.point}>
                  <View style={[styles.pointIcon, { backgroundColor: colors.secondaryContainer }]}>
                    <Ico name={pt.icon} size={20} color={colors.onSecondaryContainer} />
                  </View>
                  <Text variant="bodyMedium" style={{ flex: 1 }}>
                    {pt.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((p, i) => (
            <View key={p.title} style={[styles.dot, { backgroundColor: i === page ? colors.primary : colors.outlineVariant, width: i === page ? 24 : 8 }]} />
          ))}
        </View>
        <Button label={last ? 'Get started' : 'Next'} icon="arrowForward" height={56} onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { height: 56, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 12 },
  page: { paddingHorizontal: 24, gap: 14, justifyContent: 'center' },
  art: { width: 168, height: 168, marginBottom: 12 },
  artIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  points: { borderRadius: 24, padding: 8, gap: 2, marginTop: 8 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10 },
  pointIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
});
