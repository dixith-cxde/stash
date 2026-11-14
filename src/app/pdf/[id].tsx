import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  PixelRatio,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useDbQuery } from '@/db/hooks';
import { type BookmarkWithTags, getBookmark, updateBookmark } from '@/db/repo';
import { pagesAround } from '@/features/pdf/pages';
import { canRenderPdf, MAX_RENDER_WIDTH, openPdf, renderPage } from '@/features/pdf/render';
import { springTo, useSprings } from '@/motion/springs';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { LoadingIndicator } from '@/shapes/LoadingIndicator';
import { useAppTheme } from '@/theme/AppTheme';
import { withAlpha } from '@/theme/palette';
import { FONT_FAMILY, Type } from '@/theme/type';
import { ActionSheet } from '@/ui/ActionSheet';
import { BackPill } from '@/ui/BackPill';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { PressableSurface } from '@/ui/PressableSurface';
import { ProgressBar } from '@/ui/ProgressBar';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

/**
 * In-app PDF reader: pages rendered natively (PdfRenderer) as JPEGs, a few around the one on
 * screen, cached per width. Opens where you left off and remembers the page. Tap a page to
 * show or hide the chrome; scrolling down hides it.
 */
export default function PdfScreen() {
  return (
    <TransitionScreen kind="axisY">
      <PdfBody />
    </TransitionScreen>
  );
}

/** Margin around pages and the gap between them. */
const SIDE = 8;
const GAP = 8;
/** Scroll travel (dp) downwards before the chrome hides. */
const HIDE_AFTER = 24;

function PdfBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: b, loading } = useDbQuery(() => getBookmark(id), [id], null);
  const { colors } = useAppTheme();
  if (!b) return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLowest }}>{!loading && <Problem text="This PDF is gone." />}</View>;
  if (!b.filePath) return <Problem text="This item has no file." />;
  return <Reader b={b} source={b.filePath} />;
}

