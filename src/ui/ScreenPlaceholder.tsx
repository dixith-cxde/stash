import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeThrough } from '@/motion/FadeThrough';
import { useColors } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';

import { Text } from './Text';

/** Temporary tab body for the v3 shell: the screen's large title over an empty surface. */
export function ScreenPlaceholder({ title }: { title: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FadeThrough>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: Layout.navBarClearance }}>
          <View style={{ paddingLeft: Layout.textInset, paddingRight: 20 }}>
            <Text variant="displayLarge">{title}</Text>
          </View>
        </ScrollView>
      </FadeThrough>
    </View>
  );
}
