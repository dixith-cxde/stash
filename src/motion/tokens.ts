/**
 * Material 3 Expressive motion tokens for Reanimated 4. Read docs/animation.md before
 * changing anything here.
 *
 * Compose describes springs as (dampingRatio ζ, stiffness k) with an implicit mass of 1.
 * Reanimated 4.7 accepts either { stiffness, damping, mass } or { duration, dampingRatio },
 * never ζ with k, and defaults mass to 4. So every token is converted to
 * { mass: 1, stiffness: k, damping: 2·ζ·√k }.
 */
import { Easing, type WithSpringConfig } from 'react-native-reanimated';

export type SpringToken = WithSpringConfig & { mass: number; stiffness: number; damping: number };

/** Compose spring(dampingRatio, stiffness) → Reanimated physics config. */
export function spring(dampingRatio: number, stiffness: number): SpringToken {
  'worklet';
  return { mass: 1, stiffness, damping: 2 * dampingRatio * Math.sqrt(stiffness) };
}

/** Effects springs never overshoot, even when a release velocity points away from the target. */
const effects = (stiffness: number): SpringToken => ({ ...spring(1, stiffness), overshootClamping: true });

/**
 * MotionScheme.expressive(): androidx compose material3 tokens/ExpressiveMotionTokens.kt.
 * Spatial = position, size, scale, rotation, corner/shape. Effects = color, opacity.
 */
export const Spring = {
  fastSpatial: spring(0.6, 800),
  defaultSpatial: spring(0.8, 380),
  slowSpatial: spring(0.8, 200),
  fastEffects: effects(3800),
  defaultEffects: effects(1600),
  slowEffects: effects(800),
} as const;
export type SpringName = keyof typeof Spring;

/** MotionScheme.standard() spatial springs (near-critical): used when reduced motion is on. */
export const StandardSpring = {
  fastSpatial: spring(0.9, 1400),
  defaultSpatial: spring(0.9, 700),
  slowSpatial: spring(0.9, 300),
} as const;

/** Component-specific springs that aren't scheme tokens. */
export const ComponentSpring = {
  /** LoadingIndicator morph: spring(0.6, 200). */
  loaderMorph: spring(0.6, 200),
  /** Carousel / rail snap: StiffnessMediumLow, critically damped. */
  carouselSnap: spring(1, 400),
} as const;

/** Duration tokens (ms), tokens/MotionTokens.kt. Only for loops, sequences and progress maps. */
export const Duration = {
  short1: 50, short2: 100, short3: 150, short4: 200,
  medium1: 250, medium2: 300, medium3: 350, medium4: 400,
  long1: 450, long2: 500, long3: 550, long4: 600,
  extraLong1: 700, extraLong2: 800, extraLong3: 900, extraLong4: 1000,
} as const;

/** Easing tokens, tokens/MotionTokens.kt. */
export const Ease = {
  emphasized: Easing.bezier(0.2, 0, 0, 1),
  emphasizedDecelerate: Easing.bezier(0.05, 0.7, 0.1, 1),
  emphasizedAccelerate: Easing.bezier(0.3, 0, 0.8, 0.15),
  standard: Easing.bezier(0.2, 0, 0, 1),
  standardDecelerate: Easing.bezier(0, 0, 0, 1),
  standardAccelerate: Easing.bezier(0.3, 0, 1, 1),
  /** Predictive back commit. */
  backCommit: Easing.bezier(0.1, 0.1, 0, 1),
  linear: Easing.linear,
} as const;

/** Values from component specs used by the motion primitives. */
export const MotionSpec = {
  /** ButtonGroup: the pressed segment grows by 15% of its width. */
  buttonGroupExpandedRatio: 0.15,
  /** Card press (design canvas): scale and corner while held. */
  cardPressScale: 0.97,
  cardPressCorner: 14,
  /** Buttons and icon buttons dip this far while pressed (Pixel-style press scale). */
  buttonPressScale: 0.94,
  /** Fade through: incoming screen scales 0.92 → 1. */
  fadeThroughScale: 0.92,
  /** Shared axis slide distance (dp). */
  sharedAxisDistance: 30,
  /** Container transform scrim opacity. */
  scrimOpacity: 0.32,
  /** Predictive back: minimum scale and edge margin (dp). */
  backMinScale: 0.9,
  backMargin: 8,
  /** Loading indicator. */
  loaderMorphIntervalMs: 650,
  loaderRotationMs: 4666,
} as const;
