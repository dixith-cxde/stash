import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';
import { AppState, Linking } from 'react-native';
import { create } from 'zustand';

import { addUpdateProgressListener, ExpressiveModule } from '../../../modules/expressive';

/**
 * App updates from GitHub Releases. Each release (tag `vX.Y.Z`) carries a signed APK; the
 * app compares the newest tag with its own version and, on request, downloads the APK itself
 * (with progress) and hands it to Android's installer, which installs it over this one
 * (same signing key, data is kept). Without the native module it opens the link instead.
 * Network use: only when the user taps "Check for updates", plus at most once a day when
 * the app starts (one small request, no background work).
 */
export const REPO = 'dixith-cxde/stash';
export const RELEASES_URL = `https://github.com/${REPO}/releases`;
export const SOURCE_URL = `https://github.com/${REPO}`;

export const appVersion = Constants.expoConfig?.version ?? '0.0.0';
export const buildNumber = Constants.expoConfig?.android?.versionCode ?? null;

export type Release = { version: string; notes: string; apkUrl: string | null; pageUrl: string; date: string | null };

type GhRelease = {
  tag_name: string;
  body?: string | null;
  html_url: string;
  published_at?: string | null;
  draft?: boolean;
  prerelease?: boolean;
  assets?: { name: string; browser_download_url: string }[];
};

/** Newest published release, or throws when offline / rate limited. */
export async function latestRelease(): Promise<Release> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const r = (await res.json()) as GhRelease;
  const apk = r.assets?.find((a) => a.name.toLowerCase().endsWith('.apk'));
  return {
    version: r.tag_name.replace(/^v/i, ''),
    notes: r.body ?? '',
    apkUrl: apk?.browser_download_url ?? null,
    pageUrl: r.html_url,
    date: r.published_at ?? null,
  };
}

/** True when version `a` is newer than `b` (dotted numbers, missing parts count as 0). */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pb = b.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0;
  }
  return false;
}

export type UpdatePhase = 'idle' | 'downloading' | 'permission' | 'ready' | 'failed';

type UpdateState = {
  phase: UpdatePhase;
  /** 0..1 while downloading, null when the size is unknown. */
  progress: number | null;
  version: string | null;
  path: string | null;
  error: string | null;
};

/** The in-app update download, shared by Settings and Home. */
export const useUpdate = create<UpdateState>(() => ({ phase: 'idle', progress: null, version: null, path: null, error: null }));

/** Hands the downloaded APK to the installer, first asking for "Install unknown apps" if needed. */
export function installDownloaded() {
  const { path } = useUpdate.getState();
  const m = ExpressiveModule;
  if (!path || !m) return;
  if (!m.canInstallUpdates()) {
    useUpdate.setState({ phase: 'permission' });
    m.openInstallPermission();
    // Back from Settings with the switch on: go straight on to the installer.
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      sub.remove();
      if (m.canInstallUpdates()) installDownloaded();
      else useUpdate.setState({ phase: 'ready' });
    });
    return;
  }
  try {
    m.installUpdate(path);
    useUpdate.setState({ phase: 'ready' });
  } catch (e) {
    useUpdate.setState({ phase: 'failed', path: null, error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Downloads a release in the app and opens the installer when done. A second call while one
 * is running does nothing; a finished download of the same version is installed directly.
 */
export async function installRelease(r: Release) {
  const m = ExpressiveModule;
  // Older builds have the module but not the download functions: use the browser.
  if (!r.apkUrl || typeof m?.downloadUpdate !== 'function') {
    await Linking.openURL(r.apkUrl ?? r.pageUrl);
    return;
  }
  const s = useUpdate.getState();
  if (s.phase === 'downloading') return;
  if (s.path && s.version === r.version) {
    installDownloaded();
    return;
  }
  useUpdate.setState({ phase: 'downloading', progress: 0, version: r.version, path: null, error: null });
  const sub = addUpdateProgressListener((received, total) =>
    useUpdate.setState({ progress: total > 0 ? Math.min(1, received / total) : null }),
  );
  try {
    const path = await m!.downloadUpdate(r.apkUrl, `stash-${r.version}.apk`);
    useUpdate.setState({ phase: 'ready', progress: 1, path });
    installDownloaded();
  } catch (e) {
    useUpdate.setState({ phase: 'failed', progress: null, error: e instanceof Error ? e.message : String(e) });
  } finally {
    sub?.remove();
  }
}

/** The newest release if it is newer than this app, else null. */
export async function findUpdate(): Promise<Release | null> {
  const r = await latestRelease();
  return isNewer(r.version, appVersion) ? r : null;
}

const LAST_CHECK = 'updates.lastCheck';
const DAY = 24 * 60 * 60 * 1000;

/** Daily quiet check at startup. Errors are swallowed: being offline is normal. */
export async function dailyUpdateCheck(): Promise<Release | null> {
  if (__DEV__) return null;
  try {
    const last = Number((await Storage.getItem(LAST_CHECK)) ?? 0);
    if (Date.now() - last < DAY) return null;
    await Storage.setItem(LAST_CHECK, String(Date.now()));
    return await findUpdate();
  } catch {
    return null;
  }
}
