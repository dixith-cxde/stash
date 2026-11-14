import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { cardKind, type FeedFilter, type FeedItem, matchesFilter, sourceLabel } from '@/features/stash/model';
import type { MaterialShapeName } from '@/shapes/names';
import { useAppTheme } from '@/theme/AppTheme';
import type { ColorRole } from '@/theme/palette';
import { Layout } from '@/theme/tokens';
import { Ico } from '@/ui/Ico';
import { ListGroup, ListItem } from '@/ui/List';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';

import { ShapeArt } from './ShapeWall';

const GROUPS: { key: Exclude<FeedFilter, 'all'>; title: string; bg: ColorRole; fg: ColorRole }[] = [
  { key: 'links', title: 'Links', bg: 'primaryContainer', fg: 'onPrimaryContainer' },
  { key: 'pdfs', title: 'PDFs', bg: 'tertiaryContainer', fg: 'onTertiaryContainer' },
  { key: 'notes', title: 'Notes', bg: 'secondaryContainer', fg: 'onSecondaryContainer' },
  { key: 'quotes', title: 'Quotes', bg: 'surfaceContainerHighest', fg: 'onSurface' },
];
const PREVIEW = 4;
const STACK: MaterialShapeName[] = ['cookie7Sided', 'square', 'square'];

/**
 * Below the playful collage: everything saved, as wide card groups per type. Each card has a
 * tonal header with stacked shape art, short list rows, and a row that shows the rest.
 */
export function GroupCards({ items }: { items: FeedItem[] }) {
  const groups = GROUPS.map((g) => ({ ...g, list: items.filter((f) => matchesFilter(f, g.key)) })).filter((g) => g.list.length);
  return (
    <View style={{ paddingHorizontal: Layout.gutter, paddingTop: 32, gap: 16 }}>
      {groups.map((g) => (
        <GroupCard key={g.key} title={g.title} bg={g.bg} fg={g.fg} list={g.list} />
      ))}
    </View>
  );
}

function GroupCard({ title, bg, fg, list }: { title: string; bg: ColorRole; fg: ColorRole; list: FeedItem[] }) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const shown = open ? list : list.slice(0, PREVIEW);
  const art = list.flatMap((f) => (f.kind === 'bookmark' && (f.item.thumbPath ?? f.item.imageUrl) ? [f.item] : [])).slice(0, 3);
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainer }]}>
      <View style={[styles.header, { backgroundColor: colors[bg] }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="headlineSmallEmphasized" color={fg} numberOfLines={1} style={{ fontWeight: '800', letterSpacing: 0.5 }}>
            {title.toUpperCase()}
          </Text>
          <Text variant="bodyMedium" color={fg} style={{ opacity: 0.8 }}>
            {`${list.length} saved`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {art.map((b, i) => (
            <View key={b.id} style={{ marginLeft: i ? -14 : 0 }}>
              <ShapeArt b={b} size={i === 0 ? 52 : 60} shape={STACK[i]} rotation={i === 0 ? -10 : 0} ring={colors[bg]} />
            </View>
          ))}
        </View>
      </View>
      <ListGroup style={{ padding: 8 }}>
        {shown.map((f) =>
          f.kind === 'bookmark' ? (
            <ListItem
              key={f.key}
              title={f.item.title || 'Untitled'}
              supporting={sourceLabel(f.item)}
              numberOfLines={1}
              container="surfaceContainerHigh"
              onPress={() => router.push((cardKind(f.item) === 'note' ? `/note/${f.item.id}` : `/item/${f.item.id}`) as never)}
            />
          ) : (
            <ListItem
              key={f.key}
              title={`“${f.highlight.text}”`}
              supporting="Highlight"
              numberOfLines={1}
              container="surfaceContainerHigh"
              onPress={() => router.push((f.highlight.bookmarkId ? `/item/${f.highlight.bookmarkId}` : `/highlight/${f.highlight.id}`) as never)}
            />
          ),
        )}
      </ListGroup>
      {list.length > PREVIEW && (
        <PressableSurface kind="card" corner={20} onPress={() => setOpen((o) => !o)} accessibilityLabel={open ? `Show fewer ${title}` : `Show all ${title}`} style={styles.more}>
          <Text variant="titleMedium" color="onSurface" style={{ flex: 1 }}>
            {open ? 'Show fewer' : `Show all ${list.length} ${title.toLowerCase()}`}
          </Text>
          <Ico name={open ? 'arrowUpward' : 'arrowForward'} size={24} color={colors.onSurface} />
        </PressableSurface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 22 },
  more: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, height: 56, marginHorizontal: 8, marginBottom: 8 },
});
