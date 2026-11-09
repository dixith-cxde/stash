import { bookmarksNeedingPreview, updateBookmark } from '@/db/repo';
import type { Bookmark } from '@/db/schema';
import { hostOf } from '@/features/capture/normalize';

import { type PageMeta, parseMeta, youtubeId } from './parseMeta';

const UA =
  'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function youtubeMeta(url: string, id: string): Promise<PageMeta> {
  const res = await fetchWithTimeout(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    8000,
  );
  const json = res.ok ? ((await res.json()) as { title?: string; author_name?: string }) : {};
  return {
    title: json.title,
    description: json.author_name ? `by ${json.author_name}` : undefined,
    image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    siteName: 'YouTube',
    favicon: 'https://www.youtube.com/favicon.ico',
  };
}

export async function fetchPageMeta(url: string): Promise<PageMeta> {
  const yt = youtubeId(url);
  if (yt) return youtubeMeta(url, yt);

  const res = await fetchWithTimeout(url, 12000, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
  });
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('html')) {
    return { title: decodeURIComponent(new URL(res.url || url).pathname.split('/').pop() || hostOf(url)) };
  }
  const html = await res.text();
  return parseMeta(html, res.url || url);
}

function googleFavicon(url: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(url))}&sz=128`;
}

/** Fetch and store metadata for one link bookmark. Never throws. */
export async function refreshPreview(b: Pick<Bookmark, 'id' | 'url' | 'title'>) {
  if (!b.url) return;
  try {
    const meta = await fetchPageMeta(b.url);
    const host = hostOf(b.url);
    // Keep a user-provided title (anything other than the placeholder host) over page title.
    const keepTitle = b.title && b.title !== host;
    await updateBookmark(b.id, {
      title: keepTitle ? b.title : (meta.title ?? host),
      description: meta.description ?? null,
      imageUrl: meta.image ?? null,
      siteName: meta.siteName ?? host,
      favicon: meta.favicon ?? googleFavicon(b.url),
      fetchStatus: 'done',
    });
  } catch (e) {
    console.warn('[preview] failed', b.url, e);
    await updateBookmark(b.id, { favicon: googleFavicon(b.url), fetchStatus: 'failed' });
  }
}

let running: Promise<void> | null = null;

/** Drains the queue of links whose preview is pending (optionally retrying failures). */
export function processPreviewQueue(retryFailed = false): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      for (;;) {
        const batch = await bookmarksNeedingPreview(retryFailed);
        const links = batch.filter((b) => b.type === 'link' && b.url);
        // Non-link rows marked pending have nothing to fetch.
        await Promise.all(
          batch.filter((b) => !links.includes(b)).map((b) => updateBookmark(b.id, { fetchStatus: 'done' })),
        );
        if (!links.length) break;
        await Promise.all(links.map(refreshPreview));
        if (retryFailed) break; // one pass for retries, avoid looping on permanent failures
      }
    } finally {
      running = null;
    }
  })();
  return running;
}