function Reader({ b, source }: { b: BookmarkWithTags; source: string }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const springs = useSprings();
  const { width: W, height: H } = useWindowDimensions();
  const pageW = W - SIDE * 2;
  const renderW = Math.min(Math.round(pageW * PixelRatio.get()), MAX_RENDER_WIDTH);
  const top = insets.top + 72;

  const [info, setInfo] = useState<{ pageCount: number; aspect: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uris, setUris] = useState<Record<number, string>>({});
  const rendered = useRef<Record<number, string>>({});
  const [current, setCurrent] = useState(0);
  const [menu, setMenu] = useState(false);
  const [goTo, setGoTo] = useState(false);
  const list = useRef<FlatList<number>>(null);

  // The bookmark row changes when we save the page; read it once for the start state.
  const initial = useRef({ lastPage: b.lastPage, pageCount: b.pageCount, readAt: b.readAt });

  // Open: page count + first page, then resume where the reader left off.
  useEffect(() => {
    if (!canRenderPdf()) return;
    let live = true;
    openPdf(b.id, source, renderW)
      .then((r) => {
        if (!live) return;
        rendered.current = { 0: r.firstUri };
        setUris(rendered.current);
        const start = Math.min(Math.max((initial.current.lastPage ?? 1) - 1, 0), r.pageCount - 1);
        setCurrent(start);
        setInfo({ pageCount: r.pageCount, aspect: r.aspect });
        const patch: Parameters<typeof updateBookmark>[1] = {};
        if (initial.current.pageCount !== r.pageCount) patch.pageCount = r.pageCount;
        if (!initial.current.readAt) patch.readAt = new Date();
        if (Object.keys(patch).length) void updateBookmark(b.id, patch);
      })
      .catch((e) => {
        console.warn('[pdf open]', e);
        if (live) setError('Couldn’t open this PDF.');
      });
    return () => {
      live = false;
    };
  }, [b.id, source, renderW]);

  // Render the pages around the current one, nearest first, one at a time (light on the CPU).
  const generation = useRef(0);
  useEffect(() => {
    if (!info) return;
    const gen = ++generation.current;
    void (async () => {
      for (const p of pagesAround(current, info.pageCount)) {
        if (rendered.current[p]) continue;
        try {
          const uri = await renderPage(b.id, source, p, renderW);
          rendered.current = { ...rendered.current, [p]: uri };
          setUris(rendered.current);
        } catch (e) {
          console.warn('[pdf page]', p, e);
        }
        if (gen !== generation.current) return;
      }
    })();
  }, [current, info, b.id, source, renderW]);

  // Remember the page (debounced, and once more on close).
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
    if (!info) return;
    const t = setTimeout(() => void updateBookmark(b.id, { lastPage: current + 1 }), 600);
    return () => clearTimeout(t);
  }, [current, info, b.id]);
  useEffect(() => () => void updateBookmark(b.id, { lastPage: currentRef.current + 1 }), [b.id]);

  // Chrome: fades on defaultEffects, slides on defaultSpatial.
  const [hidden, setHidden] = useState(false);
  const fade = useSharedValue(1);
  const slide = useSharedValue(0);
  useEffect(() => {
    fade.set(springTo(hidden ? 0 : 1, springs.defaultEffects));
    slide.set(springTo(hidden ? 1 : 0, springs.defaultSpatial));
  }, [hidden, springs, fade, slide]);
  const topStyle = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateY: -24 * slide.get() }] }));
  const bottomStyle = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateY: 24 * slide.get() }] }));

  const toggle = useCallback(() => setHidden((h) => !h), []);
  const tap = useTapGesture({
    maxDistance: 10,
    onActivate: () => {
      'worklet';
      scheduleOnRN(toggle);
    },
  });

  const pageH = info ? Math.round(pageW * info.aspect) : 0;
  const stride = pageH + GAP;

  const lastY = useRef(0);
  const travel = useRef(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (info && stride > 0) {
      const p = Math.min(info.pageCount - 1, Math.max(0, Math.floor((y + H / 2 - top) / stride)));
      if (p !== currentRef.current) setCurrent(p);
    }
    const dy = y - lastY.current;
    lastY.current = y;
    travel.current = Math.sign(dy) === Math.sign(travel.current) ? travel.current + dy : dy;
    if (travel.current > HIDE_AFTER && !hidden) setHidden(true);
  };

  const jump = (page: number) => {
    if (!info) return;
    const index = Math.min(Math.max(page, 0), info.pageCount - 1);
    list.current?.scrollToIndex({ index, animated: false });
    setCurrent(index);
  };

  const openElsewhere = () => void Sharing.shareAsync(source, { mimeType: b.mimeType ?? 'application/pdf', dialogTitle: b.title });

  const problem = canRenderPdf() ? error : 'PDFs can’t be shown in the app on this device.';
  if (problem) return <Problem text={problem} onOpen={openElsewhere} onBack={close} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLowest }}>
      {info ? (
        <GestureDetector gesture={tap}>
          <FlatList
            ref={list}
            data={Array.from({ length: info.pageCount }, (_, i) => i)}
            keyExtractor={(p) => String(p)}
            initialScrollIndex={current}
            getItemLayout={(_, index) => ({ length: stride, offset: top + stride * index, index })}
            onScroll={onScroll}
            scrollEventThrottle={32}
            windowSize={3}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            removeClippedSubviews
            contentContainerStyle={{ paddingTop: top, paddingBottom: insets.bottom + 96, paddingHorizontal: SIDE }}
            renderItem={({ item: p }) => <Page uri={uris[p]} page={p} width={pageW} height={pageH} />}
          />
        </GestureDetector>
      ) : (
        <View style={styles.center}>
          <LoadingIndicator size={48} />
          <Text variant="bodyMedium" color="onSurfaceVariant">
            Opening…
          </Text>
        </View>
      )}

      <Animated.View style={[styles.top, { paddingTop: insets.top + 8, backgroundColor: withAlpha(colors.surfaceContainerLowest, 0.92) }, topStyle]} pointerEvents={hidden ? 'none' : 'box-none'}>
        <BackPill label="Back" onPress={close} />
        <Text variant="titleSmall" numberOfLines={1} style={styles.title}>
          {b.title}
        </Text>
        <IconButton icon="moreVert" accessibilityLabel="PDF options" variant="tonal" onPress={() => setMenu(true)} />
      </Animated.View>

      {info && (
        <Animated.View style={[styles.bottom, { bottom: insets.bottom + 20 }, bottomStyle]} pointerEvents={hidden ? 'none' : 'box-none'}>
          <PressableSurface
            kind="button"
            corner={28}
            pressedCorner={16}
            onPress={() => setGoTo(true)}
            accessibilityLabel={`Page ${current + 1} of ${info.pageCount}. Go to page`}
            style={[styles.pill, { backgroundColor: colors.surfaceContainerHigh }]}
          >
            <Text variant="labelLarge">{`Page ${current + 1} of ${info.pageCount}`}</Text>
            <View style={{ width: 96 }}>
              <ProgressBar value={(current + 1) / info.pageCount} />
            </View>
          </PressableSurface>
        </Animated.View>
      )}

      {menu && (
        <ActionSheet
          title={b.title}
          onDismiss={() => setMenu(false)}
          actions={[
            ...(info ? [{ label: 'Go to page…', icon: 'swapVert' as const, onPress: () => setGoTo(true) }] : []),
            ...(info && current > 0 ? [{ label: 'Back to the first page', icon: 'arrowBackIosNew' as const, onPress: () => jump(0) }] : []),
            { label: 'Open in another app', icon: 'openInNew', onPress: openElsewhere },
          ]}
        />
      )}

      {goTo && info && <GoToSheet pageCount={info.pageCount} current={current} onGo={(p) => jump(p - 1)} onDismiss={() => setGoTo(false)} />}
    </View>
  );
}

