import {
  Column,
  FlowRow,
  isDynamicColorAvailable,
  ListItem,
  SnackbarHost,
  type SnackbarHostRef,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
  size,
  verticalScroll,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useRef, useState } from 'react';

import { Ico } from '@/components/Ico';
import { TopBar } from '@/components/TopBar';
import { exportHtml, exportJson, importBackup } from '@/features/backup/backup';
import { type HomeLayout, SEED_COLORS, type ThemeMode, useSettings } from '@/state/settings';
import { AppHost, useAppTheme } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { expressivePalette } from '@/theme/palette';

import { ConnectedButtonGroup, type MaterialShapeName, MorphingShape } from '../../modules/expressive';

function Section({ children }: { children: string }) {
  const { colors } = useAppTheme();
  return (
    <Text style={{ typography: 'titleSmall', fontWeight: '700' }} color={colors.primary} modifiers={[padding(24, 24, 24, 8)]}>
      {children.toUpperCase()}
    </Text>
  );
}

function Row({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle?: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <ListItem
      colors={{ containerColor: colors.surfaceContainerLow }}
      modifiers={[padding(16, 2, 16, 2), clip(Shapes.RoundedCorner(24)), clickable(onPress)]}>
      <ListItem.LeadingContent>
        <Ico name={icon} tint={colors.onSurfaceVariant} />
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <Text style={{ typography: 'bodyLarge' }}>{title}</Text>
      </ListItem.HeadlineContent>
      {subtitle ? (
        <ListItem.SupportingContent>
          <Text color={colors.onSurfaceVariant}>{subtitle}</Text>
        </ListItem.SupportingContent>
      ) : null}
    </ListItem>
  );
}

const SWATCH_SHAPES: MaterialShapeName[] = ['cookie9Sided', 'clover4Leaf', 'sunny', 'softBurst', 'pentagon', 'puffy', 'cookie6Sided', 'ghostish'];

export default function SettingsScreen() {
  const { colors, dark } = useAppTheme();
  const settings = useSettings();
  const snackbar = useRef<SnackbarHostRef>(null);
  const [busy, setBusy] = useState(false);

  const run = async (label: string, task: () => Promise<number | null | void>) => {
    if (busy) return;
    setBusy(true);
    try {
      const n = await task();
      if (typeof n === 'number') await snackbar.current?.showSnackbar({ message: `${label}: ${n} items added` });
    } catch (e) {
      await snackbar.current?.showSnackbar({ message: `${label} failed: ${(e as Error).message}`, duration: 'long' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppHost style={{ flex: 1 }}>
      <Column modifiers={[fillMaxSize()]}>
        <TopBar title="Settings" />
        <Column modifiers={[weight(1), verticalScroll(), padding(0, 0, 0, 48)]}>
          <Section>Theme</Section>
          <Column modifiers={[padding(16, 0, 16, 0)]}>
            <ConnectedButtonGroup
              options={[
                { key: 'system', label: 'System' },
                { key: 'light', label: 'Light' },
                { key: 'dark', label: 'Dark' },
              ]}
              selected={[settings.themeMode]}
              onSelectionChange={([k]) => k && settings.setThemeMode(k as ThemeMode)}
            />
          </Column>

          <Section>Color</Section>
          <FlowRow horizontalArrangement={{ spacedBy: 12 }} verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), padding(24, 0, 24, 0)]}>
            {isDynamicColorAvailable ? (
              <MorphingShape
                shape="cookie12Sided"
                morphTo="sunny"
                morphed={settings.seedColor === null}
                rotation={45}
                color={settings.seedColor === null ? colors.primary : colors.surfaceContainerHighest}
                modifiers={[size(56, 56), clickable(() => settings.setSeedColor(null), { indication: false })]}>
                <Ico name="palette" tint={settings.seedColor === null ? colors.onPrimary : colors.onSurfaceVariant} label="Wallpaper colors" />
              </MorphingShape>
            ) : null}
            {SEED_COLORS.map((seed, i) => {
              const p = expressivePalette(seed, dark);
              const on = settings.seedColor === seed;
              return (
                <MorphingShape
                  key={seed}
                  shape={SWATCH_SHAPES[i % SWATCH_SHAPES.length]}
                  morphTo="cookie12Sided"
                  morphed={on}
                  rotation={60}
                  color={p.primaryContainer}
                  modifiers={[size(56, 56), clickable(() => settings.setSeedColor(seed), { indication: false })]}>
                  <MorphingShape shape="cookie12Sided" color={p.primary} modifiers={[size(28, 28)]}>
                    {on ? <Ico name="check" size={18} tint={p.onPrimary} /> : null}
                  </MorphingShape>
                </MorphingShape>
              );
            })}
          </FlowRow>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }} modifiers={[padding(24, 8, 24, 0)]}>
            {isDynamicColorAvailable
              ? 'Wallpaper colors follow your Android theme. Seed colors use the Material 3 Expressive scheme.'
              : 'Seed colors use the Material 3 Expressive scheme.'}
          </Text>

          <Section>Feed</Section>
          <Column modifiers={[padding(16, 0, 16, 0)]}>
            <ConnectedButtonGroup
              options={[
                { key: 'cards', label: 'Cards', icon: <Ico name="viewAgenda" size={18} /> },
                { key: 'compact', label: 'Compact', icon: <Ico name="list" size={18} /> },
              ]}
              selected={[settings.homeLayout]}
              onSelectionChange={([k]) => k && settings.setHomeLayout(k as HomeLayout)}
            />
          </Column>

          <Section>Backup</Section>
          <Column verticalArrangement={{ spacedBy: 4 }}>
            <Row icon="download" title="Export backup (JSON)" subtitle="Everything: folders, lists, tags, highlights" onPress={() => void run('Export', exportJson)} />
            <Row icon="public" title="Export bookmarks (HTML)" subtitle="Works with browsers and other bookmark apps" onPress={() => void run('Export', exportHtml)} />
            <Row
              icon="upload"
              title="Import"
              subtitle="Stash backup, or bookmarks HTML from Chrome, Pocket, Raindrop…"
              onPress={() => void run('Import', importBackup)}
            />
          </Column>

          <Section>About</Section>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }} modifiers={[padding(24, 0, 24, 0)]}>
            Stash keeps everything on this device. Share links, PDFs and images to it from any app, or select text and choose
            “Save to Stash”.
          </Text>
        </Column>
        <SnackbarHost ref={snackbar} />
      </Column>
    </AppHost>
  );
}
