import { getShareExtensionKey } from 'expo-share-intent';

/** Route share-sheet deep links (stash://dataUrl=<key>) to the capture screen. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) return '/capture';
    return path;
  } catch {
    return '/';
  }
}