/** One page: its bitmap once rendered, a numbered placeholder until then. */
function Page({ uri, page, width, height }: { uri?: string; page: number; width: number; height: number }) {
  const { colors } = useAppTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Page ${page + 1}`}
      style={{ width, height, marginBottom: GAP, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.surfaceContainerHigh }}
    >
      {uri ? (
        <Image source={uri} style={StyleSheet.absoluteFill} contentFit="contain" transition={120} recyclingKey={uri} />
      ) : (
        <View style={styles.center}>
          <Text variant="titleMedium" color="onSurfaceVariant">
            {String(page + 1)}
          </Text>
        </View>
      )}
    </View>
  );
}

function GoToSheet({ pageCount, current, onGo, onDismiss }: { pageCount: number; current: number; onGo: (page: number) => void; onDismiss: () => void }) {
  const { colors } = useAppTheme();
  const [value, setValue] = useState('');
  const n = Number.parseInt(value, 10);
  const valid = Number.isFinite(n) && n >= 1 && n <= pageCount;
  return (
    <Sheet accessibilityLabel="Go to page" onDismiss={onDismiss}>
      {(close) => {
        const go = () => {
          if (!valid) return;
          onGo(n);
          close();
        };
        return (
          <View style={{ gap: 16 }}>
            <Text variant="headlineSmall" style={{ paddingHorizontal: 8 }}>
              Go to page
            </Text>
            <View style={[styles.field, { backgroundColor: colors.surfaceContainerHighest }]}>
              <TextInput
                value={value}
                onChangeText={(t) => setValue(t.replace(/\D/g, ''))}
                autoFocus
                keyboardType="number-pad"
                returnKeyType="go"
                maxLength={5}
                placeholder={`${current + 1}  (1–${pageCount})`}
                placeholderTextColor={colors.onSurfaceVariant}
                onSubmitEditing={go}
                accessibilityLabel={`Page number, 1 to ${pageCount}`}
                style={{ flex: 1, color: colors.onSurface, fontFamily: FONT_FAMILY, ...Type.bodyLarge, paddingVertical: 0 }}
              />
            </View>
            <Button label="Go" icon="arrowForward" disabled={!valid} onPress={go} />
          </View>
        );
      }}
    </Sheet>
  );
}

function Problem({ text, onOpen, onBack }: { text: string; onOpen?: () => void; onBack?: () => void }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8, paddingHorizontal: 12 }}>
      {onBack && <BackPill label="Back" onPress={onBack} />}
      <View style={[styles.center, { paddingHorizontal: 24 }]}>
        <Text variant="titleMedium" style={{ textAlign: 'center' }}>
          {text}
        </Text>
        {onOpen && <Button label="Open in another app" icon="openInNew" variant="tonal" onPress={onOpen} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  title: { flex: 1 },
  bottom: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.35)' },
  field: { height: 56, borderRadius: 28, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
});
