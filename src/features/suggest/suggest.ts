/*
 * On-device organisation hints: tag and folder suggestions from text overlap and from what you
 * did with other items from the same site, plus URL canonicalisation for duplicate detection.
 * Everything here is pure so it can be unit-tested; the repo supplies the history.
 */

/** Query params that identify a click, not a page. */
const TRACKING = /^(utm_\w+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|igsh|si|ref|ref_src|ref_url|source|spm|share|feature|_hs\w+|vero_\w+|oly_\w+|rb_clickid|s_cid|cmpid|smid|guccounter)$/i;

/**
 * Normalises a URL so trivially different shares of the same page compare equal:
 * https, no "www."/"m.", no fragment or tracking params, sorted query, no trailing slash,
 * youtu.be and shorts links folded into youtube.com/watch.
 */
export function canonicalUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return raw.trim();
  let host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  let path = url.pathname;
  const params = new URLSearchParams(url.search);

  if (host === 'youtu.be') {
    params.set('v', path.slice(1));
    host = 'youtube.com';
    path = '/watch';
  } else if (host === 'youtube.com' && path.startsWith('/shorts/')) {
    params.set('v', path.split('/')[2] ?? '');
    path = '/watch';
  }

  const kept = [...params.entries()].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b));
  if (path.length > 1) path = path.replace(/\/+$/, '');
  const query = kept.length ? `?${new URLSearchParams(kept).toString()}` : '';
  return `https://${host}${path === '/' ? '' : path}${query}`;
}

const STOP = new Set(
  'a an and are as at be by for from has have how i in into is it its of on or that the this to was what when where who why will with you your vs via new'.split(
    ' ',
  ),
);

/** Lowercase word tokens with a light plural fold ("designs" → "design"). */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

export type TagStat = { id: string; name: string; count: number };
export type SuggestInput = { title?: string | null; description?: string | null; url?: string | null; content?: string | null };

/**
 * Ranks existing tags for an item. A tag scores when all of its words appear in the item's
 * text (title counts double) and when it was used on other items from the same site.
 */
export function suggestTags(
  input: SuggestInput,
  tags: TagStat[],
  siteTagCounts: Map<string, number> = new Map(),
  exclude: string[] = [],
  limit = 5,
): TagStat[] {
  const title = new Set(tokens(input.title ?? ''));
  const rest = new Set(tokens([input.description, input.content?.slice(0, 4000), input.url].filter(Boolean).join(' ')));
  const skip = new Set(exclude);
  const scored = tags
    .filter((t) => !skip.has(t.id))
    .map((tag) => {
      const words = tokens(tag.name.replace(/-/g, ' '));
      let score = 0;
      if (words.length && words.every((w) => title.has(w))) score += 3;
      else if (words.length && words.every((w) => title.has(w) || rest.has(w))) score += 1.5;
      const site = siteTagCounts.get(tag.id) ?? 0;
      if (site) score += 1 + Math.min(site, 5) * 0.5;
      // Gentle prior towards tags you actually use.
      if (score > 0) score += Math.min(tag.count, 20) / 100;
      return { tag, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.tag.name.localeCompare(b.tag.name));
  return scored.slice(0, limit).map((s) => s.tag);
}

/** The folder you most often file this site into, if it is a clear habit (≥2 items, ≥50%). */
export function suggestFolder(siteFolderCounts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestN = 0;
  let total = 0;
  for (const [id, n] of siteFolderCounts) {
    total += n;
    if (n > bestN) {
      best = id;
      bestN = n;
    }
  }
  return best && bestN >= 2 && bestN / total >= 0.5 ? best : null;
}
