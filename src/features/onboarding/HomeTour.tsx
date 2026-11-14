import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { enterFade, exitFade } from '@/motion/layout';
import { useAppTheme } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { withAlpha } from '@/theme/palette';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { Portal } from '@/ui/Portal';
import { Text } from '@/ui/Text';

type Step = { at: 'top' | 'bottom'; align: 'start' | 'center' | 'end'; icon: IconName; title: string; body: string };

const STEPS: Step[] = [
  {
    at: 'top',
    align: 'center',
    icon: 'search',
    title: 'Search everything',
    body: 'Words in articles, PDFs and notes, sites, tags. It forgives typos.',
  },
  {
    at: 'bottom',
    align: 'end',
    icon: 'add',
    title: 'Save something',
    body: 'Tap + to add a link, note or file. From other apps, use Share → Stash.',
  },
  {
    at: 'bottom',
    align: 'center',
    icon: 'collectionsBookmark',
    title: 'Library and Feeds',
    body: 'Library holds collections and highlights. Feeds follows sites you like and reads them here.',
  },
];

/** Three tips over Home after the welcome pages: search, the + button, then the tabs. */
export function HomeTour({ onDone }: { onDone: () => void }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const top = step.at === 'top';
  const align = step.align === 'start' ? 'flex-start' : step.align === 'end' ? 'flex-end' : 'center';

  return (
    <Portal>
      <Animated.View entering={enterFade} exiting={exitFade} style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.scrim, 0.55) }]}>
        <Animated.View
          key={i}
          entering={enterFade}
          style={[
            styles.tip,
            top ? { top: insets.top + 176 } : { bottom: insets.bottom + 112 },
            { alignItems: align },
          ]}
        >
          {top && <Ico name="arrowUpward" size={28} color={colors.primaryContainer} />}
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerHigh }]} accessibilityLiveRegion="polite">
            <View style={styles.head}>
              <View style={[styles.icon, { backgroundColor: colors.primaryContainer }]}>
                <Ico name={step.icon} size={22} color={colors.onPrimaryContainer} />
              </View>
              <Text variant="titleMediumEmphasized" style={{ flex: 1 }}>
                {step.title}
              </Text>
              <Text variant="labelLarge" color="onSurfaceVariant">{`${i + 1} of ${STEPS.length}`}</Text>
            </View>
            <Text variant="bodyMedium" color="onSurfaceVariant">
              {step.body}
            </Text>
            <View style={styles.actions}>
              {!last && <Button label="Skip tour" variant="text" size="s" onPress={onDone} />}
              <Button label={last ? 'Done' : 'Next'} size="s" onPress={() => (last ? onDone() : setI(i + 1))} />
            </View>
          </View>
          {!top && (
            <View style={{ transform: [{ rotate: '180deg' }], marginRight: step.align === 'end' ? 28 : 0 }}>
              <Ico name="arrowUpward" size={28} color={colors.primaryContainer} />
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  tip: { position: 'absolute', left: 16, right: 16, gap: 8 },
  card: { alignSelf: 'stretch', borderRadius: 28, padding: 20, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});
