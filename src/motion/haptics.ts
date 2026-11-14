import * as Haptics from 'expo-haptics';

/**
 * Haptics for the main actions only (user rule): saving, cancelling/discarding and deleting.
 * Never on navigation, tab or filter changes, toggles, checkboxes, chips or drags.
 * Fire when the action takes effect, not when an animation settles.
 */
export const haptic = {
  /** Something was saved (capture, note, edit). */
  save: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  /** A pending action was cancelled or discarded (Cancel, Discard, Undo). */
  cancel: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** Something was deleted. */
  remove: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
