import { argbFromHex, Hct, hexFromArgb, SchemeExpressive, SchemeTonalSpot, TonalPalette } from '@material/material-color-utilities';

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

/**
 * Stash's seed: a sky blue. Run through the calm TonalSpot scheme it gives blue-gray neutral
 * surfaces (#0F1417 → #313539), a light blue primary, a blue-gray secondary for selection
 * and a muted violet tertiary (matched to the reference screens the palette was chosen from).
 */
export const STASH_SEED = '#79D0FD';
export const DEFAULT_SEED = STASH_SEED;

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

/** The default Stash palette: TonalSpot (2021 spec) from STASH_SEED, both themes. */
function tonalSpotPalette(seed: string, dark: boolean): ColorRoles {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seed)), dark, 0, '2021');
  const out = {} as ColorRoles;
  for (const role of ROLES) out[role] = hex((scheme as unknown as Record<ColorRole, number>)[role]);
  return out;
}

export const STASH_PALETTE: Record<'light' | 'dark', ColorRoles> = {
  dark: tonalSpotPalette(STASH_SEED, true),
  light: tonalSpotPalette(STASH_SEED, false),
};

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
export const SEED_COLORS = [STASH_SEED, '#6750A4', '#B3261E', '#7D5260', '#006A6A', '#386A20', '#8B5000', '#0061A4', '#984061'];

/** `#RRGGBB` + alpha 0..1 → `#RRGGBBAA`. */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color.slice(0, 7)}${a.toUpperCase()}`;
}

/**
 * Highlight swatches (design: yellow #5C4E00/#FFF3B0, blue #11365C/#CFE4FF…): one hue per
 * highlight color at container/content tones for each theme.
 */
const HIGHLIGHT_SEEDS = { yellow: '#776500', green: '#386A20', blue: '#2E5E8C', pink: '#984061', purple: '#6750A4' } as const;

export const HIGHLIGHT_TONES = Object.fromEntries(
  Object.entries(HIGHLIGHT_SEEDS).map(([k, seed]) => {
    const d = collectionTones(seed, true);
    const l = collectionTones(seed, false);
    return [k, { dark: { bg: d.container, fg: d.onContainer }, light: { bg: l.container, fg: l.onContainer } }];
  }),
) as Record<keyof typeof HIGHLIGHT_SEEDS, Record<'dark' | 'light', { bg: string; fg: string }>>;
