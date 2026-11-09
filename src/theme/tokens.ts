/**
 * Material 3 Expressive design tokens.
 *
 * Values mirror androidx.compose.material3 1.5 token files
 * (ExpressiveMotionTokens, ShapeTokens, TypeScaleTokens). Compose components rendered
 * through @expo/ui already get these from MaterialExpressiveTheme; these constants are
 * for the few surfaces drawn with plain React Native views (Reanimated, PDF chrome).
 */
import type { WithSpringConfig } from 'react-native-reanimated';

type Spring = Pick<WithSpringConfig, 'dampingRatio' | 'stiffness'>;

/** MotionScheme.expressive() — spatial springs overshoot, effects springs are critically damped. */
export const ExpressiveMotion = {
  fastSpatial: { dampingRatio: 0.6, stiffness: 800 },
  defaultSpatial: { dampingRatio: 0.8, stiffness: 380 },
  slowSpatial: { dampingRatio: 0.8, stiffness: 200 },
  fastEffects: { dampingRatio: 1, stiffness: 3800 },
  defaultEffects: { dampingRatio: 1, stiffness: 1600 },
  slowEffects: { dampingRatio: 1, stiffness: 800 },
} as const satisfies Record<string, Spring>;

/** Corner radius scale in dp, including the Expressive "increased" steps. */
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
  full: 9999,
} as const;

/** Button / icon-button size scale (height, icon) in dp. */
export const ButtonSize = {
  xs: { height: 32, icon: 20 },
  s: { height: 40, icon: 20 },
  m: { height: 56, icon: 24 },
  l: { height: 96, icon: 32 },
  xl: { height: 136, icon: 40 },
} as const;

export const Spacing = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Floating toolbar spec: 64dp pill, 16dp from screen edge. */
export const FloatingToolbar = { height: 64, edgeMargin: 16 } as const;
