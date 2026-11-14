import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withDelay } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { springTo, useSprings } from '@/motion/springs';
import { useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { withAlpha } from '@/theme/palette';
import { Corner } from '@/theme/tokens';

import { Ico } from './Ico';
import { Portal } from './Portal';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';

export type FabMenuItem = { label: string; icon: IconName; onPress: () => void };

/** androidx FloatingActionButtonMenu: 56dp items, 4dp apart, titleMedium labels. */
const ITEM_HEIGHT = 56;
const ITEM_GAP = 4;
const STAGGER_MS = 30;

type Props = {
  items: FabMenuItem[];
  /** Where the FAB sits, so the close button lands exactly on it. */
  fab: { size: number; bottom: number; right: number; innerCorner: number };
  /** False plays the exit; `onClosed` runs when it ends (unmount then). */
  open: boolean;
  /** Scrim, Back, close button or an item: ask the parent to set `open` to false. */
  onRequestClose: () => void;
  onClosed: () => void;
};

/**
 * M3 Expressive FAB menu: opens from the FAB, which becomes the menu's close button; 2–6
 * related items with icon + label, fully rounded, hugging their content, in the primary
 * color set. Items rise from the FAB's top trailing corner with a short stagger on a spatial
 * spring; fades use effects springs. A light scrim closes it, and so does Back.
 */
export function FabMenu({ items, fab, open, onRequestClose, onClosed }: Props) {
  const colors = useColors();
  const springs = useSprings();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (open) {
      progress.set(springTo(1, springs.defaultSpatial));
    } else {
      progress.set(
        springTo(0, springs.fastEffects, undefined, (done) => {
          'worklet';
          if (done) scheduleOnRN(onClosed);
        }),
      );
    }
  }, [open, progress, springs, onClosed]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onRequestClose();
      return true;
    });
    return () => sub.remove();
  }, [onRequestClose]);

  const scrim = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.get())) }));
  const closeIcon = useAnimatedStyle(() => ({ transform: [{ rotate: `${(1 - progress.get()) * -90}deg` }] }));

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.scrim, 0.32) }, scrim]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} accessibilityLabel="Close menu" />
        </Animated.View>
        <View
          pointerEvents="box-none"
          style={[styles.items, { right: fab.right, bottom: fab.bottom + fab.size + 12 }]}
          accessibilityRole="menu"
        >
          {items.map((item, i) => (
            <MenuItem key={item.label} item={item} index={items.length - 1 - i} progress={progress} onClose={onRequestClose} />
          ))}
        </View>
        <PressableSurface
          corner={fab.size / 2}
          pressedCorner={Corner.large}
          onPress={onRequestClose}
          accessibilityLabel="Close"
          style={[
            styles.close,
            {
              width: fab.size,
              height: fab.size,
              right: fab.right,
              bottom: fab.bottom,
              borderTopLeftRadius: fab.innerCorner,
              borderBottomLeftRadius: fab.innerCorner,
              backgroundColor: colors.primary,
            },
          ]}
        >
          <Animated.View style={closeIcon}>
            <Ico name="close" size={28} color={colors.onPrimary} />
          </Animated.View>
        </PressableSurface>
      </View>
    </Portal>
  );
}

function MenuItem({ item, index, progress, onClose }: { item: FabMenuItem; index: number; progress: SharedValue<number>; onClose: () => void }) {
  const colors = useColors();
  const springs = useSprings();
  // Each item follows the menu progress with a small delay: the nearest item leads.
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(index * STAGGER_MS, springTo(1, springs.fastSpatial)));
  }, [p, index, springs]);
  const style = useAnimatedStyle(() => {
    const v = Math.min(p.get(), Math.max(0, progress.get()));
    return {
      opacity: Math.min(1, Math.max(0, v * 1.5)),
      transform: [{ translateY: (1 - v) * 24 * (index + 1) * 0.5 }, { scale: 0.6 + 0.4 * v }],
    };
  });
  return (
    <Animated.View style={[styles.itemWrap, style]}>
      <PressableSurface
        corner={ITEM_HEIGHT / 2}
        pressedCorner={Corner.large}
        onPress={() => {
          onClose();
          setTimeout(item.onPress, 120);
        }}
        accessibilityRole="menuitem"
        accessibilityLabel={item.label}
        style={[styles.item, { backgroundColor: colors.primaryContainer }]}
      >
        <Ico name={item.icon} size={24} color={colors.onPrimaryContainer} />
        <Text variant="titleMediumEmphasized" color="onPrimaryContainer">
          {item.label}
        </Text>
      </PressableSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  items: {
    position: 'absolute',
    alignItems: 'flex-end',
    gap: ITEM_GAP,
  },
  itemWrap: {
    transformOrigin: 'right bottom',
  },
  item: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 20,
    paddingRight: 24,
  },
  close: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

