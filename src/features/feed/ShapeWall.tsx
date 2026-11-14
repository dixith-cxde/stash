import { router } from 'expo-router';
import { memo, useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Image as SvgImage, Path } from 'react-native-svg';

import type { BookmarkWithTags } from '@/db/repo';
import { enterRise, exitShrink } from '@/motion/layout';
import { cardKind, type FeedItem, hostSeed } from '@/features/stash/model';
import { materialShape } from '@/shapes/materialShapes';
import type { MaterialShapeName } from '@/shapes/names';
import { svgPath } from '@/shapes/path';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones } from '@/theme/palette';
import { Layout } from '@/theme/tokens';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';

/** How many items the playful face shows: only the main ones. */
const MAX = 12;

/**
 * One scattered block (units of the content width): x, y, size, shape, rotation. The
 * pattern repeats down the page, mirrored every other time.
 */
const SLOTS: { x: number; y: number; s: number; shape: MaterialShapeName; rot: number }[] = [
  { x: 0.27, y: 0.04, s: 0.44, shape: 'cookie6Sided', rot: 0 },
  { x: 0.76, y: 0.0, s: 0.2, shape: 'square', rot: 12 },
  { x: 0.02, y: 0.36, s: 0.16, shape: 'circle', rot: 0 },
  { x: 0.78, y: 0.34, s: 0.2, shape: 'pill', rot: -30 },
  { x: 0.04, y: 0.58, s: 0.32, shape: 'cookie9Sided', rot: 10 },
  { x: 0.56, y: 0.6, s: 0.38, shape: 'circle', rot: -8 },
  { x: 0.4, y: 1.0, s: 0.24, shape: 'ghostish', rot: 0 },
  { x: 0.02, y: 1.02, s: 0.24, shape: 'arch', rot: 0 },
  { x: 0.74, y: 1.04, s: 0.22, shape: 'clover4Leaf', rot: 20 },
];
const BLOCK_H = 1.3;

/** Main items first: favorites, then anything with a picture, newest first within each. */
function mainItems(items: FeedItem[]): BookmarkWithTags[] {
  const books = items.flatMap((f) => (f.kind === 'bookmark' ? [f.item] : []));
  const art = (b: BookmarkWithTags) => !!(b.thumbPath ?? b.imageUrl);
  const score = (b: BookmarkWithTags) => (b.isFavorite ? 2 : 0) + (art(b) ? 1 : 0);
  return books
    .filter((b) => b.isFavorite || art(b))
    .sort((a, b) => score(b) - score(a))
    .slice(0, MAX);
}

/**
 * Home's playful face: a loose collage of the main saved items, each cut into an M3 shape
 * (cookie, circle, pill, arch, ghost…) and scattered across the page.
 */
export function ShapeWall({ items }: { items: FeedItem[] }) {
  const { width } = useWindowDimensions();
  const w = width - Layout.gutter * 2;
  const main = useMemo(() => mainItems(items), [items]);
  if (!main.length) {
    return (
      <Text variant="bodyMedium" color="onSurfaceVariant" style={{ paddingHorizontal: Layout.textInset, paddingTop: 8 }}>
        Favorites and items with pictures show up here.
      </Text>
    );
  }
  const blocks = Math.ceil(main.length / SLOTS.length);
  const lastSlot = SLOTS[(main.length - 1) % SLOTS.length];
  const height = ((blocks - 1) * BLOCK_H + lastSlot.y + lastSlot.s) * w + 16;
  return (
    <View style={{ marginHorizontal: Layout.gutter, height }} accessibilityRole="list">
      {main.map((b, i) => {
        const block = Math.floor(i / SLOTS.length);
        const slot = SLOTS[i % SLOTS.length];
        const mirror = block % 2 === 1;
        const size = slot.s * w;
        const left = (mirror ? 1 - slot.x - slot.s : slot.x) * w;
        const top = (block * BLOCK_H + slot.y) * w;
        return (
          <Animated.View key={b.id} entering={enterRise} exiting={exitShrink} style={{ position: 'absolute', left, top }}>
            <ShapeTile b={b} size={size} shape={slot.shape} rotation={mirror ? -slot.rot : slot.rot} />
          </Animated.View>
        );
      })}
    </View>
  );
}

const ShapeTile = memo(function ShapeTile({
  b,
  size,
  shape,
  rotation,
}: {
  b: BookmarkWithTags;
  size: number;
  shape: MaterialShapeName;
  rotation: number;
}) {
  const { colors, dark } = useAppTheme();
  const d = useMemo(() => svgPath(materialShape(shape), size, rotation), [shape, size, rotation]);
  const art = b.thumbPath ?? b.imageUrl;
  const note = cardKind(b) === 'note';
  const tone = collectionTones(hostSeed(b.url ?? b.title), dark);
  const title = b.title || 'Untitled';
  const clip = `clip-${b.id}`;
  return (
    <PressableSurface
      kind="card"
      corner={size / 2}
      onPress={() => router.push((note ? `/note/${b.id}` : `/item/${b.id}`) as never)}
      accessibilityLabel={title}
      style={{ width: size, height: size, backgroundColor: 'transparent' }}
    >
      <Svg width={size} height={size} pointerEvents="none">
        <Defs>
          <ClipPath id={clip}>
            <Path d={d} />
          </ClipPath>
        </Defs>
        <Path d={d} fill={note ? colors.secondaryContainer : tone.container} />
        {art ? (
          <SvgImage href={art} width={size} height={size} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
        ) : null}
      </Svg>
      {!art && (
        <View style={{ position: 'absolute', inset: size * 0.22, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <Text
            variant={size > 120 ? 'labelLargeEmphasized' : 'labelSmall'}
            color={note ? colors.onSecondaryContainer : tone.onContainer}
            numberOfLines={3}
            style={{ textAlign: 'center' }}
          >
            {title}
          </Text>
        </View>
      )}
    </PressableSurface>
  );
});
