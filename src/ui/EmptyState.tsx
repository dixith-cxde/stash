import { useState } from 'react';
import { View } from 'react-native';

import { MorphingShape } from '@/shapes/MorphingShape';
import type { MaterialShapeName } from '@/shapes/names';
import { useColors } from '@/theme/AppTheme';

import { Text } from './Text';

/** Rounded, friendly shapes for empty states (no spiky, pixel or excluded ones). */
const EMPTY_SHAPES: MaterialShapeName[] = [
  'cookie4Sided', 'cookie6Sided', 'cookie7Sided', 'cookie9Sided', 'cookie12Sided',
  'clover4Leaf', 'clover8Leaf', 'softBurst', 'softBoom', 'sunny', 'verySunny', 'flower',
  'gem', 'pentagon', 'arch', 'bun', 'ghostish', 'puffyDiamond', 'clamShell', 'fan', 'oval', 'diamond',
];

let last: MaterialShapeName | null = null;
/** A random empty-state shape, never the same one twice in a row. */
function nextShape(): MaterialShapeName {
  const pool = EMPTY_SHAPES.filter((s) => s !== last);
  last = pool[Math.floor(Math.random() * pool.length)];
  return last;
}

/**
 * Friendly empty state: a large expressive shape, a different one each time it appears.
 * When the message changes (another filter, a new search) it morphs into a new shape.
 */
export function EmptyState({ title, body }: { title: string; body: string }) {
  const colors = useColors();
  const [shown, setShown] = useState(() => ({ title, shape: nextShape() }));
  if (shown.title !== title) setShown({ title, shape: nextShape() });
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 40, paddingTop: 32, paddingBottom: 24, gap: 12 }}>
      <MorphingShape shape={shown.shape} size={120} color={colors.secondaryContainer} />
      <Text variant="titleLargeEmphasized" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text variant="bodyMedium" color="onSurfaceVariant" style={{ textAlign: 'center' }}>
        {body}
      </Text>
    </View>
  );
}
