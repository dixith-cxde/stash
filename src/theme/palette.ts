import { argbFromHex, Hct, hexFromArgb, SchemeExpressive, TonalPalette } from '@material/material-color-utilities';

export const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'background', 'onBackground', 'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
  'surfaceTint', 'inverseSurface', 'inverseOnSurface',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'outline', 'outlineVariant', 'scrim', 'shadow',
  'surfaceBright', 'surfaceDim', 'surfaceContainer', 'surfaceContainerHigh',
  'surfaceContainerHighest', 'surfaceContainerLow', 'surfaceContainerLowest',
  'primaryFixed', 'primaryFixedDim', 'onPrimaryFixed', 'onPrimaryFixedVariant',
  'secondaryFixed', 'secondaryFixedDim', 'onSecondaryFixed', 'onSecondaryFixedVariant',
  'tertiaryFixed', 'tertiaryFixedDim', 'onTertiaryFixed', 'onTertiaryFixedVariant',
] as const;

export type ColorRole = (typeof ROLES)[number];
/** Material color roles as `#RRGGBB`. */
export type ColorRoles = Record<ColorRole, string>;

export const DEFAULT_SEED = '#6750A4';

const FIXED = {
  primaryFixed: '#EADDFF', primaryFixedDim: '#D0BCFF', onPrimaryFixed: '#21005D', onPrimaryFixedVariant: '#4F378B',
  secondaryFixed: '#E8DEF8', secondaryFixedDim: '#CCC2DC', onSecondaryFixed: '#1D192B', onSecondaryFixedVariant: '#4A4458',
  tertiaryFixed: '#FFD8E4', tertiaryFixedDim: '#EFB8C8', onTertiaryFixed: '#31111D', onTertiaryFixedVariant: '#633B48',
} as const;

/**
 * The Stash palette: the M3 baseline scheme the design canvas is drawn in
 * (surface #141218, primary #D0BCFF, primaryContainer #4F378B…). Used unless the user picks
 * wallpaper color or a custom seed in Settings.
 */
export const STASH_PALETTE: Record<'light' | 'dark', ColorRoles> = {
  dark: {
    primary: '#D0BCFF', onPrimary: '#381E72', primaryContainer: '#4F378B', onPrimaryContainer: '#EADDFF', inversePrimary: '#6750A4',
    secondary: '#CCC2DC', onSecondary: '#332D41', secondaryContainer: '#4A4458', onSecondaryContainer: '#E8DEF8',
    tertiary: '#EFB8C8', onTertiary: '#492532', tertiaryContainer: '#633B48', onTertiaryContainer: '#FFD8E4',
    background: '#141218', onBackground: '#E6E0E9', surface: '#141218', onSurface: '#E6E0E9',
    surfaceVariant: '#49454F', onSurfaceVariant: '#CAC4D0', surfaceTint: '#D0BCFF',
    inverseSurface: '#E6E0E9', inverseOnSurface: '#322F35',
    error: '#F2B8B5', onError: '#601410', errorContainer: '#8C1D18', onErrorContainer: '#F9DEDC',
    outline: '#938F99', outlineVariant: '#49454F', scrim: '#000000', shadow: '#000000',
    surfaceBright: '#3B383E', surfaceDim: '#141218', surfaceContainerLowest: '#0F0D13', surfaceContainerLow: '#1D1B20',
    surfaceContainer: '#211F26', surfaceContainerHigh: '#2B2930', surfaceContainerHighest: '#36343B',
    ...FIXED,
  },
  light: {
    primary: '#6750A4', onPrimary: '#FFFFFF', primaryContainer: '#EADDFF', onPrimaryContainer: '#4F378B', inversePrimary: '#D0BCFF',
    secondary: '#625B71', onSecondary: '#FFFFFF', secondaryContainer: '#E8DEF8', onSecondaryContainer: '#4A4458',
    tertiary: '#7D5260', onTertiary: '#FFFFFF', tertiaryContainer: '#FFD8E4', onTertiaryContainer: '#633B48',
    background: '#FEF7FF', onBackground: '#1D1B20', surface: '#FEF7FF', onSurface: '#1D1B20',
    surfaceVariant: '#E7E0EC', onSurfaceVariant: '#49454F', surfaceTint: '#6750A4',
    inverseSurface: '#322F35', inverseOnSurface: '#F5EFF7',
    error: '#B3261E', onError: '#FFFFFF', errorContainer: '#F9DEDC', onErrorContainer: '#8C1D18',
    outline: '#79747E', outlineVariant: '#CAC4D0', scrim: '#000000', shadow: '#000000',
    surfaceBright: '#FEF7FF', surfaceDim: '#DED8E1', surfaceContainerLowest: '#FFFFFF', surfaceContainerLow: '#F7F2FA',
    surfaceContainer: '#F3EDF7', surfaceContainerHigh: '#ECE6F0', surfaceContainerHighest: '#E6E0E9',
    ...FIXED,
  },
};

const hex = (argb: number) => hexFromArgb(argb).toUpperCase();
const cache = new Map<string, ColorRoles>();

/**
 * Full Material palette from a seed using the *Expressive* scheme variant and the 2025
 * color spec: livelier hues than TonalSpot.
 */
export function expressivePalette(seed: string, dark: boolean): ColorRoles {
  const key = `${seed}:${dark}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const scheme = new SchemeExpressive(Hct.fromInt(argbFromHex(seed)), dark, 0, '2025');
  const out = {} as ColorRoles;
  for (const role of ROLES) out[role] = hex((scheme as unknown as Record<ColorRole, number>)[role]);
  cache.set(key, out);
  return out;
}

/** Colors for one collection, derived from its seed so they work in both themes. */
export type CollectionTones = {
  /** Card / hero background. */
  container: string;
  /** Text and icons on the container. */
  onContainer: string;
  /** The decorative shape behind the content. */
  accent: string;
};

const toneCache = new Map<string, CollectionTones>();

/**
 * The design's collection colors are one hue at fixed tones: dark theme container tone 30,
 * content tone 90, decoration tone 40 (e.g. purple #4F378B / #EADDFF / #6750A4).
 */
export function collectionTones(seed: string, dark: boolean): CollectionTones {
  const key = `${seed}:${dark}`;
  const hit = toneCache.get(key);
  if (hit) return hit;
  const hct = Hct.fromInt(argbFromHex(seed));
  const palette = TonalPalette.fromHueAndChroma(hct.hue, Math.max(hct.chroma, 36));
  const t = dark ? { container: 30, onContainer: 90, accent: 40 } : { container: 90, onContainer: 10, accent: 80 };
  const out = {
    container: hex(palette.tone(t.container)),
    onContainer: hex(palette.tone(t.onContainer)),
    accent: hex(palette.tone(t.accent)),
  };
  toneCache.set(key, out);
  return out;
}

/** Seeds users can pick for a collection (purple, rose, blue, olive, green, terracotta…). */
export const COLLECTION_SEEDS = [
  '#6750A4', '#7D5260', '#2E5E8C', '#776500', '#2F6A51', '#8B4A33', '#006A6A', '#984061',
] as const;

/** Expressive seed palette offered in Settings (besides dynamic color). */
export const SEED_COLORS = ['#6750A4', '#B3261E', '#7D5260', '#006A6A', '#386A20', '#8B5000', '#0061A4', '#984061'];

/** `#RRGGBB` + alpha 0..1 → `#RRGGBBAA`. */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color.slice(0, 7)}${a.toUpperCase()}`;
}
