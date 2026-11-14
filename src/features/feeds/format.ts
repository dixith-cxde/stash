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

/** "Article URL: https://…", "Points: 14", "# Comments: 0": link-aggregator boilerplate. */
const BOILERPLATE = /(^|\s)#?\s?[A-Za-z][\w ]{0,20}:\s*(https?:\/\/\S+|\d[\d,.]*)(?=\s|$)/g;

/**
 * Drops aggregator boilerplate (Hacker News, Lobsters, Reddit feeds) from a teaser or feed
 * body, whether it sits on its own lines or runs together on one. Returns null when nothing
 * readable is left, so the UI shows no summary at all.
 */
export function cleanTeaser(text: string | null): string | null {
  if (!text) return null;
  const out = text
    .split(/\n{2,}/)
    .map((p) => p.replace(BOILERPLATE, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
  return out.length >= 20 ? out : null;
}

/** Drops a heading that just repeats the article title (sites often repeat it in the body). */
export function dropTitleHeading(markdown: string, title: string): string {
  const norm = (t: string) => t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
  const want = norm(title);
  return markdown
    .split('\n')
    .filter((l) => !(/^#{1,6}\s/.test(l) && norm(l.replace(/^#+\s*/, '')) === want))
    .join('\n');
}
