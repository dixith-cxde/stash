import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteBookmarks, savedLinks, setArchived } from '@/db/repo';
import { hostOf } from '@/features/capture/normalize';
import { checkLink, type LinkHealth, runPool } from '@/features/links/check';
import { savedOn } from '@/lib/format';
import { haptic } from '@/motion/haptics';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { LoadingIndicator } from '@/shapes/LoadingIndicator';
import { useAppTheme } from '@/theme/AppTheme';
import { BackPill } from '@/ui/BackPill';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { ProgressBar } from '@/ui/ProgressBar';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';

type Link = { id: string; title: string; url: string; createdAt: Date };
type Found = Link & { health: Exclude<LinkHealth, 'ok'> };

/** Requests in flight at once: quick enough, gentle on the phone and the sites. */
const PARALLEL = 4;

/**
 * Settings → Check saved links: opens each saved link once (only when you start it) and lists
 * the ones that no longer load, plus ones that could not be checked (login walls, timeouts).
 * Each can be opened, archived or deleted.
 */
export default function LinksCheckScreen() {
  return (
    <TransitionScreen kind="axisX">
      <LinksCheck />
    </TransitionScreen>
  );
}

function LinksCheck() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const [total, setTotal] = useState<number | null>(null);
  const [done, setDone] = useState(0);
  const [found, setFound] = useState<Found[]>([]);
  const [state, setState] = useState<'idle' | 'running' | 'finished'>('idle');
  const stopped = useRef(false);
  useEffect(() => () => void (stopped.current = true), []);

  const start = async () => {
    stopped.current = false;
    setState('running');
    setFound([]);
    setDone(0);
    const links = await savedLinks();
    setTotal(links.length);
    await runPool(
      links,
      PARALLEL,
      (l) => checkLink(l.url),
      (l, health) => {
        if (stopped.current) return;
        setDone((d) => d + 1);
        if (health !== 'ok') setFound((f) => [...f, { ...l, health }]);
      },
      () => stopped.current,
    );
    if (!stopped.current) setState('finished');
  };

  const drop = (id: string) => setFound((f) => f.filter((x) => x.id !== id));
  const broken = found.filter((f) => f.health === 'broken');
  const unsure = found.filter((f) => f.health === 'unsure');
  const rows: (Found | { header: string })[] = [
    ...(broken.length ? [{ header: `Not loading · ${broken.length}` }, ...broken] : []),
    ...(unsure.length ? [{ header: `Couldn’t check · ${unsure.length}` }, ...unsure] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
      <View style={styles.bar}>
        <BackPill label="Settings" onPress={close} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => ('header' in r ? r.header : r.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 4 }}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text variant="headlineMediumEmphasized" accessibilityRole="header">
              Check saved links
            </Text>
            <Text variant="bodyMedium" color="onSurfaceVariant">
              Opens each saved link once to see if it still loads. Uses mobile data if you are not on Wi‑Fi.
            </Text>
            {state === 'running' && total != null ? (
              <View style={{ gap: 8, marginTop: 8 }}>
                <View style={styles.progressRow}>
                  <LoadingIndicator size={28} />
                  <Text variant="labelLargeEmphasized" style={{ flex: 1 }}>{`Checked ${done} of ${total}`}</Text>
                  <Button label="Stop" variant="text" size="s" onPress={() => ((stopped.current = true), setState('finished'))} />
                </View>
                <ProgressBar value={total ? done / total : 0} />
              </View>
            ) : (
              <Button
                label={state === 'finished' ? 'Check again' : 'Start check'}
                icon="link"
                height={56}
                onPress={() => void start()}
                style={{ alignSelf: 'flex-start', marginTop: 8 }}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          state === 'finished' ? (
            <EmptyState title="All links load" body={total ? `Checked ${total} saved links.` : 'You have no saved links yet.'} />
          ) : undefined
        }
        renderItem={({ item: r }) =>
          'header' in r ? (
            <Text variant="titleMediumEmphasized" color="onSurfaceVariant" style={styles.section}>
              {r.header}
            </Text>
          ) : (
            <View style={[styles.row, { backgroundColor: colors.surfaceContainer }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="labelLargeEmphasized" numberOfLines={2}>
                  {r.title || hostOf(r.url)}
                </Text>
                <Text variant="labelMedium" color="onSurfaceVariant" numberOfLines={1}>
                  {`${hostOf(r.url)} · saved ${savedOn(r.createdAt)}`}
                </Text>
              </View>
              <IconButton icon="openInNew" accessibilityLabel={`Open ${r.title}`} size={40} onPress={() => void WebBrowser.openBrowserAsync(r.url)} />
              <IconButton
                icon="archive"
                accessibilityLabel={`Archive ${r.title}`}
                size={40}
                onPress={() => {
                  void setArchived([r.id], true);
                  drop(r.id);
                  showSnackbar('Archived', { label: 'Undo', onPress: () => void setArchived([r.id], false) });
                }}
              />
              <IconButton
                icon="delete"
                accessibilityLabel={`Delete ${r.title}`}
                size={40}
                onPress={() =>
                  void deleteBookmarks([r.id]).then(() => {
                    haptic.remove();
                    drop(r.id);
                    showSnackbar('Deleted');
                  })
                }
              />
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row' },
  head: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 16, gap: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  section: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 16, paddingRight: 4, paddingVertical: 10, borderRadius: 16 },
});
