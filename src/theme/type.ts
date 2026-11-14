import type { TextStyle } from 'react-native';

/**
 * Google Sans Flex (ROND 50 static instances, registered by the expo-font plugin as
 * "GoogleSansFlex" with weights 400/500/600/700). Sizes are taken from the design canvas:
 * the Expressive look is large, tight, heavy display type over a calm body.
 *
 * The design draws display text at weight 800. Only a 700 instance ships today, so 800
 * resolves to 700 until an ExtraBold instance is added to assets/fonts.
 */
export const FONT_FAMILY = 'GoogleSansFlex';
export const MONO_FAMILY = 'monospace';

type Variant = Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing' | 'textTransform'>;

export const Type = {
  /** "Stash" on Home. */
  displayLarge: { fontSize: 52, lineHeight: 56, fontWeight: '800', letterSpacing: -1.5 },
  /** "Library". */
  displayMedium: { fontSize: 44, lineHeight: 50, fontWeight: '800', letterSpacing: -1.2 },
  /** Collection hero title. */
  displaySmall: { fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1 },
  /** Note title. */
  headlineLarge: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.5 },
  /** Item detail title, editor title. */
  headlineMedium: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 },
  /** Sheet title ("Save to Stash"). */
  headlineSmall: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.3 },
  /** Section headers ("Collections", "Highlights"). */
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  /** Markdown h2. */
  titleMediumEmphasized: { fontSize: 21, lineHeight: 26, fontWeight: '800' },
  /** Collection card name. */
  titleMedium: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  /** Feed card titles. */
  titleSmall: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  /** List row titles, button labels. */
  labelLarge: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  /** Chip labels, filter segments. */
  labelMedium: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  /** Meta lines ("theverge.com · 2h"). */
  labelSmall: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  /** Uppercase section labels ("SMART VIEWS"). */
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  /** Reading body (notes). */
  bodyLarge: { fontSize: 16, lineHeight: 25, fontWeight: '400' },
  /** Descriptions, subtitles. */
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  bodySmall: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  /** Quotes and highlights. */
  quote: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
} as const satisfies Record<string, Variant>;

export type TypeVariant = keyof typeof Type;
