import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';
import { Linking } from 'react-native';

/**
 * App updates from GitHub Releases. Each release (tag `vX.Y.Z`) carries a signed APK; the
 * app compares the newest tag with its own version and, on request, opens the APK link so
 * Android downloads it and offers to install it over this one (data is kept).
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

/** Starts the download of a release: the APK if it has one, else its release page. */
export function installRelease(r: Release) {
  return Linking.openURL(r.apkUrl ?? r.pageUrl);
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
