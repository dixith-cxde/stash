import * as Haptics from 'expo-haptics';

/**
 * Haptics paired with motion (docs/animation.md §9). Fire when the action takes effect
 * (selection, threshold, commit), not when the spring settles.
 */
export const haptic = {
  /** Filter, chip or segment selection changed inside content. Not for tab switches: Android's nav bars stay silent. */
  select: () => void Haptics.selectionAsync(),
  /** Something toggled on (favorite, checkbox), or a gesture crossed its commit threshold. */
  toggle: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
