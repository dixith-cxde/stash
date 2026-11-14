import { Asset } from 'expo-asset';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { type ComponentType, type Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';

import viewerHtml from '@/assets/pdf/viewer.html';
import { useDbQuery } from '@/db/hooks';
import { type BookmarkWithTags, createHighlight, getBookmark, queryHighlights, updateBookmark } from '@/db/repo';
import { haptic } from '@/motion/haptics';
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
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';

/**
 * In-app PDF reader: pdf.js in a WebView (bundled, offline; assets/pdf/viewer.html built by
 * `npm run pdf-viewer`). Pages are drawn as vectors, so text stays sharp at any zoom (the
 * visible part is re-rendered at the zoomed resolution). Pinch to zoom, scroll freely, and
 * select text to Copy, Share or Highlight (saved as a highlight with its page). Opens where
 * you left off and remembers the page. Tap to show or hide the chrome; scrolling down hides it.
 */
export default function PdfScreen() {
  return (
    <TransitionScreen kind="axisY">
      <PdfBody />
    </TransitionScreen>
  );
}

/** The package's class typing defaults its extra props to `undefined` (props become never). */
type WebHandle = { injectJavaScript: (script: string) => void };
const Web = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebHandle> }>;

const MENU = [
  { label: 'Copy', key: 'copy' },
  { label: 'Highlight', key: 'highlight' },
  { label: 'Share', key: 'share' },
];

type ViewerMessage =
  | { type: 'open'; pageCount: number }
  | { type: 'page'; page: number }
  | { type: 'tap' }
  | { type: 'scrollDown' }
  | { type: 'highlight'; page: number; text: string }
  | { type: 'error'; message: string };

/** The bundled viewer page as a local file:// URI (copied out of the app bundle once). */
function useViewerUri() {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    Asset.fromModule(viewerHtml)
      .downloadAsync()
      .then((a) => live && setUri(a.localUri ?? a.uri))
      .catch((e) => console.warn('[pdf viewer asset]', e));
    return () => {
      live = false;
    };
  }, []);
  return uri;
}

function PdfBody() {
  const { id, page } = useLocalSearchParams<{ id: string; page?: string }>();
  const { data: b, loading } = useDbQuery(() => getBookmark(id), [id], null);
  const { colors } = useAppTheme();
  const startPage = page ? Number.parseInt(page, 10) || null : null;
  if (!b) return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLowest }}>{!loading && <Problem text="This PDF is gone." />}</View>;
  if (!b.filePath) return <Problem text="This item has no file." />;
  return <Reader b={b} source={b.filePath} startPage={startPage} />;
}

