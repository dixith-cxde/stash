import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { devOnly } from '@/lib/devOnly';

/** Dev-only shared axis (Y) destination, like Note → Editor. */
function DevAxis() {
  return (
    <TransitionScreen kind="axisY">
      <Body />
    </TransitionScreen>
  );
}

function Body() {
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  useEffect(() => {
    if (!demo) return;
    const t = setTimeout(close, 2000);
    return () => clearTimeout(t);
  }, [demo, close]);
  return (
    <View style={{ flex: 1, padding: 24, paddingTop: insets.top + 24, gap: 16 }}>
      <Text variant="headlineMediumEmphasized">Editor</Text>
      <Text color="onSurfaceVariant">Slid up 30dp and faded in. Back reverses it.</Text>
      <Button label="Done" onPress={close} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}

export default devOnly(DevAxis);
