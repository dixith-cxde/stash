import { File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { bookmarksByTitles, deleteBookmarks, getBookmark, updateBookmark } from '@/db/repo';
import { OrganizeCard } from '@/features/detail/OrganizeCard';
import { MarkdownView } from '@/features/notes/MarkdownView';
import { hostSeed, sourceLabel, tasksIn, toggleTask, wikiLinks, wordCount } from '@/features/stash/model';
import { relativeTime } from '@/lib/format';
import { haptic } from '@/motion/haptics';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones } from '@/theme/palette';
import { ActionSheet } from '@/ui/ActionSheet';
import { BackPill, HeroIconButton } from '@/ui/BackPill';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { IconButton } from '@/ui/IconButton';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';
import { TransformCard } from '@/ui/TransformCard';

export default function NoteScreen() {
  const { origin } = useLocalSearchParams<{ origin?: string }>();
  return (
    <TransitionScreen kind="container" origin={origin}>
      <NoteBody />
    </TransitionScreen>
  );
}

async function exportMarkdown(title: string, md: string) {
  const name = `${(title || 'note').replace(/[^\w\- ]+/g, '').trim() || 'note'}.md`;
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(`# ${title}\n\n${md}`);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/markdown', dialogTitle: name });
}

function NoteBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const { data: b } = useDbQuery(() => getBookmark(id), [id], null);
  const md = b?.content ?? '';
  const links = wikiLinks(md);
  const { data: linked } = useDbQuery(() => bookmarksByTitles(links), [links.join('\n')], new Map());
  const [menu, setMenu] = useState(false);

  if (!b) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  const first = links.map((l) => linked.get(l.toLowerCase())).find(Boolean);
  const firstTone = first ? collectionTones(hostSeed(first.url ?? first.title), dark) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Animated.ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 120 + insets.bottom }}>
        <View style={styles.bar}>
          <BackPill label="Back" onPress={close} />
          <HeroIconButton icon="moreVert" label="More" onPress={() => setMenu(true)} />
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.badge, { backgroundColor: colors.secondaryContainer }]}>
              <Ico name="notes" size={16} color={colors.onSecondaryContainer} />
              <Text variant="labelMedium" color="onSecondaryContainer" style={{ fontWeight: '700' }}>
                Note
              </Text>
            </View>
            <Text variant="bodySmall" color="onSurfaceVariant" style={{ fontWeight: '600' }}>
              {`Edited ${relativeTime(b.updatedAt)} · ${wordCount(md)} words`}
            </Text>
          </View>
          <Text variant="headlineLargeEmphasized" style={{ marginTop: 12 }} accessibilityRole="header">
            {b.title || 'Untitled note'}
          </Text>
          <View style={{ marginTop: 12 }}>
            <OrganizeCard b={b} compact />
          </View>

          <View style={{ marginTop: 8 }}>
            <MarkdownView
              markdown={md}
              resolveLink={(t) => linked.get(t.toLowerCase())?.id}
              onToggleTask={(index) => {
                const task = tasksIn(md)[index];
                if (task) void updateBookmark(b.id, { content: toggleTask(md, task.line) });
              }}
            />
          </View>

          {first && firstTone && (
            <>
              <Text variant="titleSmallEmphasized" color="primary" style={{ marginTop: 24, marginBottom: 8 }}>
                Linked item
              </Text>
              <TransformCard href={`/item/${first.id}`} color={colors.surfaceContainer} corner={24} contentStyle={styles.linked} accessibilityLabel={first.title}>
                <View style={[styles.linkTile, { backgroundColor: firstTone.container }]}>
                  <Text variant="headlineSmallEmphasized" color={firstTone.onContainer}>
                    {(first.siteName || sourceLabel(first)).replace(/^the\s+/i, '').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="labelMedium" color="onSurfaceVariant">
                    {sourceLabel(first)}
                  </Text>
                  <Text variant="labelLargeEmphasized" numberOfLines={2} style={{ marginTop: 2 }}>
                    {first.title}
                  </Text>
                </View>
                <Ico name="chevronRight" size={24} color={colors.onSurfaceVariant} />
              </TransformCard>
            </>
          )}
        </View>
      </Animated.ScrollView>

      <View style={[styles.dock, { bottom: insets.bottom + 20 }]}>
        <Button
          label="Edit"
          icon="edit"
          height={64}
          corners={[32, 12, 12, 32]}
          grow
          onPress={() => router.push({ pathname: '/note/[id]/edit', params: { id: b.id } })}
          style={styles.shadow}
        />
        <IconButton
          icon="download"
          accessibilityLabel="Export as Markdown"
          variant="tonal"
          size={64}
          corners={[12, 12, 12, 12]}
          onPress={() => void exportMarkdown(b.title, md)}
          style={styles.shadow}
        />
        <IconButton
          icon="share"
          accessibilityLabel="Share"
          variant="tonal"
          size={64}
          corners={[12, 32, 32, 12]}
          onPress={() => void Share.share({ message: `${b.title}\n\n${md}`, title: b.title })}
          style={styles.shadow}
        />
      </View>

      {menu && (
        <ActionSheet
          title={b.title}
          onDismiss={() => setMenu(false)}
          actions={[
            { label: 'Export as Markdown', icon: 'download', onPress: () => void exportMarkdown(b.title, md) },
            {
              label: 'Delete note',
              icon: 'delete',
              destructive: true,
              onPress: () =>
                void deleteBookmarks([b.id]).then(() => {
                  haptic.remove();
                  showSnackbar('Note deleted');
                  close();
                }),
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  badge: { height: 26, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 10, borderRadius: 13 },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  linkTile: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dock: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 4 },
  shadow: { boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.45)' },
});