/** `startPage` (1-based) opens at that page instead of where you left off (a highlight's page). */
function Reader({ b, source, startPage }: { b: BookmarkWithTags; source: string; startPage: number | null }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const springs = useSprings();
  const viewerUri = useViewerUri();
  const web = useRef<WebHandle>(null);

  const [pageCount, setPageCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(Math.max((startPage ?? b.lastPage ?? 1) - 1, 0));
  const [menu, setMenu] = useState(false);
  const [goTo, setGoTo] = useState(false);

  // Start state, read once: the row changes as we save the page and highlights.
  const initial = useRef({ lastPage: startPage ?? b.lastPage, pageCount: b.pageCount, readAt: b.readAt });
  const { data: saved, loading: hlLoading } = useDbQuery(() => queryHighlights({ bookmarkId: b.id }), [b.id], []);
  const [boot, setBoot] = useState<string | null>(null);
  useEffect(() => {
    if (boot || hlLoading) return;
    const config = {
      src: source,
      page: initial.current.lastPage ?? 1,
      bg: colors.surfaceContainerLowest,
      top: insets.top + 72,
      bottom: insets.bottom + 120,
      highlights: saved.filter((h) => h.page != null).map((h) => ({ page: h.page, text: h.text })),
    };
    setBoot(`window.STASH = ${JSON.stringify(config)}; true;`);
  }, [boot, hlLoading, saved, source, colors.surfaceContainerLowest, insets.top, insets.bottom]);

  // Remember the page (debounced, and once more on close).
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
    if (!pageCount) return;
    const t = setTimeout(() => void updateBookmark(b.id, { lastPage: current + 1 }), 600);
    return () => clearTimeout(t);
  }, [current, pageCount, b.id]);
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

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let m: ViewerMessage;
      try {
        m = JSON.parse(e.nativeEvent.data) as ViewerMessage;
      } catch {
        return;
      }
      switch (m.type) {
        case 'open': {
          setPageCount(m.pageCount);
          const patch: Parameters<typeof updateBookmark>[1] = {};
          if (initial.current.pageCount !== m.pageCount) patch.pageCount = m.pageCount;
          if (!initial.current.readAt) patch.readAt = new Date();
          if (Object.keys(patch).length) void updateBookmark(b.id, patch);
          break;
        }
        case 'page':
          setCurrent(m.page);
          break;
        case 'tap':
          setHidden((h) => !h);
          break;
        case 'scrollDown':
          setHidden(true);
          break;
        case 'highlight':
          haptic.save();
          void createHighlight({ bookmarkId: b.id, text: m.text, page: m.page, sourceTitle: b.title, sourceApp: 'Stash' }).then(() =>
            showSnackbar('Highlight saved'),
          );
          break;
        case 'error':
          console.warn('[pdf viewer]', m.message);
          setError('Couldn’t open this PDF.');
          break;
      }
    },
    [b.id, b.title],
  );

  const onMenu = useCallback((e: { nativeEvent: { key: string; selectedText: string } }) => {
    const { key, selectedText } = e.nativeEvent;
    const text = selectedText.trim();
    if (key === 'highlight') web.current?.injectJavaScript('window.stashHighlight && window.stashHighlight(); true;');
    else if (!text) return;
    else if (key === 'copy') void Clipboard.setStringAsync(text).then(() => showSnackbar('Copied'));
    else if (key === 'share') void Share.share({ message: text });
  }, []);

  const jump = (page: number) => {
    if (!pageCount) return;
    const index = Math.min(Math.max(page, 0), pageCount - 1);
    web.current?.injectJavaScript(`window.stashGoTo && window.stashGoTo(${index}); true;`);
    setCurrent(index);
  };

  const openElsewhere = () => void Sharing.shareAsync(source, { mimeType: b.mimeType ?? 'application/pdf', dialogTitle: b.title });
  const source_ = useMemo(() => (viewerUri ? { uri: viewerUri } : null), [viewerUri]);

  if (error) return <Problem text={error} onOpen={openElsewhere} onBack={close} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLowest }}>
      {source_ && boot ? (
        <Web
          ref={web}
          source={source_}
          originWhitelist={['file://*']}
          injectedJavaScriptBeforeContentLoaded={boot}
          onMessage={onMessage}
          menuItems={MENU}
          onCustomMenuSelection={onMenu}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          javaScriptEnabled
          webviewDebuggingEnabled={__DEV__}
          setBuiltInZoomControls
          setDisplayZoomControls={false}
          overScrollMode="never"
          textZoom={100}
          style={{ flex: 1, backgroundColor: colors.surfaceContainerLowest }}
          containerStyle={{ backgroundColor: colors.surfaceContainerLowest }}
          onShouldStartLoadWithRequest={(r: { url: string }) => r.url.startsWith('file://') || r.url.startsWith('about:') || r.url.startsWith('blob:')}
        />
      ) : null}

      {!pageCount && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <LoadingIndicator size={48} />
          <Text variant="bodyMedium" color="onSurfaceVariant">
            Opening…
          </Text>
        </View>
      )}

      <Animated.View style={[styles.top, { paddingTop: insets.top + 8, backgroundColor: withAlpha(colors.surfaceContainerLowest, 0.92) }, topStyle]} pointerEvents={hidden ? 'none' : 'box-none'}>
        <BackPill label="Back" onPress={close} />
        <Text variant="titleMediumEmphasized" numberOfLines={1} style={styles.title}>
          {b.title}
        </Text>
        <IconButton icon="moreVert" accessibilityLabel="PDF options" variant="tonal" onPress={() => setMenu(true)} />
      </Animated.View>

      {pageCount ? (
        <Animated.View style={[styles.bottom, { bottom: insets.bottom + 20 }, bottomStyle]} pointerEvents={hidden ? 'none' : 'box-none'}>
          <PressableSurface
            kind="button"
            corner={28}
            pressedCorner={16}
            onPress={() => setGoTo(true)}
            accessibilityLabel={`Page ${current + 1} of ${pageCount}. Go to page`}
            style={[styles.pill, { backgroundColor: colors.surfaceContainerHigh }]}
          >
            <Text variant="labelLargeEmphasized">{`Page ${current + 1} of ${pageCount}`}</Text>
            <View style={{ width: 96 }}>
              <ProgressBar value={(current + 1) / pageCount} wavy />
            </View>
          </PressableSurface>
        </Animated.View>
      ) : null}

      {menu && (
        <ActionSheet
          title={b.title}
          onDismiss={() => setMenu(false)}
          actions={[
            ...(pageCount ? [{ label: 'Go to page…', icon: 'swapVert' as const, onPress: () => setGoTo(true) }] : []),
            ...(pageCount && current > 0 ? [{ label: 'Back to the first page', icon: 'arrowBackIosNew' as const, onPress: () => jump(0) }] : []),
            { label: 'Open in another app', icon: 'openInNew', onPress: openElsewhere },
          ]}
        />
      )}

      {goTo && pageCount ? <GoToSheet pageCount={pageCount} current={current} onGo={(p) => jump(p - 1)} onDismiss={() => setGoTo(false)} /> : null}
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
            <Text variant="headlineSmallEmphasized" style={{ paddingHorizontal: 8 }}>
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
        <Text variant="titleMediumEmphasized" style={{ textAlign: 'center' }}>
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
