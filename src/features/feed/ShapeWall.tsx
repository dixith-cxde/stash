import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { enterRise, exitShrink, reflow } from '@/motion/layout';
import { cardKind, type FeedItem, hostSeed, sourceLabel } from '@/features/stash/model';
import { Shape } from '@/shapes/Shape';
import type { MaterialShapeName } from '@/shapes/names';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones } from '@/theme/palette';
import { Layout } from '@/theme/tokens';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';

/** Roomy shapes that leave space for a few lines of text. */
const SHAPES: MaterialShapeName[] = ['circle', 'ghostish', 'arch', 'pill', 'oval', 'cookie4Sided', 'square', 'slanted', 'clover4Leaf', 'semiCircle'];

/** Stable pick per item: the same card keeps its shape across renders. */
function pick(key: string): { shape: MaterialShapeName; rotation: number } {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const shape = SHAPES[h % SHAPES.length];
  // Pills and ovals lean a little; the rest stay upright so text sits well.
  const rotation = shape === 'pill' || shape === 'oval' ? ((h >> 4) % 2 ? -30 : 30) : 0;
  return { shape, rotation };
}

/**
 * Home's playful face: every saved item sits inside a scattered M3 shape (circle, ghost,
 * arch, pill…), two loose columns with the second one offset.
 */
export function ShapeWall({ items }: { items: FeedItem[] }) {
  const { width } = useWindowDimensions();
  const size = Math.floor((width - Layout.gutter * 2 - Layout.gridGap) / 2);
  const cols: FeedItem[][] = [[], []];
  items.forEach((f, i) => cols[i % 2].push(f));
  return (
    <View style={{ flexDirection: 'row', gap: Layout.gridGap, paddingHorizontal: Layout.gutter, alignItems: 'flex-start' }}>
      {cols.map((col, c) => (
        <View key={c} style={{ width: size, gap: Layout.gridGap, paddingTop: c === 1 ? size / 3 : 0 }}>
          {col.map((f) => (
            <Animated.View key={f.key} layout={reflow} entering={enterRise} exiting={exitShrink}>
              <ShapeTile f={f} size={size} />
            </Animated.View>
          ))}
        </View>
      ))}
    </View>
  );
}

const ShapeTile = memo(function ShapeTile({ f, size }: { f: FeedItem; size: number }) {
  const { colors, dark } = useAppTheme();
  const { shape, rotation } = pick(f.key);
  let bg: string;
  let fg: string;
  let title: string;
  let label: string;
  let href: string;
  if (f.kind === 'highlight') {
    const h = f.highlight;
    bg = colors.tertiaryContainer;
    fg = colors.onTertiaryContainer;
    title = `“${h.text}”`;
    label = 'Highlight';
    href = h.bookmarkId ? `/item/${h.bookmarkId}` : `/highlight/${h.id}`;
  } else {
    const b = f.item;
    const note = cardKind(b) === 'note';
    const tone = collectionTones(hostSeed(b.url ?? b.title), dark);
    bg = note ? colors.secondaryContainer : tone.container;
    fg = note ? colors.onSecondaryContainer : tone.onContainer;
    title = b.title || (b.content ?? '').trim() || 'Untitled';
    label = note ? 'Note' : sourceLabel(b);
    href = note ? `/note/${b.id}` : `/item/${b.id}`;
  }
  return (
    <PressableSurface
      kind="card"
      corner={size / 2}
      onPress={() => router.push(href as never)}
      accessibilityLabel={`${title}. ${label}`}
      style={{ width: size, height: size, backgroundColor: 'transparent' }}
    >
      <Shape name={shape} size={size} color={bg} rotation={rotation} style={StyleSheet.absoluteFill} />
      <View style={[styles.content, { padding: size * 0.2 }]}>
        <Text variant="labelLargeEmphasized" color={fg} numberOfLines={3} style={{ textAlign: 'center' }}>
          {title}
        </Text>
        <Text variant="labelSmall" color={fg} numberOfLines={1} style={{ textAlign: 'center', opacity: 0.75, marginTop: 4 }}>
          {label}
        </Text>
      </View>
    </PressableSurface>
  );
});

const styles = StyleSheet.create({
  content: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
