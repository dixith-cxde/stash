/**
 * Material 3 Expressive shape, size and spacing tokens (dp).
 * Corner scale from androidx.compose.material3 tokens/ShapeTokens.kt.
 * Motion tokens live in src/motion/tokens.ts (see docs/animation.md).
 */

export const Corner = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  largeIncreased: 20,
  extraLarge: 28,
  extraLargeIncreased: 32,
  extraExtraLarge: 48,
  /** Fully rounded: pass the element height / 2, or use this as "large enough". */
  full: 9999,
} as const;

/**
 * Button sizes (androidx Button*Tokens): height, icon, round rest corner is `full`,
 * square-variant rest corner, and the corner while pressed.
 */
export const ButtonSize = {
  xs: { height: 32, icon: 20, square: Corner.medium, pressed: Corner.small },
  s: { height: 40, icon: 20, square: Corner.medium, pressed: Corner.small },
  m: { height: 56, icon: 24, square: Corner.large, pressed: Corner.medium },
  l: { height: 96, icon: 32, square: Corner.extraLarge, pressed: Corner.large },
  xl: { height: 136, icon: 40, square: Corner.extraLarge, pressed: Corner.large },
} as const;
export type ButtonSizeName = keyof typeof ButtonSize;

export const Spacing = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Stash layout constants taken from the design canvas (390-wide artboards). */
export const Layout = {
  /** Screen side gutter for content. */
  gutter: 16,
  /** Text column inset (titles, section headers). */
  textInset: 24,
  /** Floating nav bar: 64dp, connected to the FAB (outer ends round, facing ends 8dp), 16dp from the edges, 20dp above the bottom inset. */
  navBarHeight: 64,
  navBarBottom: 20,
  /** Scroll content bottom padding so the last row clears the floating bar. */
  navBarClearance: 120,
  /** Gap between items in grids and stacks. */
  gridGap: 8,
} as const;
