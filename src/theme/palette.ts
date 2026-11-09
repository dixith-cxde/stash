import type { MaterialColors } from '@expo/ui/jetpack-compose';
import { argbFromHex, Hct, hexFromArgb, SchemeExpressive } from '@material/material-color-utilities';

const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'background', 'onBackground', 'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
  'surfaceTint', 'inverseSurface', 'inverseOnSurface',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'outline', 'outlineVariant', 'scrim',
  'surfaceBright', 'surfaceDim', 'surfaceContainer', 'surfaceContainerHigh',
  'surfaceContainerHighest', 'surfaceContainerLow', 'surfaceContainerLowest',
  'primaryFixed', 'primaryFixedDim', 'onPrimaryFixed', 'onPrimaryFixedVariant',
  'secondaryFixed', 'secondaryFixedDim', 'onSecondaryFixed', 'onSecondaryFixedVariant',
  'tertiaryFixed', 'tertiaryFixedDim', 'onTertiaryFixed', 'onTertiaryFixedVariant',
] as const satisfies readonly (keyof MaterialColors)[];

const cache = new Map<string, MaterialColors>();

/**
 * Full Material palette from a seed using the *Expressive* scheme variant and the 2025
 * color spec — livelier hues than the TonalSpot variant that `Host seedColor` uses.
 */
export function expressivePalette(seed: string, dark: boolean): MaterialColors {
  const key = `${seed}:${dark}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const scheme = new SchemeExpressive(Hct.fromInt(argbFromHex(seed)), dark, 0, '2025');
  const out = {} as Record<string, string>;
  for (const role of ROLES) {
    out[role] = `${hexFromArgb((scheme as unknown as Record<string, number>)[role]).toUpperCase()}FF`;
  }
  const palette = out as MaterialColors;
  cache.set(key, palette);
  return palette;
}
