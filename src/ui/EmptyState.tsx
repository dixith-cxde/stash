import { View } from 'react-native';

import { MorphingShape } from '@/shapes/MorphingShape';
import type { MaterialShapeName } from '@/shapes/names';
import { useColors } from '@/theme/AppTheme';

import { Text } from './Text';

/** Friendly empty state: a large expressive shape (it morphs when the context changes). */
export function EmptyState({ shape, title, body }: { shape: MaterialShapeName; title: string; body: string }) {
  const colors = useColors();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 40, paddingTop: 32, paddingBottom: 24, gap: 12 }}>
      <MorphingShape shape={shape} size={120} color={colors.secondaryContainer} />
      <Text variant="titleLarge" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text variant="bodyMedium" color="onSurfaceVariant" style={{ textAlign: 'center' }}>
        {body}
      </Text>
    </View>
  );
}
