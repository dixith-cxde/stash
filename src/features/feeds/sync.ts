import {
  createBookmark,
  createFeed,
  deleteFeed,
  findDuplicate,
  findFeedByUrl,
  getFeedItem,
  linkFeedItemBookmark,
  listFeeds,
  markFeedItemRead,
  updateFeed,
  upsertFeedItems,
} from '@/db/repo';
import type { Feed } from '@/db/schema';
import { processPreviewQueue } from '@/features/preview/fetchPreview';

import { discoverFeeds, looksLikeFeed, type ParsedFeed, parseFeed } from './parse';

/**
 * Battery: feeds are only fetched when the Feeds tab is opened and they are older than this,
 * or on pull-to-refresh. No background polling. Conditional GETs (ETag / Last-Modified) make
 * an unchanged feed cost a single tiny 304 response.
 */
export const REFRESH_INTERVAL = 3 * 60 * 60 * 1000;
const TIMEOUT = 15_000;
/** Feeds fetched at once on a refresh. */
const CONCURRENCY = 2;

const HEADERS = {
  Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.5, */*;q=0.1',
  'User-Agent': 'Stash/1.0 (RSS reader)',
};

export class FeedError extends Error {}

async function get(url: string, extra: Record<string, string> = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    return await fetch(url, { headers: { ...HEADERS, ...extra }, signal: ctrl.signal });
  } catch {
    throw new FeedError(ctrl.signal.aborted ? 'The site took too long to answer.' : "Couldn't reach the site.");
  } finally {
    clearTimeout(timer);
  }
}

function normalizeUrl(input: string): string {
  const t = input.trim();
  if (!t) throw new FeedError('Enter a site or feed address.');
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol)) throw new Error();
    return u.toString();
  } catch {
    throw new FeedError("That doesn't look like a web address.");
  }
}

/** Fetches a URL that is either a feed or a page that links to one. */
async function resolveFeed(input: string): Promise<{ url: string; parsed: ParsedFeed; etag: string | null; lastModified: string | null }> {
  const url = normalizeUrl(input);
  const res = await get(url);
  if (!res.ok) throw new FeedError(`The site answered with an error (${res.status}).`);
  const body = await res.text();
  const finalUrl = res.url || url;
  if (looksLikeFeed(body)) {
    return { url: finalUrl, parsed: parseFeed(body, finalUrl), etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified') };
  }
  const found = discoverFeeds(body, finalUrl);
  for (const candidate of found.slice(0, 3)) {
    const r = await get(candidate);
    if (!r.ok) continue;
    const text = await r.text();
    if (!looksLikeFeed(text)) continue;
    const u = r.url || candidate;
    return { url: u, parsed: parseFeed(text, u), etag: r.headers.get('etag'), lastModified: r.headers.get('last-modified') };
  }
  throw new FeedError("Couldn't find a feed on that page.");
}

function toRows(parsed: ParsedFeed) {
  return parsed.items.map((i) => ({
    guid: i.guid,
    url: i.url,
    title: i.title || 'Untitled',
    summary: i.summary,
    content: i.content,
    author: i.author,
    imageUrl: i.imageUrl,
    publishedAt: i.publishedAt,
  }));
}

/** Subscribe to a site or feed URL (autodiscovers the feed on a web page). Returns the feed id. */
export async function addFeed(input: string): Promise<{ id: string; existed: boolean }> {
  const { url, parsed, etag, lastModified } = await resolveFeed(input);
  const existing = await findFeedByUrl(url);
  if (existing) return { id: existing.id, existed: true };
  const id = await createFeed({
    url,
    title: parsed.title || new URL(url).hostname.replace(/^www\./, ''),
    siteUrl: parsed.siteUrl,
    description: parsed.description,
    iconUrl: parsed.iconUrl,
    etag,
    lastModified,
    lastFetchedAt: new Date(),
  });
  await upsertFeedItems(id, toRows(parsed));
  return { id, existed: false };
}

/** Fetches one feed (conditionally). Returns the number of new articles. */
export async function refreshFeed(feed: Feed): Promise<number> {
  try {
    const cond: Record<string, string> = {};
    if (feed.etag) cond['If-None-Match'] = feed.etag;
    if (feed.lastModified) cond['If-Modified-Since'] = feed.lastModified;
    const res = await get(feed.url, cond);
    if (res.status === 304) {
      await updateFeed(feed.id, { lastFetchedAt: new Date(), lastError: null });
      return 0;
    }
    if (!res.ok) throw new FeedError(`HTTP ${res.status}`);
    const parsed = parseFeed(await res.text(), feed.url);
    const added = await upsertFeedItems(feed.id, toRows(parsed));
    await updateFeed(feed.id, {
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
      lastFetchedAt: new Date(),
      lastError: null,
      ...(parsed.iconUrl && !feed.iconUrl ? { iconUrl: parsed.iconUrl } : {}),
    });
    return added;
  } catch (e) {
    await updateFeed(feed.id, { lastFetchedAt: new Date(), lastError: e instanceof Error ? e.message : 'Refresh failed' });
    return 0;
  }
}

let inFlight: Promise<number> | null = null;

/** Refreshes feeds older than REFRESH_INTERVAL (all of them when `force`). One run at a time. */
export function refreshFeeds({ force = false } = {}): Promise<number> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const now = Date.now();
    const due = (await listFeeds()).filter((f) => force || !f.lastFetchedAt || now - f.lastFetchedAt.getTime() > REFRESH_INTERVAL);
    let added = 0;
    for (let i = 0; i < due.length; i += CONCURRENCY) {
      const counts = await Promise.all(due.slice(i, i + CONCURRENCY).map(refreshFeed));
      added += counts.reduce((a, b) => a + b, 0);
    }
    return added;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Save an article to the stash as a link (or link it to an existing one). Returns the bookmark id. */
export async function saveFeedItem(itemId: string): Promise<{ bookmarkId: string; existed: boolean }> {
  const item = await getFeedItem(itemId);
  if (!item) throw new FeedError('Article not found.');
  if (item.bookmarkId) return { bookmarkId: item.bookmarkId, existed: true };
  const dup = item.url ? await findDuplicate(item.url) : undefined;
  let bookmarkId = dup?.id;
  if (!bookmarkId) {
    bookmarkId = await createBookmark({
      type: 'link',
      title: item.title,
      url: item.url,
      description: item.summary,
      content: item.content,
      imageUrl: item.imageUrl,
      siteName: item.feedTitle,
      sourceApp: 'Feeds',
      fetchStatus: item.url ? 'pending' : 'done',
    });
    if (item.url) void processPreviewQueue();
  }
  await linkFeedItemBookmark(item.id, bookmarkId);
  await markFeedItemRead(item.id);
  return { bookmarkId, existed: !!dup };
}

export { deleteFeed };
