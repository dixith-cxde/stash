import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones } from '@/theme/palette';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { devOnly } from '@/lib/devOnly';

/** Dev-only destination of the container transform demo. */
function DevDetail() {
  const { origin } = useLocalSearchParams<{ origin?: string }>();
  return (
    <TransitionScreen kind="container" origin={origin}>
      <Body />
    </TransitionScreen>
  );
}

function Body() {
  const { name = 'Collection', seed = '#6750A4', demo } = useLocalSearchParams<{ name?: string; seed?: string; demo?: string }>();
  const { dark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const tone = collectionTones(seed, dark);

  useEffect(() => {
    if (!demo) return;
    const t = setTimeout(close, 2500);
    return () => clearTimeout(t);
  }, [demo, close]);

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          height: 268,
          backgroundColor: tone.container,
          borderBottomLeftRadius: 40,
          borderBottomRightRadius: 40,
          padding: 24,
          paddingTop: insets.top + 16,
          justifyContent: 'space-between',
        }}
      >
        <Button label="Back" icon="arrowBack" size="s" height={48} onPress={close} colors={{ bg: '#14121873', fg: tone.onContainer }} style={{ alignSelf: 'flex-start' }} />
        <Text variant="displaySmallEmphasized" color={tone.onContainer}>
          {name}
        </Text>
      </View>
      <View style={{ padding: 24, gap: 8 }}>
        <Text variant="bodyMedium" color="onSurfaceVariant">
          Swipe from either edge to preview going back. Release past 30% to close.
        </Text>
      </View>
    </View>
  );
}

export default devOnly(DevDetail);
