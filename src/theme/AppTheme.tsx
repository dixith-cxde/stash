import { Host, type HostProps, type MaterialColors, useMaterialColors } from '@expo/ui/jetpack-compose';
import { createContext, use, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '@/state/settings';

import { ExpressiveTheme } from '../../modules/expressive';
import { expressivePalette } from './palette';

type AppTheme = { colors: MaterialColors; dark: boolean; overrides?: MaterialColors };

const ThemeContext = createContext<AppTheme | null>(null);

/** Resolves the palette once at the root: dynamic (wallpaper) color, or an Expressive seed. */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useSettings((s) => s.themeMode);
  const seed = useSettings((s) => s.seedColor);
  const system = useColorScheme();
  const dark = mode === 'system' ? system === 'dark' : mode === 'dark';
  const dynamic = useMaterialColors({ colorScheme: dark ? 'dark' : 'light' });
  const value = useMemo<AppTheme>(() => {
    if (!seed) return { colors: dynamic, dark };
    const palette = expressivePalette(seed, dark);
    return { colors: palette, dark, overrides: palette };
  }, [seed, dark, dynamic]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useAppTheme(): AppTheme {
  const t = use(ThemeContext);
  if (!t) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return t;
}

export const useColors = () => useAppTheme().colors;

/**
 * Compose root for a screen region: applies the app's color scheme / Expressive palette,
 * the Google Sans Flex type scale and MotionScheme.expressive().
 */
export function AppHost({ children, ...rest }: Omit<HostProps, 'colorScheme' | 'colorOverrides'>) {
  const { dark, overrides } = useAppTheme();
  return (
    <Host colorScheme={dark ? 'dark' : 'light'} colorOverrides={overrides} {...rest}>
      <ExpressiveTheme>{children}</ExpressiveTheme>
    </Host>
  );
}
