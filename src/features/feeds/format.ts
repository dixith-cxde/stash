/** Reading speed for the estimate, in characters per minute (~230 words). */
const CHARS_PER_MIN = 1400;
/** Shorter than this is a teaser, not an article: no read time is shown. */
const MIN_ARTICLE_CHARS = 900;

/** "6 min read" estimate from article length, or null for teasers. */
export function readMinutes(chars: number): number | null {
  if (chars < MIN_ARTICLE_CHARS) return null;
  return Math.max(1, Math.round(chars / CHARS_PER_MIN));
}

/** "theverge.com" from a URL, for "Read on …". */
export function hostOf(url: string | null): string | null {
  if (!url) return null;
  const m = /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(url);
  return m ? m[1] : null;
}

/** Day bucket label for grouping the list: Today, Yesterday, then the weekday or date. */
export function dayLabel(d: Date, now = new Date()): string {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
