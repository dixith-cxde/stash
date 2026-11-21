import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { springTo, useSprings } from '@/motion/springs';
import { useColors } from '@/theme/AppTheme';
import { Corner } from '@/theme/tokens';

import type { IconName } from '@/theme/icons';

import { Ico } from './Ico';
import { Portal } from './Portal';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';

/** Where the menu hangs from: the anchor's window rect (from measureInWindow). */
export type MenuAnchor = { x: number; y: number; width: number; height: number };

export type MenuOption<K extends string> = { key: K; label: string; icon?: IconName };

const WIDTH = 200;
const EDGE = 12;

/**
 * M3 Expressive vertical menu (dropdown): a surfaceContainer card hanging under its anchor,
 * right-aligned to it, opening from that corner on defaultSpatial and closing on fastEffects.
 * The selected option sits in a secondaryContainer pill with a check. Tap outside or back closes.
 */
export function DropdownMenu<K extends string>({
  anchor,
  options,
  selected,
  onSelect,
  onDismiss,
}: {
  anchor: MenuAnchor;
  options: MenuOption<K>[];
  selected?: K;
  onSelect: (key: K) => void;
  onDismiss: () => void;
}) {
  const colors = useColors();
  const springs = useSprings();
  const { width: screenW } = useWindowDimensions();
  const progress = useSharedValue(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    progress.set(springTo(1, springs.defaultSpatial));
  }, [progress, springs]);

  const close = (then?: () => void) => {
    if (closing) return;
    setClosing(true);
    progress.set(
      springTo(0, springs.fastEffects, undefined, () => {
        'worklet';
        scheduleOnRN(onDismiss);
      }),
    );
    then?.();
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  });

  const left = Math.max(EDGE, Math.min(anchor.x + anchor.width - WIDTH, screenW - WIDTH - EDGE));
  const top = anchor.y + anchor.height + 4;

  const card = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: Math.min(1, Math.max(0, p * 1.5)),
      transform: [{ translateY: (1 - p) * -8 }, { scaleY: 0.6 + 0.4 * p }],
    };
  });

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Close menu" />
        <Animated.View
          accessibilityRole="menu"
          style={[
            styles.card,
            { left, top, width: WIDTH, backgroundColor: colors.surfaceContainer, shadowColor: colors.shadow, transformOrigin: 'top right' },
            card,
          ]}
        >
          {options.map((o) => {
            const on = o.key === selected;
            return (
              <PressableSurface
                key={o.key}
                kind="button"
                corner={Corner.medium}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: on }}
                accessibilityLabel={o.label}
                onPress={() => close(() => onSelect(o.key))}
                style={[styles.item, { backgroundColor: on ? colors.secondaryContainer : 'transparent' }]}
              >
                {on ? (
                  <Ico name="check" size={20} color={colors.onSecondaryContainer} />
                ) : o.icon ? (
                  <Ico name={o.icon} size={20} color={colors.onSurfaceVariant} />
                ) : (
                  <View style={{ width: 20 }} />
                )}
                <Text variant="labelLarge" color={on ? 'onSecondaryContainer' : 'onSurface'} style={{ flex: 1 }}>
                  {o.label}
                </Text>
              </PressableSurface>
            );
          })}
        </Animated.View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: Corner.large,
    padding: 4,
    gap: 2,
    elevation: 3,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  item: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
});
