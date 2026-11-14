import type { TextStyle } from 'react-native';

/**
 * Google Sans Flex (ROND 50 static instances, registered by the expo-font plugin as
 * "GoogleSansFlex" with weights 400/500/600/700) set in the M3 Expressive type scale:
 * 15 baseline styles, 15 emphasized twins, and two editorial tokens. Values from androidx
 * TypeScaleTokens / TypographyTokens (docs/m3-expressive.md, Appendix A).
 */
export const FONT_FAMILY = 'GoogleSansFlex';
export const MONO_FAMILY = 'monospace';

type Variant = Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing' | 'textTransform'>;

export const Type = {
  // Baseline M3 type scale (androidx TypeScaleTokens).
  displayLarge: { fontSize: 57, lineHeight: 64, fontWeight: '400', letterSpacing: -0.2 },
  displayMedium: { fontSize: 45, lineHeight: 52, fontWeight: '400', letterSpacing: 0 },
  displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: '400', letterSpacing: 0 },
  headlineLarge: { fontSize: 32, lineHeight: 40, fontWeight: '400', letterSpacing: 0 },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '400', letterSpacing: 0 },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '400', letterSpacing: 0 },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '400', letterSpacing: 0 },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.2 },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0.2 },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.4 },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },

  // M3 Expressive emphasized twins: same size, heavier weight. Headings, selected and unread
  // states, key actions.
  displayLargeEmphasized: { fontSize: 57, lineHeight: 64, fontWeight: '500', letterSpacing: 0 },
  displayMediumEmphasized: { fontSize: 45, lineHeight: 52, fontWeight: '500', letterSpacing: 0 },
  displaySmallEmphasized: { fontSize: 36, lineHeight: 44, fontWeight: '500', letterSpacing: 0 },
  headlineLargeEmphasized: { fontSize: 32, lineHeight: 40, fontWeight: '500', letterSpacing: 0 },
  headlineMediumEmphasized: { fontSize: 28, lineHeight: 36, fontWeight: '500', letterSpacing: 0 },
  headlineSmallEmphasized: { fontSize: 24, lineHeight: 32, fontWeight: '500', letterSpacing: 0 },
  titleLargeEmphasized: { fontSize: 22, lineHeight: 28, fontWeight: '500', letterSpacing: 0 },
  titleMediumEmphasized: { fontSize: 16, lineHeight: 24, fontWeight: '700', letterSpacing: 0.15 },
  titleSmallEmphasized: { fontSize: 14, lineHeight: 20, fontWeight: '700', letterSpacing: 0.1 },
  bodyLargeEmphasized: { fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.15 },
  bodyMediumEmphasized: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.25 },
  bodySmallEmphasized: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.4 },
  labelLargeEmphasized: { fontSize: 14, lineHeight: 20, fontWeight: '700', letterSpacing: 0.1 },
  labelMediumEmphasized: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.5 },
  labelSmallEmphasized: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.5 },

  // Editorial treatments (docs/m3-expressive.md §4): tokens for the few hero moments only,
  // never for labels or plain information.
  /** The "Stash" wordmark on Home. */
  editorialLarge: { fontSize: 56, lineHeight: 60, fontWeight: '700', letterSpacing: -1.2 },
  /** Quotes and highlights pulled out of a text. */
  quote: { fontSize: 18, lineHeight: 26, fontWeight: '600', letterSpacing: 0 },
} as const satisfies Record<string, Variant>;

export type TypeVariant = keyof typeof Type;
