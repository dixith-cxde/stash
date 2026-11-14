import { createContext, use, useEffect, useMemo, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { useSettings } from '@/state/settings';

import { ExpressiveModule } from '../../modules/expressive';
import { type ColorRole, type ColorRoles, DEFAULT_SEED, expressivePalette, ROLES, STASH_PALETTE } from './palette';

type AppTheme = { colors: ColorRoles; dark: boolean };

const ThemeContext = createContext<AppTheme | null>(null);

/**
 * Wallpaper colors from the platform. The seed fills every role with the Expressive scheme;
 * on Android 14+ the platform's own role colors replace them so Stash matches the system.
 */
function dynamicPalette(dark: boolean): ColorRoles | null {
  const native = ExpressiveModule?.getDynamicColors(dark);
  if (!native?.seed) return null;
  const out = { ...expressivePalette(native.seed, dark) };
  for (const role of ROLES) {
    const value = native[role];
    if (value) out[role as ColorRole] = value;
  }
  return out;
}

/** Bumps when the app returns to the foreground, so a wallpaper change is picked up. */
function useForegroundTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setTick((t) => t + 1));
    return () => sub.remove();
  }, []);
  return tick;
}

/** Resolves the palette once at the root: the Stash palette, wallpaper color, or an Expressive seed. */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useSettings((s) => s.themeMode);
  const source = useSettings((s) => s.colorSource);
  const seed = useSettings((s) => s.seedColor);
  const system = useColorScheme();
  const tick = useForegroundTick();
  const dark = mode === 'system' ? system === 'dark' : mode === 'dark';

  const value = useMemo<AppTheme>(() => {
    const stash = STASH_PALETTE[dark ? 'dark' : 'light'];
    const colors =
      source === 'wallpaper'
        ? (dynamicPalette(dark) ?? stash)
        : source === 'seed'
          ? expressivePalette(seed ?? DEFAULT_SEED, dark)
          : stash;
    return { colors, dark };
    // tick re-reads the wallpaper colors after the app comes back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, seed, dark, tick]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useAppTheme(): AppTheme {
  const t = use(ThemeContext);
  if (!t) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return t;
}

export const useColors = () => useAppTheme().colors;
