/** Image helpers for the article reader. Pure, no React. */
import { resolveUrl } from '@/features/feeds/parse';

/** Tracking pixels, analytics beacons and spacer images: never worth a request. */
const TRACKER =
  /(^|[/._-])(pixel|tracking|tracker|beacon|spacer|blank)([/._?-]|$)|1x1|\/b\.gif|doubleclick\.net|google-analytics\.com|facebook\.com\/tr|feedburner\.com\/~r|feeds\.feedburner|stats\.wp\.com|pixel\.wp\.com|\/count\.gif|quantserve|scorecardresearch/i;

/** Small decorations that render as noise at full width: emoji, smileys, share icons, avatars. */
const ICON = /\/(emoji|emojis|smilies|smileys|icons?|avatars?|gravatar|badges?)\/|gravatar\.com\/avatar|s\.w\.org\/images\/core\/emoji|\.ico(\?|$)/i;

/** A size hint in the URL ("?w=32", "-24x24.png", "/s16/") below this is an icon. */
const MIN_SIDE = 80;

function tinyBySize(url: string): boolean {
  const q = /[?&](?:w|width|h|height|size|s)=(\d+)(?:&|$)/i.exec(url);
  if (q && parseInt(q[1], 10) < MIN_SIDE) return true;
  const d = /[-_/](\d{1,4})x(\d{1,4})(?:[._/-]|$)/.exec(url);
  if (d && (parseInt(d[1], 10) < MIN_SIDE || parseInt(d[2], 10) < MIN_SIDE)) return true;
  return false;
}

/**
 * The absolute http(s) URL to show for a Markdown image, resolved against the article URL, or
 * null for data URIs, trackers and tiny icons.
 */
export function readerImageUrl(src: string | null | undefined, base: string | null | undefined): string | null {
  const raw = (src ?? '').trim().replace(/ /g, '%20');
  if (!raw || /^data:/i.test(raw)) return null;
  const abs = /^https?:\/\//i.test(raw) ? raw : resolveUrl(raw, base ?? null);
  if (!abs || !/^https?:\/\//i.test(abs)) return null;
  if (TRACKER.test(abs) || ICON.test(abs) || tinyBySize(abs)) return null;
  return abs;
}

/** Natural size below which a loaded image is treated as an icon and hidden. */
export const isTinyImage = (w: number, h: number) => w > 0 && h > 0 && w < 64 && h < 64;

/** Display aspect ratio for an image, kept within a readable band (very tall images letterbox). */
export function displayRatio(w: number, h: number): { ratio: number; clamped: boolean } {
  if (!(w > 0 && h > 0)) return { ratio: 16 / 9, clamped: false };
  const r = w / h;
  const ratio = Math.max(0.6, Math.min(r, 3));
  return { ratio, clamped: ratio !== r };
}

/** Same image? Ignores protocol, query strings and common resize suffixes. */
export function sameImage(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const key = (u: string) =>
    u
      .replace(/^https?:\/\/(www\.)?/i, '')
      .replace(/[?#].*$/, '')
      .replace(/([-_](\d{2,4}x\d{2,4}|thm|thumb|small|medium|large))(?=\.\w+$)/i, '')
      .toLowerCase();
  return key(a) === key(b);
}
