import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, SlideInDown, SlideInUp, SlideOutDown, SlideOutUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spring } from '@/motion/tokens';
import { useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { withAlpha } from '@/theme/palette';
import { ActionSheet } from '@/ui/ActionSheet';
import { Ico } from '@/ui/Ico';
import { IconButton } from '@/ui/IconButton';
import { Portal } from '@/ui/Portal';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';

export type SelectionAction = {
  label: string;
  icon: IconName;
  onPress: () => void;
  destructive?: boolean;
  /** Shown as a button on the toolbar; the rest go in its More menu. */
  quick?: boolean;
};

const ds = Spring.defaultSpatial;
const fe = Spring.fastEffects;
const enterTop = SlideInUp.springify().mass(ds.mass).stiffness(ds.stiffness).damping(ds.damping);
const enterBottom = SlideInDown.springify().mass(ds.mass).stiffness(ds.stiffness).damping(ds.damping);
const exitTop = SlideOutUp.springify().mass(fe.mass).stiffness(fe.stiffness).damping(fe.damping);
const exitBottom = SlideOutDown.springify().mass(fe.mass).stiffness(fe.stiffness).damping(fe.damping);
const de = Spring.defaultEffects;
const fs = Spring.fastSpatial;
/** The count rolls: the new number rises in, the old one leaves upward. */
const countIn = FadeInDown.springify().mass(de.mass).stiffness(de.stiffness).damping(de.damping);
const countOut = FadeOutUp.springify().mass(fe.mass).stiffness(fe.stiffness).damping(fe.damping);
/** Toolbar buttons pop in one after another (fastSpatial, 40 ms apart). */
const popIn = (i: number) => ZoomIn.springify().mass(fs.mass).stiffness(fs.stiffness).damping(fs.damping).delay(60 + i * 40);

/**
 * Contextual bars while selecting (M3 contextual top app bar + floating toolbar): the top bar
 * has Close, the count and Select all; the toolbar has the quick actions and a More menu for
 * the rest. Both render in the root portal, over the floating nav bar, and slide in/out.
 */
export function SelectionBar({
  count,
  total,
  noun = 'selected',
  onClose,
  onSelectAll,
  actions,
}: {
  count: number;
  /** How many could be selected; Select all hides once all are. */
  total: number;
  noun?: string;
  onClose: () => void;
  onSelectAll: () => void;
  actions: SelectionAction[];
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [more, setMore] = useState(false);
  if (count === 0) return null;
  const quick = actions.filter((a) => a.quick);
  const rest = actions.filter((a) => !a.quick);
  const shadow = `0px 6px 20px ${withAlpha(colors.shadow, 0.35)}`;

  return (
    <Portal>
      <Animated.View
        entering={enterTop}
        exiting={exitTop}
        accessibilityRole="toolbar"
        style={[styles.top, { paddingTop: insets.top + 8, backgroundColor: colors.surfaceContainer }]}
      >
        <IconButton icon="close" accessibilityLabel="Cancel selection" onPress={onClose} />
        <View style={styles.count} accessibilityLiveRegion="polite">
          <Animated.View key={count} entering={countIn} exiting={countOut}>
            <Text variant="titleLargeEmphasized">{String(count)}</Text>
          </Animated.View>
          <Text variant="titleLargeEmphasized">{` ${noun}`}</Text>
        </View>
        {count < total && <IconButton icon="selectAll" accessibilityLabel="Select all" onPress={onSelectAll} />}
      </Animated.View>

      <Animated.View entering={enterBottom} exiting={exitBottom} pointerEvents="box-none" style={[styles.bottom, { bottom: insets.bottom + 16 }]}>
        <View accessibilityRole="toolbar" style={[styles.bar, { backgroundColor: colors.surfaceContainerHigh, boxShadow: shadow }]}>
          {quick.map((a, i) => (
            <Animated.View key={a.label} entering={popIn(i)}>
              <ToolbarAction a={a} />
            </Animated.View>
          ))}
          {rest.length > 0 && (
            <Animated.View entering={popIn(quick.length)}>
              <IconButton icon="moreVert" accessibilityLabel="More actions" onPress={() => setMore(true)} />
            </Animated.View>
          )}
        </View>
      </Animated.View>

      {more && <ActionSheet title={`${count} ${noun}`} actions={rest} onDismiss={() => setMore(false)} />}
    </Portal>
  );
}

/** Toolbar button with a small label under the icon, so bulk actions read at a glance. */
function ToolbarAction({ a }: { a: SelectionAction }) {
  const colors = useColors();
  const fg = a.destructive ? colors.error : colors.onSurfaceVariant;
  return (
    <PressableSurface kind="button" corner={20} onPress={a.onPress} accessibilityLabel={a.label} style={styles.action}>
      <Ico name={a.icon} size={24} color={fg} />
      <Text variant="labelSmall" color={fg} numberOfLines={1}>
        {a.label}
      </Text>
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  count: { flex: 1, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', height: 40 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 8,
    borderRadius: 32,
    maxWidth: '94%',
  },
  action: {
    minWidth: 64,
    height: 56,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
