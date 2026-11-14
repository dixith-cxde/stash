import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useContainerSource } from '@/motion/transition/useContainerSource';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones, COLLECTION_SEEDS } from '@/theme/palette';
import { Button } from '@/ui/Button';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';

const CARDS = ['Research', 'Read later', 'Design refs', 'Recipes'];

/** Dev-only (stash://dev/transitions): container transform + shared axis. `?demo=1` opens a card. */
export default function Transitions() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const first = useRef<() => void>(null);

  useEffect(() => {
    if (!demo) return;
    const t = setTimeout(() => first.current?.(), 1500);
    return () => clearTimeout(t);
  }, [demo]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, gap: 16, paddingBottom: 48 }}
    >
      <Text variant="displaySmallEmphasized">Transitions</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CARDS.map((name, i) => (
          <Card key={name} name={name} seed={COLLECTION_SEEDS[i]} demo={demo} registerRef={i === 0 ? first : undefined} />
        ))}
      </View>
      <Button label="Shared axis (Y)" variant="tonal" onPress={() => router.push({ pathname: '/dev/axis', params: { demo } })} />
    </ScrollView>
  );
}

function Card({
  name,
  seed,
  demo,
  registerRef,
}: {
  name: string;
  seed: string;
  demo?: string;
  registerRef?: React.RefObject<(() => void) | null>;
}) {
  const { dark } = useAppTheme();
  const tone = collectionTones(seed, dark);
  const body = (
    <View style={{ flex: 1, padding: 16, justifyContent: 'flex-end' }}>
      <Text variant="titleMediumEmphasized" color={tone.onContainer}>
        {name}
      </Text>
    </View>
  );
  const { ref, open, hidden } = useContainerSource({ corner: 28, color: tone.container, ghost: body });
  const go = () => open({ pathname: '/dev/detail', params: { name, seed, demo } });
  useEffect(() => {
    if (registerRef) registerRef.current = go;
  });
  return (
    <View ref={ref} style={{ width: '48.5%', height: 168, opacity: hidden ? 0 : 1 }}>
      <PressableSurface corner={28} onPress={go} style={{ flex: 1, backgroundColor: tone.container }}>
        {body}
      </PressableSurface>
    </View>
  );
}
