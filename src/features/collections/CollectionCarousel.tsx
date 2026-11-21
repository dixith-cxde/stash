import { router } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { folderIcon, folderSeed } from '@/features/stash/model';
import type { Collection } from '@/features/stash/queries';
import { plural } from '@/lib/format';
import { Shape } from '@/shapes/Shape';
import { useAppTheme } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { collectionTones } from '@/theme/palette';
import { Layout } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { Text } from '@/ui/Text';
import { TransformCard } from '@/ui/TransformCard';

/** M3 carousel values (androidx CarouselDefaults + samples): small item 56, gap 8, corner 28. */
const SMALL = 56;
const GAP = 8;
const CORNER = 28;
/** Gesture Handler scroll view, so swiping the carousel scrolls it instead of changing tab. */
const RailScrollView = Animated.createAnimatedComponent(GHScrollView);
const HEIGHT = 112;
/** Decoration bleeding off each card's corner: always the pill (Home uses one shape only). */
const DECOR = 'pill' as const;

type Entry = { key: string; href: `/collection/${string}`; label: string; detail: string; icon: IconName; bg: string; fg: string; accent: string };

/**
 * Hero carousel of collections: one large item and a small one peeking at the end. As you
 * scroll, the large item shrinks out to the left while the small one grows into its place.
 */
export function CollectionCarousel({ collections }: { collections: Collection[] }) {
  const { colors, dark } = useAppTheme();
  const { width } = useWindowDimensions();
  const view = width - Layout.gutter * 2;
  const large = view - SMALL - GAP;
  const step = large + GAP;
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.set(e.contentOffset.x);
  });

  const entries: Entry[] = [
    ...collections.map((c): Entry => {
      const tone = collectionTones(folderSeed(c), dark);
      return { key: c.id, href: `/collection/${c.id}`, label: c.name, detail: plural(c.itemCount, 'item'), icon: folderIcon(c), bg: tone.container, fg: tone.onContainer, accent: tone.accent };
    }),
    { key: 'new', href: '/collection/new', label: 'New collection', detail: 'Group what you save', icon: 'add', bg: colors.primaryContainer, fg: colors.onPrimaryContainer, accent: colors.primary },
  ];

  return (
    <View style={{ paddingTop: 16 }}>
      <RailScrollView
        horizontal
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        accessibilityRole="list"
        accessibilityLabel="Collections"
        style={{ marginHorizontal: Layout.gutter, height: HEIGHT }}
        contentContainerStyle={{ width: (entries.length - 1) * step + view, height: HEIGHT }}
      >
        {entries.map((e, i) => (
          <Item key={e.key} e={e} index={i} x={x} step={step} large={large} />
        ))}
      </RailScrollView>
      <Button variant="text" size="xs" label="Show all" onPress={() => router.push('/library')} style={{ alignSelf: 'flex-end', marginRight: Layout.gutter, marginTop: 4 }} />
    </View>
  );
}

function Item({ e, index, x, step, large }: { e: Entry; index: number; x: SharedValue<number>; step: number; large: number }) {
  // Keylines: the focused item (k) shrinks out to the left while k+1 grows to large;
  // everything after k+1 waits at the small size.
  const frame = useAnimatedStyle(() => {
    const f = x.get() / step;
    const k = Math.floor(f);
    const u = f - k;
    const d = index - k;
    let left: number;
    let w: number;
    if (d < 0) {
      w = SMALL;
      left = -(SMALL + GAP) * (u - d);
    } else if (d === 0) {
      w = large - (large - SMALL) * u;
      left = -(SMALL + GAP) * u;
    } else {
      const firstW = large - (large - SMALL) * u;
      const secondW = SMALL + (large - SMALL) * u;
      left = -(SMALL + GAP) * u + firstW + GAP;
      w = d === 1 ? secondW : SMALL;
      if (d > 1) left += secondW + GAP + (d - 2) * (SMALL + GAP);
    }
    return { transform: [{ translateX: x.get() + left }], width: w };
  });
  const text = useAnimatedStyle(() => {
    const f = x.get() / step;
    const near = 1 - Math.min(1, Math.abs(index - f));
    return { opacity: near * near };
  });
  return (
    <Animated.View style={[styles.frame, frame]}>
      <TransformCard href={e.href} color={e.bg} corner={CORNER} accessibilityLabel={`${e.label}, ${e.detail}`} style={{ flex: 1 }} contentStyle={styles.card}>
        <Shape
          name={DECOR}
          size={104}
          color={e.accent}
          rotation={index % 2 ? 18 : -12}
          style={styles.decor}
        />
        <View style={styles.icon}>
          <Ico name={e.icon} size={24} color={e.fg} />
        </View>
        <Animated.View style={[styles.text, text]}>
          <Text variant="titleMediumEmphasized" color={e.fg} numberOfLines={1}>
            {e.label}
          </Text>
          <Text variant="labelMedium" color={e.fg} numberOfLines={1} style={{ opacity: 0.75 }}>
            {e.detail}
          </Text>
        </Animated.View>
      </TransformCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  decor: { position: 'absolute', right: -30, top: -28 },
  card: { flex: 1, padding: 16, justifyContent: 'space-between', overflow: 'hidden' },
  icon: { width: 24, height: 24 },
  text: { width: 240, gap: 2 },
});
