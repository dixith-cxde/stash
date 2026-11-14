import { ScrollView, StyleSheet } from 'react-native';

import { folderIcon, folderSeed } from '@/features/stash/model';
import type { Collection } from '@/features/stash/queries';
import { connectedCorners } from '@/motion/useSelection';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones } from '@/theme/palette';
import { Layout } from '@/theme/tokens';
import { Ico } from '@/ui/Ico';
import { Text } from '@/ui/Text';
import { TransformCard } from '@/ui/TransformCard';

/** Connected group values (androidx ConnectedButtonGroup): 2dp gaps, 8dp inner corners, full ends. */
const H = 56;
const GAP = 2;
const INNER = 8;

/**
 * Home's collections as one connected group: tonal pills joined by 2dp gaps, fully round only
 * at the group's two ends, closed by a + segment for a new collection. Scrolls sideways.
 */
export function CollectionRow({ collections }: { collections: Collection[] }) {
  const { colors, dark } = useAppTheme();
  const count = collections.length + 1;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: Layout.gutter, paddingTop: 16, gap: GAP }}
      accessibilityRole="list"
      accessibilityLabel="Collections"
    >
      {collections.map((c, i) => {
        const tone = collectionTones(folderSeed(c), dark);
        return (
          <TransformCard
            key={c.id}
            href={`/collection/${c.id}`}
            color={tone.container}
            corners={connectedCorners(i, count, H / 2, INNER)}
            accessibilityLabel={`${c.name}, ${c.itemCount} items`}
            style={{ height: H }}
            contentStyle={[styles.pill, { paddingLeft: i === 0 ? 20 : 16 }]}
          >
            <Ico name={folderIcon(c)} size={20} color={tone.onContainer} />
            <Text variant="labelLargeEmphasized" color={tone.onContainer} numberOfLines={1} style={{ maxWidth: 160 }}>
              {c.name}
            </Text>
            <Text variant="labelLarge" color={tone.onContainer} style={{ opacity: 0.7 }}>
              {String(c.itemCount)}
            </Text>
          </TransformCard>
        );
      })}
      <TransformCard
        href="/collection/new"
        color={colors.primaryContainer}
        corners={connectedCorners(count - 1, count, H / 2, INNER)}
        accessibilityLabel="New collection"
        style={{ height: H, width: collections.length ? 64 : undefined }}
        contentStyle={[styles.pill, { justifyContent: 'center', paddingLeft: collections.length ? 0 : 20, paddingRight: collections.length ? 4 : 20 }]}
      >
        <Ico name="add" size={24} color={colors.onPrimaryContainer} />
        {collections.length ? null : (
          <Text variant="labelLargeEmphasized" color={colors.onPrimaryContainer}>
            New collection
          </Text>
        )}
      </TransformCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 20, height: H },
});
