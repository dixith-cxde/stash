/**
 * Development-only warning. React Native's console writes to logcat in release builds too,
 * and these messages carry URLs and file paths, so release builds stay silent.
 */
export function devWarn(...args: unknown[]) {
  if (__DEV__) console.warn(...args);
}
