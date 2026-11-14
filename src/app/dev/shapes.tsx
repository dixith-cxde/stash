import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingIndicator } from '@/shapes/LoadingIndicator';
import { MorphingShape } from '@/shapes/MorphingShape';
import { USABLE_SHAPES } from '@/shapes/names';
import { Shape } from '@/shapes/Shape';
import { useColors } from '@/theme/AppTheme';
import { Text } from '@/ui/Text';

const CYCLE = ['cookie9Sided', 'clover4Leaf', 'pentagon', 'sunny', 'gem', 'cookie4Sided'] as const;

/** Dev-only gallery (stash://dev/shapes): every MaterialShape, a morph loop and the loader. */
export default function ShapesGallery() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), 1200);
    return () => clearInterval(id);
  }, []);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 48, paddingHorizontal: 16, gap: 24 }}
    >
      <Text variant="displaySmall">Shapes</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
        <MorphingShape shape={CYCLE[i % CYCLE.length]} size={120} color={colors.primary} rotation={i * 45} />
        <LoadingIndicator />
        <LoadingIndicator contained />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {USABLE_SHAPES.map((name) => (
          <View key={name} style={{ width: 76, alignItems: 'center', gap: 4 }}>
            <Shape name={name} size={64} color={colors.primaryContainer} />
            <Text variant="labelSmall" color="onSurfaceVariant" numberOfLines={1}>
              {name}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
