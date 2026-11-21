import { Redirect } from 'expo-router';
import type { ComponentType } from 'react';

/**
 * Dev screens (src/app/dev/*) exist as routes in every build, so a stash://dev/... link could
 * open them in a release build (dev/seed deletes data on mount). Release builds go Home instead.
 */
export function devOnly<P extends object>(Screen: ComponentType<P>) {
  function DevOnly(props: P) {
    return __DEV__ ? <Screen {...props} /> : <Redirect href="/" />;
  }
  return DevOnly;
}
