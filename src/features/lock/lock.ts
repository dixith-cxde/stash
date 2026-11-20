import { requireOptionalNativeModule } from 'expo';
import type * as LocalAuthenticationType from 'expo-local-authentication';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { useSettings } from '@/state/settings';

/**
 * App lock: Android's own biometric prompt (fingerprint or face), falling back to the
 * device's PIN, pattern or password. Stash never sees or stores any of it.
 */

/** Null in a build without the native module (an older dev build): the lock stays off. */
const LocalAuthentication: typeof LocalAuthenticationType | null = requireOptionalNativeModule('ExpoLocalAuthentication')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-local-authentication')
  : null;

type LockState = {
  /** The lock screen covers the app. */
  locked: boolean;
  /** The system prompt is up (it may take the app to the background for the PIN screen). */
  authenticating: boolean;
};

export const useLock = create<LockState>(() => ({
  // Cold start with the lock on: covered before the first frame.
  locked: !!LocalAuthentication && useSettings.getState().appLock,
  authenticating: false,
}));

/** The device has a screen lock or enrolled biometrics, so the app lock can work. */
export async function canLock(): Promise<boolean> {
  if (!LocalAuthentication) return false;
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) > LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Shows the system prompt. True when the person proved it's them. */
export async function authenticate(promptMessage = 'Unlock Stash'): Promise<boolean> {
  if (!LocalAuthentication || useLock.getState().authenticating) return false;
  useLock.setState({ authenticating: true });
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage,
      promptSubtitle: 'Use your fingerprint, face or screen lock',
      // Falls back to the device PIN / pattern / password.
      disableDeviceFallback: false,
      requireConfirmation: false,
    });
    return r.success;
  } catch {
    return false;
  } finally {
    // The PIN screen sends the app to the background and back; ignore that return.
    lastAuthEnd = Date.now();
    useLock.setState({ authenticating: false });
  }
}

export async function unlock() {
  if (await authenticate()) useLock.setState({ locked: false });
}

let backgroundAt: number | null = null;
let lastAuthEnd = 0;
let pickers = 0;

/**
 * Runs a system picker (files, photos) without locking when it returns: the picker takes
 * the app to the background, but the person never left Stash.
 */
export async function keepUnlocked<T>(open: () => Promise<T>): Promise<T> {
  pickers++;
  try {
    return await open();
  } finally {
    // The 'active' event can land just after the picker's promise resolves.
    setTimeout(() => pickers--, 1000);
  }
}

/** Locks again after the app was away for `lockAfter` seconds. Call once at startup. */
export function installLockWatcher() {
  return AppState.addEventListener('change', (state) => {
    const { appLock, lockAfter } = useSettings.getState();
    if (!appLock) return;
    if (state === 'background') {
      if (useLock.getState().authenticating || pickers > 0) return;
      backgroundAt = Date.now();
      // "Right away": cover the app now, so it never flashes its content on return.
      if (lockAfter === 0) useLock.setState({ locked: true });
      return;
    }
    if (state !== 'active' || backgroundAt == null) return;
    const away = Date.now() - backgroundAt;
    backgroundAt = null;
    if (Date.now() - lastAuthEnd < 1500) return;
    if (away >= lockAfter * 1000) useLock.setState({ locked: true });
  });
}
