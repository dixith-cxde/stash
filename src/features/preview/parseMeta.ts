export type PageMeta = {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  /** Canonical/OG url, if the page declares one. */
  url?: string;
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? '');
  return out;
}

function resolve(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

/**
 * Extracts OpenGraph / Twitter / standard metadata from an HTML document.
 * Only looks at <head>-ish markup, so it's cheap even on large pages.
 */
export function parseMeta(html: string, baseUrl: string): PageMeta {
  const head = html.slice(0, 300_000);
  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop)?.toLowerCase();
    if (key && a.content && !(key in meta)) meta[key] = a.content.trim();
  }

  let favicon: string | undefined;
  let canonical: string | undefined;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const rel = a.rel?.toLowerCase() ?? '';
    if (!favicon && /\b(apple-touch-icon|icon)\b/.test(rel)) favicon = a.href;
    if (!canonical && rel === 'canonical') canonical = a.href;
  }

  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  const title = meta['og:title'] ?? meta['twitter:title'] ?? (titleTag ? decodeEntities(titleTag.trim()) : undefined);
  const description = meta['og:description'] ?? meta['twitter:description'] ?? meta['description'];
  const image = meta['og:image:secure_url'] ?? meta['og:image'] ?? meta['twitter:image'] ?? meta['twitter:image:src'];

  return {
    title: title?.replace(/\s+/g, ' ') || undefined,
    description: description?.replace(/\s+/g, ' ') || undefined,
    image: resolve(image, baseUrl),
    siteName: meta['og:site_name'] ?? meta['application-name'],
    favicon: resolve(favicon ?? '/favicon.ico', baseUrl),
    url: resolve(meta['og:url'] ?? canonical, baseUrl),
  };
}

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/);
      if (m) return m[2];
    }
  } catch {
    // not a URL
  }
  return null;
}
