import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChromeScroll } from '@/motion/ScrollChrome';
import { useColors } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';

import { Text } from './Text';

/** Temporary tab body for the v3 shell: the screen's large title over an empty surface. */
export function ScreenPlaceholder({ title }: { title: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const onScroll = useChromeScroll();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: Layout.navBarClearance }}
        >
          <View style={{ paddingLeft: Layout.textInset, paddingRight: 20 }}>
            <Text variant="editorialLarge">{title}</Text>
          </View>
        </Animated.ScrollView>
      </>
    </View>
  );
}
