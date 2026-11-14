import { StyleSheet, View } from 'react-native';

import { DECOR_SHAPES, folderIcon, folderSeed } from '@/features/stash/model';
import type { Collection } from '@/features/stash/queries';
import { plural } from '@/lib/format';
import { Shape } from '@/shapes/Shape';
import { useAppTheme } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { collectionTones } from '@/theme/palette';
import { Ico } from '@/ui/Ico';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';
import { TransformCard } from '@/ui/TransformCard';

export function collectionSummary(c: Collection): string {
  const parts = [plural(c.itemCount, 'item')];
  if (c.byType.pdf) parts.push(plural(c.byType.pdf, 'PDF'));
  else if (c.byType.text) parts.push(plural(c.byType.text, 'note'));
  return parts.join(' · ');
}

/**
 * Collection card (design: tonal container, cookie/clover decoration bleeding off the top
 * right, icon tile, name and counts). Opens the collection with a container transform.
 */
export function CollectionCard({ c, index, width, height }: { c: Collection; index: number; width?: number; height: number }) {
  const { dark } = useAppTheme();
  const tone = collectionTones(folderSeed(c), dark);
  return (
    <TransformCard
      href={`/collection/${c.id}`}
      color={tone.container}
      corner={28}
      accessibilityLabel={`${c.name}, ${collectionSummary(c)}`}
      style={[{ height }, width ? { width } : { flex: 1 }]}
      contentStyle={styles.card}
    >
      <Shape
        name={DECOR_SHAPES[index % 2]}
        size={120}
        color={tone.accent}
        style={{ position: 'absolute', right: -36, top: -34 }}
      />
      <View style={[styles.iconTile, { backgroundColor: tone.onContainer }]}>
        <Ico name={folderIcon(c)} size={22} color={tone.container} />
      </View>
      <View>
        <Text variant="titleMedium" color={tone.onContainer} numberOfLines={1}>
          {c.name}
        </Text>
        <Text variant="bodySmall" color={tone.onContainer} numberOfLines={1} style={{ marginTop: 2 }}>
          {collectionSummary(c)}
        </Text>
      </View>
    </TransformCard>
  );
}

/** Dashed "New collection" card at the end of the Home rail. */
export function NewCollectionCard({ onPress, height }: { onPress: () => void; height: number }) {
  const { colors } = useAppTheme();
  return (
    <PressableSurface
      corner={28}
      onPress={onPress}
      accessibilityLabel="New collection"
      style={[styles.newCard, { height, borderColor: colors.outline }]}
    >
      <View style={[styles.plus, { backgroundColor: colors.surfaceContainerHigh }]}>
        <Ico name="add" size={24} color={colors.primary} />
      </View>
      <Text variant="labelMedium" color="onSurfaceVariant" style={{ fontWeight: '700', textAlign: 'center' }}>
        New collection
      </Text>
    </PressableSurface>
  );
}

/** Smart view tile on Library (design: 72dp, icon tile + name + count). */
export function SmartViewTile({
  href,
  label,
  detail,
  icon,
  glyph,
  tile,
}: {
  href: `/collection/${string}`;
  label: string;
  detail: string;
  icon?: IconName;
  glyph?: string;
  tile: { bg: string; fg: string };
}) {
  const { colors } = useAppTheme();
  return (
    <TransformCard
      href={href}
      color={colors.surfaceContainer}
      corner={24}
      accessibilityLabel={`${label}, ${detail}`}
      style={{ flex: 1, height: 72 }}
      contentStyle={styles.smart}
    >
      <View style={[styles.smallTile, { backgroundColor: tile.bg }]}>
        {icon ? (
          <Ico name={icon} size={20} color={tile.fg} />
        ) : (
          <Text variant="labelSmall" color={tile.fg} style={{ fontWeight: '800', fontSize: 11 }}>
            {glyph ?? ''}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="labelLarge" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="labelSmall" color="onSurfaceVariant" numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </TransformCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, justifyContent: 'space-between', overflow: 'hidden' },
  iconTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  newCard: {
    width: 120,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
  },
  plus: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  smart: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  smallTile: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
