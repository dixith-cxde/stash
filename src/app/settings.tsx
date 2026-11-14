import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { listFeeds } from '@/db/repo';
import { exportHtml, exportJson, importBackup } from '@/features/backup/backup';
import { useTotals } from '@/features/stash/queries';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { MotionSpec } from '@/motion/tokens';
import { usePressMorph } from '@/motion/usePressMorph';
import { type Corners4, cornerStyle, useSelection } from '@/motion/useSelection';
import { type ColorSource, type ThemeMode, useSettings } from '@/state/settings';
import { useAppTheme } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { DEFAULT_SEED, vibrantPalette, SEED_COLORS } from '@/theme/palette';
import { Layout } from '@/theme/tokens';
import { BackPill } from '@/ui/BackPill';
import { ButtonGroup, type GroupItem } from '@/ui/ButtonGroup';
import { Ico } from '@/ui/Ico';
import { PressableSurface } from '@/ui/PressableSurface';
import { showSnackbar } from '@/ui/Snackbar';
import { Switch } from '@/ui/Switch';
import { Text } from '@/ui/Text';

export default function SettingsScreen() {
  return (
    <TransitionScreen kind="axisX">
      <Settings />
    </TransitionScreen>
  );
}

const THEME_ITEMS: GroupItem<ThemeMode>[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

/** Dynamic color needs Android 12 (API 31). */
const HAS_WALLPAPER_COLOR = Platform.OS === 'android' && Number(Platform.Version) >= 31;

const COLOR_ITEMS: GroupItem<ColorSource>[] = [
  { key: 'stash', label: 'Stash' },
  ...(HAS_WALLPAPER_COLOR ? [{ key: 'wallpaper' as const, label: 'Wallpaper' }] : []),
  { key: 'seed', label: 'Custom' },
];

const COLOR_HINT: Record<ColorSource, string> = {
  stash: 'Stash palette',
  wallpaper: 'From your wallpaper',
  seed: 'Custom seed color',
};

const THEME_HINT: Record<ThemeMode, string> = {
  system: 'Follows your device',
  light: 'Always light',
  dark: 'Always dark',
};

/** Connected list corners: 24 at the group's ends, 6 where rows meet. */
const OUTER = 24;
const INNER = 6;
const rowCorners = (index: number, count: number): Corners4 => {
  const t = index === 0 ? OUTER : INNER;
  const b = index === count - 1 ? OUTER : INNER;
  return [t, t, b, b];
};

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

function Settings() {
  const close = useTransitionClose();
  const insets = useSafeAreaInsets();
  const s = useSettings();
  const { colors } = useAppTheme();
  const { data: totals } = useTotals();
  const { data: feedCount } = useDbQuery(async () => (await listFeeds()).length, [], 0);
  const [busy, setBusy] = useState(false);

  const source: ColorSource = s.colorSource === 'wallpaper' && !HAS_WALLPAPER_COLOR ? 'stash' : s.colorSource;
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const appName = Constants.expoConfig?.name ?? 'Stash';

  const run = async (task: () => Promise<void>, ok: string, fail: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
      showSnackbar(ok);
    } catch {
      showSnackbar(fail);
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const added = await importBackup();
      if (added != null) showSnackbar(added > 0 ? `Imported ${plural(added, 'item')}` : 'Nothing new to import');
    } catch {
      showSnackbar("Couldn't import that file");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 48 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.bar}>
        <BackPill label="Back" onPress={close} />
      </View>
      <Text variant="displaySmallEmphasized" accessibilityRole="header" style={styles.title}>
        Settings
      </Text>

      <Section title="Appearance">
        <Row icon="contrast" title="Theme" supporting={THEME_HINT[s.themeMode]} index={0} count={2}>
          <View style={styles.below}>
            <ButtonGroup items={THEME_ITEMS} value={s.themeMode} onChange={s.setThemeMode} accessibilityLabel="Theme" />
          </View>
        </Row>
        <Row icon={source === 'wallpaper' ? 'wallpaper' : 'palette'} title="Color" supporting={COLOR_HINT[source]} index={1} count={2}>
          <View style={styles.below}>
            <ButtonGroup items={COLOR_ITEMS} value={source} onChange={s.setColorSource} accessibilityLabel="Color source" />
            {source === 'seed' && <Swatches value={s.seedColor ?? DEFAULT_SEED} onChange={s.setSeedColor} />}
          </View>
        </Row>
      </Section>

      <Section title="Reading & feeds">
        <Row
          icon="menuBook"
          title="Open articles in reader mode"
          supporting="Clean text view instead of the web page"
          index={0}
          count={2}
          onPress={() => s.setReaderMode(!s.readerMode)}
          role="switch"
          checked={s.readerMode}
          trailing={<Switch value={s.readerMode} onValueChange={s.setReaderMode} decorative />}
        />
        <Row icon="rssFeed" title="Check feeds" supporting="When you open Feeds, at most every 3 hours" index={1} count={2} />
      </Section>

      <Section title="Data">
        <Row
          icon="upload"
          title="Export backup"
          supporting="Everything as a Stash JSON file"
          index={0}
          count={5}
          onPress={() => run(exportJson, 'Backup exported', "Couldn't export the backup")}
          trailing={<Ico name="chevronRight" color={colors.onSurfaceVariant} />}
        />
        <Row
          icon="bookmarks"
          title="Export bookmarks"
          supporting="Links as browser bookmarks HTML"
          index={1}
          count={5}
          onPress={() => run(exportHtml, 'Bookmarks exported', "Couldn't export bookmarks")}
          trailing={<Ico name="chevronRight" color={colors.onSurfaceVariant} />}
        />
        <Row
          icon="download"
          title="Import backup"
          supporting="Stash JSON or browser bookmarks HTML"
          index={2}
          count={5}
          onPress={onImport}
          trailing={<Ico name="chevronRight" color={colors.onSurfaceVariant} />}
        />
        <Row
          icon="link"
          title="Check saved links"
          supporting="Find links that no longer load"
          index={3}
          count={5}
          onPress={() => router.push('/links-check')}
          trailing={<Ico name="chevronRight" color={colors.onSurfaceVariant} />}
        />
        <Row
          icon="database"
          title="Storage"
          supporting={`${plural(totals.all, 'item')} · ${plural(totals.highlights, 'highlight')} · ${plural(feedCount, 'feed')}`}
          index={4}
          count={5}
        />
      </Section>

      <Section title="About">
        <Row icon="info" title={appName} supporting={`Version ${version}`} index={0} count={2} />
        <Row icon="bookmark" title="Made to read & remember" supporting="Local-only: your stash never leaves this phone" index={1} count={2} />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="titleSmallEmphasized" color="primary" accessibilityRole="header" style={styles.overline}>
        {title}
      </Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

type RowProps = {
  icon: IconName;
  title: string;
  supporting?: string;
  index: number;
  count: number;
  trailing?: React.ReactNode;
  /** Content under the title row (button groups, swatches). */
  children?: React.ReactNode;
  onPress?: () => void;
  role?: 'button' | 'switch';
  checked?: boolean;
};

/** A connected-group list row: tonal icon tile, title + supporting text, trailing control. */
function Row({ icon, title, supporting, index, count, trailing, children, onPress, role = 'button', checked }: RowProps) {
  const { colors } = useAppTheme();
  const corners = rowCorners(index, count);
  const content = (
    <>
      <View style={styles.rowTop}>
        <View style={[styles.tile, { backgroundColor: colors.secondaryContainer }]}>
          <Ico name={icon} size={22} color={colors.onSecondaryContainer} />
        </View>
        <View style={styles.rowText}>
          <Text variant="titleMediumEmphasized">{title}</Text>
          {!!supporting && (
            <Text variant="bodyMedium" color="onSurfaceVariant">
              {supporting}
            </Text>
          )}
        </View>
        {trailing}
      </View>
      {children}
    </>
  );

  if (!onPress) {
    return (
      <View
        accessible={!children}
        style={[
          styles.row,
          {
            backgroundColor: colors.surfaceContainer,
            borderTopLeftRadius: corners[0],
            borderTopRightRadius: corners[1],
            borderBottomRightRadius: corners[2],
            borderBottomLeftRadius: corners[3],
          },
        ]}
      >
        {content}
      </View>
    );
  }
  return (
    <PressRow corners={corners} onPress={onPress} label={title} role={role} checked={checked}>
      {content}
    </PressRow>
  );
}

function PressRow({
  corners,
  onPress,
  label,
  role,
  checked,
  children,
}: {
  corners: Corners4;
  onPress: () => void;
  label: string;
  role: 'button' | 'switch';
  checked?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  const { gesture, progress } = usePressMorph({ kind: 'card', corner: 0, pressedScale: 0.98, onPress });
  const morph = useAnimatedStyle(() => {
    const p = progress.get();
    return { ...cornerStyle(corners, MotionSpec.cardPressCorner, p), transform: [{ scale: 1 + (0.98 - 1) * p }] };
  });
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole={role}
        accessibilityLabel={label}
        accessibilityState={role === 'switch' ? { checked } : undefined}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && onPress()}
        style={[styles.row, { backgroundColor: colors.surfaceContainer }, morph]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

/** Seed swatches, each previewing the primary it produces in the current theme. */
function Swatches({ value, onChange }: { value: string; onChange: (seed: string) => void }) {
  const { dark } = useAppTheme();
  const tones = useMemo(
    () => SEED_COLORS.map((seed) => ({ seed, ...pick(vibrantPalette(seed, dark)) })),
    [dark],
  );
  return (
    <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel="Seed color">
      {tones.map((t, i) => (
        <Swatch key={t.seed} label={`Seed color ${i + 1}`} color={t.primary} mark={t.onPrimary} selected={t.seed.toLowerCase() === value.toLowerCase()} onPress={() => onChange(t.seed)} />
      ))}
    </View>
  );
}

const pick = (p: ReturnType<typeof vibrantPalette>) => ({ primary: p.primary, onPrimary: p.onPrimary });

const SWATCH = 36;

function Swatch({ label, color, mark, selected, onPress }: { label: string; color: string; mark: string; selected: boolean; onPress: () => void }) {
  const sel = useSelection(selected);
  // Selected swatch morphs from a circle to a rounded square and shows a check.
  const shape = useAnimatedStyle(() => ({ borderRadius: SWATCH / 2 - 6 * sel.shape.get() }));
  const check = useAnimatedStyle(() => ({ opacity: sel.color.get(), transform: [{ scale: 0.4 + 0.6 * sel.shape.get() }] }));
  return (
    <PressableSurface
      corner={SWATCH / 2}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={styles.swatchHit}
    >
      <Animated.View style={[styles.swatch, { backgroundColor: color }, shape]}>
        <Animated.View style={check}>
          <Ico name="check" size={20} color={mark} />
        </Animated.View>
      </Animated.View>
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 12 },
  title: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },
  section: { paddingHorizontal: Layout.gutter, paddingTop: 20 },
  overline: { paddingHorizontal: 8, paddingBottom: 10 },
  group: { gap: 2 },
  row: { paddingHorizontal: 16, paddingVertical: 14, gap: 12, overflow: 'hidden' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rowText: { flex: 1, gap: 2 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  below: { gap: 12 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  swatchHit: { width: SWATCH + 4, height: SWATCH + 4, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: SWATCH, height: SWATCH, alignItems: 'center', justifyContent: 'center' },
});
