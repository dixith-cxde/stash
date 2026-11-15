import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { enterFade, exitFade } from '@/motion/layout';
import { springTo, useSprings } from '@/motion/springs';
import { useAppTheme } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { withAlpha } from '@/theme/palette';
import { Layout } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { Portal } from '@/ui/Portal';
import { Text } from '@/ui/Text';
import { type TourRect, useTourTargets } from '@/ui/TourTarget';

type Target = 'search' | 'add' | 'nav';
type Step = { target: Target; icon: IconName; title: string; body: string };

const STEPS: Step[] = [
  { target: 'search', icon: 'search', title: 'Search everything', body: 'Names, notes, article text, highlights, sites and #tags. It forgives typos.' },
  { target: 'add', icon: 'add', title: 'Save something', body: 'Tap + to add a link, note or file. From other apps, use Share → Stash.' },
  {
    target: 'nav',
    icon: 'collectionsBookmark',
    title: 'Library and Feeds',
    body: 'Library holds collections and highlights. Feeds follows sites you like and reads them here.',
  },
];

/** Room around the spotlit target, and the pointer's size. */
const PAD = 6;
const ARROW = 14;
/** Same gap as FloatingNavBar between the bar and the + button. */
const NAV_GAP = 4;

/**
 * Three tips over Home after the welcome pages. The scrim has a rounded cut-out that springs
 * from target to target (search field, + button, nav bar), ringed in primary, and the tip card
 * points at it.
 */
export function HomeTour({ onDone }: { onDone: () => void }) {
  const { colors } = useAppTheme();
  const springs = useSprings();
  const insets = useSafeAreaInsets();
  const measured = useTourTargets((s) => s.rects);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  let rect: TourRect | null = null;
  if (size) {
    const navH = Layout.navBarHeight;
    const navY = size.h - insets.bottom - Layout.navBarBottom - navH;
    rect =
      step.target === 'add'
        ? { x: size.w - Layout.gutter - navH, y: navY, w: navH, h: navH, r: navH / 2 }
        : step.target === 'nav'
          ? { x: Layout.gutter, y: navY, w: size.w - Layout.gutter * 2 - navH - NAV_GAP, h: navH, r: navH / 2 }
          : (measured.search ?? { x: Layout.gutter, y: insets.top + 150, w: size.w - Layout.gutter * 2, h: 56, r: 28 });
  }

  // The cut-out: one view with a huge border in the scrim color; its rounded inside is the hole.
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  const r = useSharedValue(0);
  const placed = useRef(false);
  const shown = useSharedValue(0);
  const rx = rect?.x;
  const ry = rect?.y;
  const rw = rect?.w;
  const rh = rect?.h;
  const rr = rect?.r;
  useEffect(() => {
    if (rx == null || ry == null || rw == null || rh == null || rr == null) return;
    const to = { x: rx - PAD, y: ry - PAD, w: rw + PAD * 2, h: rh + PAD * 2, r: rr + PAD };
    if (!placed.current) {
      x.set(to.x);
      y.set(to.y);
      w.set(to.w);
      h.set(to.h);
      r.set(to.r);
      placed.current = true;
      shown.set(1);
      return;
    }
    const s = springs.defaultSpatial;
    x.set(springTo(to.x, s));
    y.set(springTo(to.y, s));
    w.set(springTo(to.w, s));
    h.set(springTo(to.h, s));
    r.set(springTo(to.r, s));
  }, [rx, ry, rw, rh, rr, springs, x, y, w, h, r, shown]);

  const B = size ? Math.max(size.w, size.h) * 2 : 0;
  const hole = useAnimatedStyle(() => ({
    left: x.get() - B,
    top: y.get() - B,
    width: w.get() + B * 2,
    height: h.get() + B * 2,
    borderRadius: r.get() + B,
    opacity: shown.get(),
  }));
  const ring = useAnimatedStyle(() => ({
    left: x.get(),
    top: y.get(),
    width: w.get(),
    height: h.get(),
    borderRadius: r.get(),
    opacity: shown.get(),
  }));

  // The card sits on the far side of the target, its pointer aimed at the target's center.
  const below = rect && size ? rect.y + rect.h / 2 < size.h / 2 : true;
  const cardWidth = (size?.w ?? 0) - Layout.gutter * 2;
  const arrowX = rect ? Math.min(Math.max(rect.x + rect.w / 2 - Layout.gutter - ARROW / 2, 28), cardWidth - 28 - ARROW) : 0;

  return (
    <Portal>
      <Animated.View
        entering={enterFade}
        exiting={exitFade}
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {size && rect && (
          <>
            <Animated.View pointerEvents="none" style={[styles.abs, { borderWidth: B, borderColor: withAlpha(colors.scrim, 0.6) }, hole]} />
            <Animated.View pointerEvents="none" style={[styles.abs, { borderWidth: 2, borderColor: colors.primary }, ring]} />
            {/* Blocks taps on Home, the spotlit target included: the card drives the tour. */}
            <View style={StyleSheet.absoluteFill} />
            <Animated.View
              key={i}
              entering={enterFade}
              style={[
                styles.tip,
                { left: Layout.gutter, width: cardWidth },
                below ? { top: rect.y + rect.h + PAD + ARROW } : { bottom: size.h - rect.y + PAD + ARROW },
              ]}
            >
              <View
                style={[
                  styles.arrow,
                  { left: arrowX, backgroundColor: colors.surfaceContainerHigh },
                  below ? { top: -ARROW / 2 + 1 } : { bottom: -ARROW / 2 + 1 },
                ]}
              />
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
            </Animated.View>
          </>
        )}
      </Animated.View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  tip: { position: 'absolute' },
  arrow: { position: 'absolute', width: ARROW, height: ARROW, borderRadius: 3, transform: [{ rotate: '45deg' }] },
  card: { borderRadius: 28, padding: 20, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});
