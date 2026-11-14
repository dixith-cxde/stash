import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { type BookmarkWithTags, getBookmark, updateBookmark } from '@/db/repo';
import { chunkMarkdown, chunkText, fileLabel, formatBytes, prefersMonospace } from '@/features/files/kinds';
import { EXCERPT_MAX_BYTES, readTextHead, type TextHead, VIEWER_MAX_BYTES } from '@/features/files/read';
import { MarkdownView } from '@/features/notes/MarkdownView';
import { cardKind } from '@/features/stash/model';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { LoadingIndicator } from '@/shapes/LoadingIndicator';
import { useAppTheme } from '@/theme/AppTheme';
import { withAlpha } from '@/theme/palette';
import { MONO_FAMILY } from '@/theme/type';
import { ActionSheet } from '@/ui/ActionSheet';
import { BackPill } from '@/ui/BackPill';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';

/**
 * In-app viewer for saved Markdown and plain-text files. Reads at most the first 200 KB
 * (asynchronously), renders it as a virtualized list of chunks, and offers the rest in
 * another app. Markdown goes through the note renderer; text is selectable and wraps.
 */
export default function FileScreen() {
  return (
    <TransitionScreen kind="axisY">
      <FileBody />
    </TransitionScreen>
  );
}

function FileBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: b, loading } = useDbQuery(() => getBookmark(id), [id], null);
  const close = useTransitionClose();
  const { colors } = useAppTheme();
  if (!b) return <View style={{ flex: 1, backgroundColor: colors.surface }}>{!loading && <Problem text="This file is gone." onBack={close} />}</View>;
  if (!b.filePath) return <Problem text="This item has no file." onBack={close} />;
  return <Viewer b={b} source={b.filePath} />;
}

function Viewer({ b, source }: { b: BookmarkWithTags; source: string }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const markdown = cardKind(b) === 'markdown';
  const [head, setHead] = useState<TextHead | null>(null);
  const [error, setError] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mono, setMono] = useState(() => prefersMonospace(b));
  // Read the start state once: the row changes when we mark it read.
  const [initial] = useState(() => ({ readAt: b.readAt, content: b.content }));

  useEffect(() => {
    let live = true;
    readTextHead(source, VIEWER_MAX_BYTES)
      .then((h) => {
        if (!live) return;
        setHead(h);
        const patch: Parameters<typeof updateBookmark>[1] = {};
        if (!initial.readAt) patch.readAt = new Date();
        // Rows saved before excerpts existed: fill one in for cards and search.
        if (!initial.content && h.text) patch.content = h.text.slice(0, EXCERPT_MAX_BYTES);
        if (Object.keys(patch).length) void updateBookmark(b.id, patch);
      })
      .catch((e) => {
        console.warn('[file open]', e);
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, [source, b.id, initial]);

  const chunks = useMemo(() => (head ? (markdown ? chunkMarkdown(head.text) : chunkText(head.text)) : []), [head, markdown]);

  const openElsewhere = () => void Sharing.shareAsync(source, { mimeType: b.mimeType ?? 'text/plain', dialogTitle: b.title });
  const copyText = async () => {
    if (!head) return;
    await Clipboard.setStringAsync(head.text);
    showSnackbar(head.truncated ? 'Copied the first 200 KB' : 'Text copied');
  };

  if (error) return <Problem text="Couldn’t open this file." onOpen={openElsewhere} onBack={close} />;
  if (head?.binary) return <Problem text="This file isn’t text, so it can’t be shown here." onOpen={openElsewhere} onBack={close} />;

  const top = insets.top + 72;
  const meta = [fileLabel(b), formatBytes(head?.size ?? b.fileSize)].filter(Boolean).join(' · ');

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {head ? (
        <FlatList
          data={chunks}
          keyExtractor={(_, i) => String(i)}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={5}
          removeClippedSubviews
          contentContainerStyle={{ paddingTop: top, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
          ListHeaderComponent={
            <View style={{ marginBottom: 16 }}>
              <Text variant="labelMedium" color="onSurfaceVariant">
                {meta}
              </Text>
              <Text variant="headlineSmall" style={{ marginTop: 4 }} accessibilityRole="header">
                {b.title || 'Untitled'}
              </Text>
            </View>
          }
          renderItem={({ item }) =>
            markdown ? (
              <MarkdownView markdown={item} onOpenLink={(url) => void WebBrowser.openBrowserAsync(url)} />
            ) : (
              <Text
                variant={mono ? 'bodySmall' : 'bodyLarge'}
                selectable
                style={mono ? { fontFamily: MONO_FAMILY, lineHeight: 19 } : undefined}
              >
                {item}
              </Text>
            )
          }
          ListFooterComponent={
            head.truncated ? (
              <View style={[styles.truncated, { backgroundColor: colors.surfaceContainerHigh }]}>
                <Text variant="titleSmall">File truncated</Text>
                <Text variant="bodySmall" color="onSurfaceVariant">
                  {`Showing the first 200 KB of ${formatBytes(head.size)}. Open it in another app to see the rest.`}
                </Text>
                <Button label="Open in another app" icon="openInNew" variant="tonal" onPress={openElsewhere} />
              </View>
            ) : head.text.trim() === '' ? (
              <Text variant="bodyMedium" color="onSurfaceVariant">
                This file is empty.
              </Text>
            ) : undefined
          }
        />
      ) : (
        <View style={styles.center}>
          <LoadingIndicator size={48} />
        </View>
      )}

      <View style={[styles.top, { paddingTop: insets.top + 8, backgroundColor: withAlpha(colors.surface, 0.94) }]}>
        <BackPill label="Back" onPress={close} />
        <Text variant="titleSmall" numberOfLines={1} style={{ flex: 1 }}>
          {b.title}
        </Text>
        <IconButton icon="moreVert" accessibilityLabel="File options" variant="tonal" onPress={() => setMenu(true)} />
      </View>

      {menu && (
        <ActionSheet
          title={b.title}
          onDismiss={() => setMenu(false)}
          actions={[
            { label: 'Open in another app', icon: 'openInNew', onPress: openElsewhere },
            ...(head ? [{ label: 'Copy text', icon: 'contentCopy' as const, onPress: () => void copyText() }] : []),
            ...(!markdown
              ? [{ label: mono ? 'Use the body font' : 'Use monospace', icon: 'code' as const, onPress: () => setMono((m) => !m) }]
              : []),
          ]}
        />
      )}
    </View>
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
  truncated: { marginTop: 24, borderRadius: 24, padding: 18, gap: 10 },
});
