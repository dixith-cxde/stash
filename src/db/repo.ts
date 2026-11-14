import { and, asc, count, desc, eq, getTableColumns, inArray, isNotNull, isNull, like, max, ne, or, sql } from 'drizzle-orm';

import { deleteLocalFiles } from '@/features/files/storage';
import {
  applyCorrections,
  correctedQuery,
  maxTypoDistance,
  ownForms,
  parseQuery,
  pickCorrection,
  type QueryTerm,
  rankDocs,
  type SearchDoc,
  toSmartFts,
  type VocabWord,
} from '@/features/search/smart';
import { canonicalUrl } from '@/features/suggest/suggest';

import { db, newId } from './client';
import { newestFirst, toFtsQuery, whereForFilter } from './filters';
import {
  type Bookmark,
  bookmarks,
  type Feed,
  type FeedItem,
  feedItems,
  feeds,
  bookmarkTags,
  type Folder,
  folders,
  type Highlight,
  type HighlightColor,
  highlights,
  highlightTags,
  type List,
  listItems,
  lists,
  type NewBookmark,
  type SmartFilter,
  type Tag,
  tags,
} from './schema';

export type BookmarkWithTags = Bookmark & { tags: Tag[] };

/* ------------------------------- Bookmarks -------------------------------- */

async function attachTags(rows: Bookmark[]): Promise<BookmarkWithTags[]> {
  if (!rows.length) return [];
  const links = await db
    .select({ bookmarkId: bookmarkTags.bookmarkId, tag: tags })
    .from(bookmarkTags)
    .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
    .where(
      inArray(
        bookmarkTags.bookmarkId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(tags.name));
  const byBookmark = new Map<string, Tag[]>();
  for (const { bookmarkId, tag } of links) {
    byBookmark.set(bookmarkId, [...(byBookmark.get(bookmarkId) ?? []), tag]);
  }
  return rows.map((r) => ({ ...r, tags: byBookmark.get(r.id) ?? [] }));
}

export async function queryBookmarks(filter: SmartFilter = {}, limit = 500): Promise<BookmarkWithTags[]> {
  const rows = await db
    .select()
    .from(bookmarks)
    .where(whereForFilter(filter))
    .orderBy(...newestFirst)
    .limit(limit);
  return attachTags(rows);
}

export async function getBookmark(id: string): Promise<BookmarkWithTags | null> {
  const row = await db.query.bookmarks.findFirst({ where: eq(bookmarks.id, id) });
  if (!row) return null;
  return (await attachTags([row]))[0];
}

export async function createBookmark(
  input: Omit<NewBookmark, 'id'> & { tagIds?: string[]; idOverride?: string },
): Promise<string> {
  const { tagIds, idOverride, ...values } = input;
  const id = idOverride ?? newId();
  await db.insert(bookmarks).values({ ...values, id });
  if (tagIds?.length) await setBookmarkTags(id, tagIds);
  return id;
}

export async function updateBookmark(id: string, patch: Partial<Omit<NewBookmark, 'id'>>) {
  await db
    .update(bookmarks)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(bookmarks.id, id));
}

export async function deleteBookmarks(ids: string[]) {
  if (!ids.length) return;
  const rows = await db
    .select({ filePath: bookmarks.filePath, thumbPath: bookmarks.thumbPath })
    .from(bookmarks)
    .where(inArray(bookmarks.id, ids));
  await db.delete(bookmarks).where(inArray(bookmarks.id, ids));
  deleteLocalFiles(...rows.flatMap((r) => [r.filePath, r.thumbPath]));
}

export async function moveBookmarks(ids: string[], folderId: string | null) {
  if (!ids.length) return;
  await db.update(bookmarks).set({ folderId, updatedAt: new Date() }).where(inArray(bookmarks.id, ids));
}

export async function setArchived(ids: string[], isArchived: boolean) {
  if (!ids.length) return;
  await db.update(bookmarks).set({ isArchived, updatedAt: new Date() }).where(inArray(bookmarks.id, ids));
}

/** Bookmarks whose titles match exactly (case-insensitive), for [[wiki links]] in notes. */
export async function bookmarksByTitles(titles: string[]): Promise<Map<string, Bookmark>> {
  if (!titles.length) return new Map();
  const lower = titles.map((t) => t.toLowerCase());
  const rows = await db
    .select()
    .from(bookmarks)
    .where(inArray(sql`lower(${bookmarks.title})`, lower));
  return new Map(rows.map((r) => [r.title.toLowerCase(), r]));
}

export async function findBookmarkByUrl(url: string): Promise<Bookmark | undefined> {
  return db.query.bookmarks.findFirst({ where: eq(bookmarks.url, url) });
}

/** Bookmarks whose metadata still needs fetching (new links, or failures to retry). */
export async function bookmarksNeedingPreview(includeFailed: boolean) {
  return db
    .select()
    .from(bookmarks)
    .where(
      includeFailed
        ? inArray(bookmarks.fetchStatus, ['pending', 'failed'])
        : eq(bookmarks.fetchStatus, 'pending'),
    )
    .limit(25);
}

export async function countsByType(): Promise<Record<string, number>> {
  const rows = await db
    .select({ type: bookmarks.type, n: count() })
    .from(bookmarks)
    .where(eq(bookmarks.isArchived, false))
    .groupBy(bookmarks.type);
  return Object.fromEntries(rows.map((r) => [r.type, r.n]));
}

/** Not-archived items nobody has opened yet (links and PDFs: the "to read" pile). */
export async function countUnread(): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(bookmarks)
    .where(and(whereForFilter({ unread: true }), inArray(bookmarks.type, ['link', 'pdf'])));
  return n;
}

/** Artwork of the newest items matching a filter, for collection tiles. */
export async function recentCovers(filter: SmartFilter, n = 3): Promise<string[]> {
  const rows = await db
    .select({ imageUrl: bookmarks.imageUrl, thumbPath: bookmarks.thumbPath })
    .from(bookmarks)
    .where(and(whereForFilter(filter), sql`coalesce(${bookmarks.thumbPath}, ${bookmarks.imageUrl}) is not null`))
    .orderBy(...newestFirst)
    .limit(n);
  return rows.map((r) => (r.thumbPath ?? r.imageUrl)!);
}

/** bookmarkId → number of highlights. */
export async function highlightCounts(bookmarkIds: string[]): Promise<Map<string, number>> {
  if (!bookmarkIds.length) return new Map();
  const rows = await db
    .select({ id: highlights.bookmarkId, n: count() })
    .from(highlights)
    .where(inArray(highlights.bookmarkId, bookmarkIds))
    .groupBy(highlights.bookmarkId);
  return new Map(rows.map((r) => [r.id!, r.n]));
}

function sameSite(host: string) {
  return or(like(bookmarks.url, `%//${host}/%`), like(bookmarks.url, `%.${host}/%`), like(bookmarks.url, `%//${host}`));
}

/** An existing bookmark for the same page (ignoring tracking params, www., fragments…). */
export async function findDuplicate(url: string): Promise<Bookmark | undefined> {
  const exact = await findBookmarkByUrl(url);
  if (exact) return exact;
  const canonical = canonicalUrl(url);
  let host: string;
  try {
    host = new URL(canonical).hostname;
  } catch {
    return undefined;
  }
  const candidates = await db.select().from(bookmarks).where(sameSite(host)).limit(500);
  return candidates.find((b) => b.url && canonicalUrl(b.url) === canonical);
}

/** How you organised other items from this host: tagId → uses, folderId → items. */
export async function siteHistory(host: string, excludeId?: string) {
  const site = and(sameSite(host), excludeId ? ne(bookmarks.id, excludeId) : undefined);
  const [tagRows, folderRows] = await Promise.all([
    db
      .select({ tagId: bookmarkTags.tagId, n: count() })
      .from(bookmarkTags)
      .innerJoin(bookmarks, eq(bookmarks.id, bookmarkTags.bookmarkId))
      .where(site)
      .groupBy(bookmarkTags.tagId),
    db
      .select({ folderId: bookmarks.folderId, n: count() })
      .from(bookmarks)
      .where(and(site, isNotNull(bookmarks.folderId)))
      .groupBy(bookmarks.folderId),
  ]);
  return {
    tagCounts: new Map(tagRows.map((r) => [r.tagId, r.n])),
    folderCounts: new Map(folderRows.map((r) => [r.folderId!, r.n])),
  };
}

/* ---------------------------------- Tags ---------------------------------- */

export type TagWithCount = Tag & { count: number };

export async function listTags(): Promise<TagWithCount[]> {
  const rows = await db
    .select({ tag: tags, n: sql<number>`count(${bookmarkTags.bookmarkId})` })
    .from(tags)
    .leftJoin(bookmarkTags, eq(bookmarkTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(asc(sql`lower(${tags.name})`));
  return rows.map((r) => ({ ...r.tag, count: r.n }));
}

export function normalizeTagName(name: string) {
  return name.trim().replace(/^#+/, '').replace(/\s+/g, '-').toLowerCase();
}

/** Returns the id of the tag with this name, creating it when missing. */
export async function ensureTag(name: string): Promise<string> {
  const clean = normalizeTagName(name);
  if (!clean) throw new Error('Tag name is empty');
  const existing = await db.query.tags.findFirst({ where: eq(tags.name, clean) });
  if (existing) return existing.id;
  const id = newId();
  await db.insert(tags).values({ id, name: clean });
  return id;
}

export async function setBookmarkTags(bookmarkId: string, tagIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId));
    if (tagIds.length) {
      await tx.insert(bookmarkTags).values([...new Set(tagIds)].map((tagId) => ({ bookmarkId, tagId })));
    }
  });
}

export async function addTagToBookmarks(bookmarkIds: string[], tagId: string) {
  if (!bookmarkIds.length) return;
  await db
    .insert(bookmarkTags)
    .values(bookmarkIds.map((bookmarkId) => ({ bookmarkId, tagId })))
    .onConflictDoNothing();
}

export async function renameTag(id: string, name: string) {
  await db.update(tags).set({ name: normalizeTagName(name) }).where(eq(tags.id, id));
}

export async function deleteTag(id: string) {
  await db.delete(tags).where(eq(tags.id, id));
}

/* -------------------------------- Folders --------------------------------- */

export type FolderNode = Folder & { depth: number; itemCount: number; path: string };

/** Whole folder tree, depth-first, via a recursive CTE. */
export async function folderTree(): Promise<FolderNode[]> {
  const rows = await db.all<{
    id: string;
    parent_id: string | null;
    name: string;
    shape: string;
    color: string | null;
    icon: string | null;
    sort: number;
    pinned: number;
    created_at: number;
    updated_at: number;
    depth: number;
    path: string;
    item_count: number;
  }>(sql`
    with recursive tree(id, depth, path, sortkey) as (
      select id, 0, name, printf('%08d', sort) || name from folders where parent_id is null
      union all
      select f.id, t.depth + 1, t.path || ' / ' || f.name, t.sortkey || '/' || printf('%08d', f.sort) || f.name
      from folders f join tree t on f.parent_id = t.id
    )
    select f.*, tree.depth, tree.path,
      (select count(*) from bookmarks b where b.folder_id = f.id and b.is_archived = 0) as item_count
    from tree join folders f on f.id = tree.id
    order by tree.sortkey
  `);
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    name: r.name,
    shape: r.shape,
    color: r.color,
    icon: r.icon,
    sort: r.sort,
    pinned: !!r.pinned,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    depth: r.depth,
    path: r.path,
    itemCount: r.item_count,
  }));
}

export async function getFolder(id: string) {
  return db.query.folders.findFirst({ where: eq(folders.id, id) });
}

export async function childFolders(parentId: string | null) {
  return db
    .select()
    .from(folders)
    .where(parentId ? eq(folders.parentId, parentId) : isNull(folders.parentId))
    .orderBy(asc(folders.sort), asc(folders.name));
}

export async function createFolder(input: {
  name: string;
  parentId?: string | null;
  shape?: string;
  color?: string;
  icon?: string;
}) {
  const id = newId();
  const [{ m }] = await db.select({ m: max(folders.sort) }).from(folders);
  await db.insert(folders).values({ id, ...input, sort: (m ?? 0) + 1 });
  return id;
}

export async function updateFolder(
  id: string,
  patch: Partial<Pick<Folder, 'name' | 'parentId' | 'shape' | 'color' | 'icon' | 'pinned'>>,
) {
  await db.update(folders).set({ ...patch, updatedAt: new Date() }).where(eq(folders.id, id));
}

export async function deleteFolder(id: string) {
  await db.delete(folders).where(eq(folders.id, id));
}

/* --------------------------------- Lists ---------------------------------- */

export type ListWithCount = List & { itemCount: number };

export async function allLists(): Promise<ListWithCount[]> {
  const rows = await db.select().from(lists).orderBy(desc(lists.pinned), asc(lists.sort), asc(lists.name));
  const manualCounts = await db
    .select({ listId: listItems.listId, n: count() })
    .from(listItems)
    .groupBy(listItems.listId);
  const counts = new Map(manualCounts.map((c) => [c.listId, c.n]));
  const result: ListWithCount[] = [];
  for (const l of rows) {
    const itemCount =
      l.kind === 'smart'
        ? ((await db.select({ n: count() }).from(bookmarks).where(whereForFilter(l.filter ?? {})))[0]?.n ?? 0)
        : (counts.get(l.id) ?? 0);
    result.push({ ...l, itemCount });
  }
  return result;
}

export async function getList(id: string) {
  return db.query.lists.findFirst({ where: eq(lists.id, id) });
}

export async function listBookmarks(list: List): Promise<BookmarkWithTags[]> {
  if (list.kind === 'smart') return queryBookmarks(list.filter ?? {});
  const rows = await db
    .select({ b: bookmarks })
    .from(listItems)
    .innerJoin(bookmarks, eq(bookmarks.id, listItems.bookmarkId))
    .where(eq(listItems.listId, list.id))
    .orderBy(asc(listItems.position), desc(listItems.addedAt));
  return attachTags(rows.map((r) => r.b));
}

export async function createList(input: {
  name: string;
  kind?: 'manual' | 'smart';
  filter?: SmartFilter;
  shape?: string;
  description?: string;
}) {
  const id = newId();
  await db.insert(lists).values({ id, ...input });
  return id;
}

export async function updateList(id: string, patch: Partial<Pick<List, 'name' | 'description' | 'filter' | 'shape' | 'pinned'>>) {
  await db.update(lists).set({ ...patch, updatedAt: new Date() }).where(eq(lists.id, id));
}

export async function deleteList(id: string) {
  await db.delete(lists).where(eq(lists.id, id));
}

export async function addToList(listId: string, bookmarkIds: string[]) {
  if (!bookmarkIds.length) return;
  const [{ m }] = await db
    .select({ m: max(listItems.position) })
    .from(listItems)
    .where(eq(listItems.listId, listId));
  let position = (m ?? 0) + 1;
  await db
    .insert(listItems)
    .values(bookmarkIds.map((bookmarkId) => ({ listId, bookmarkId, position: position++ })))
    .onConflictDoNothing();
}

export async function removeFromList(listId: string, bookmarkIds: string[]) {
  await db
    .delete(listItems)
    .where(and(eq(listItems.listId, listId), inArray(listItems.bookmarkId, bookmarkIds)));
}

export async function listsContaining(bookmarkId: string) {
  const rows = await db
    .select({ listId: listItems.listId })
    .from(listItems)
    .where(eq(listItems.bookmarkId, bookmarkId));
  return rows.map((r) => r.listId);
}

/* ------------------------------- Highlights ------------------------------- */

export type HighlightWithTags = Highlight & { tags: Tag[]; bookmarkTitle: string | null };

export async function queryHighlights(
  opts: { bookmarkId?: string; tagId?: string; query?: string; standalone?: boolean } = {},
) {
  const conditions = [];
  if (opts.bookmarkId) conditions.push(eq(highlights.bookmarkId, opts.bookmarkId));
  if (opts.standalone) conditions.push(isNull(highlights.bookmarkId));
  if (opts.tagId) {
    conditions.push(
      sql`exists (select 1 from ${highlightTags} where ${highlightTags.highlightId} = ${highlights.id} and ${highlightTags.tagId} = ${opts.tagId})`,
    );
  }
  const match = opts.query ? toFtsQuery(opts.query) : null;
  if (match) {
    conditions.push(sql`${highlights}.rowid in (select rowid from highlights_fts where highlights_fts match ${match})`);
  }
  const rows = await db
    .select({ h: highlights, bookmarkTitle: bookmarks.title })
    .from(highlights)
    .leftJoin(bookmarks, eq(bookmarks.id, highlights.bookmarkId))
    .where(and(...conditions))
    .orderBy(desc(highlights.createdAt));
  if (!rows.length) return [];
  const links = await db
    .select({ highlightId: highlightTags.highlightId, tag: tags })
    .from(highlightTags)
    .innerJoin(tags, eq(tags.id, highlightTags.tagId))
    .where(
      inArray(
        highlightTags.highlightId,
        rows.map((r) => r.h.id),
      ),
    );
  const byId = new Map<string, Tag[]>();
  for (const l of links) byId.set(l.highlightId, [...(byId.get(l.highlightId) ?? []), l.tag]);
  return rows.map<HighlightWithTags>((r) => ({ ...r.h, bookmarkTitle: r.bookmarkTitle, tags: byId.get(r.h.id) ?? [] }));
}

export async function getHighlight(id: string): Promise<HighlightWithTags | null> {
  const row = await db
    .select({ h: highlights, bookmarkTitle: bookmarks.title })
    .from(highlights)
    .leftJoin(bookmarks, eq(bookmarks.id, highlights.bookmarkId))
    .where(eq(highlights.id, id))
    .get();
  if (!row) return null;
  const links = await db
    .select({ tag: tags })
    .from(highlightTags)
    .innerJoin(tags, eq(tags.id, highlightTags.tagId))
    .where(eq(highlightTags.highlightId, id));
  return { ...row.h, bookmarkTitle: row.bookmarkTitle, tags: links.map((l) => l.tag) };
}

export async function createHighlight(input: {
  text: string;
  bookmarkId?: string;
  note?: string;
  color?: HighlightColor;
  sourceApp?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  page?: number;
  tagIds?: string[];
}) {
  const id = newId();
  const { tagIds, ...values } = input;
  await db.insert(highlights).values({ id, ...values });
  if (tagIds?.length) await setHighlightTags(id, tagIds);
  return id;
}

export async function updateHighlight(id: string, patch: Partial<Pick<Highlight, 'text' | 'note' | 'color'>>) {
  await db.update(highlights).set({ ...patch, updatedAt: new Date() }).where(eq(highlights.id, id));
}

export async function setHighlightTags(highlightId: string, tagIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(highlightTags).where(eq(highlightTags.highlightId, highlightId));
    if (tagIds.length) {
      await tx.insert(highlightTags).values([...new Set(tagIds)].map((tagId) => ({ highlightId, tagId })));
    }
  });
}

export async function deleteHighlight(id: string) {
  await db.delete(highlights).where(eq(highlights.id, id));
}

/* --------------------------------- Search --------------------------------- */

export type SearchResults = { bookmarks: BookmarkWithTags[]; highlights: HighlightWithTags[] };

export async function search(query: string, filter: SmartFilter = {}): Promise<SearchResults> {
  const match = toFtsQuery(query);
  if (!match) return { bookmarks: [], highlights: [] };
  const ranked = await db.all<{ id: string }>(
    sql`select b.id from bookmarks_fts f join bookmarks b on b.rowid = f.rowid
        where bookmarks_fts match ${match} order by bm25(bookmarks_fts, 10.0, 4.0, 1.0, 2.0, 3.0, 2.0) limit 200`,
  );
  const ids = ranked.map((r) => r.id);
  let found: BookmarkWithTags[] = [];
  if (ids.length) {
    const rows = await db
      .select()
      .from(bookmarks)
      .where(and(inArray(bookmarks.id, ids), whereForFilter({ ...filter, query: undefined })));
    const order = new Map(ids.map((id, i) => [id, i]));
    found = await attachTags(rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!));
  }
  return { bookmarks: found, highlights: await queryHighlights({ query }) };
}

/* ---------------------------------- Feeds --------------------------------- */

export type FeedWithCounts = Feed & { unread: number; total: number; latestAt: Date | null };
export type FeedItemWithFeed = FeedItem & {
  feedTitle: string;
  feedIconUrl: string | null;
  feedSiteUrl: string | null;
  /** Length of the article text (content, else summary), for the read-time estimate. */
  chars: number;
};

/** Articles kept per feed (saved ones are always kept). */
const FEED_ITEM_CAP = 200;

export async function listFeeds(): Promise<FeedWithCounts[]> {
  const rows = await db
    .select({
      f: feeds,
      total: count(feedItems.id),
      unread: sql<number>`coalesce(sum(case when ${feedItems.readAt} is null and ${feedItems.hiddenAt} is null then 1 else 0 end), 0)`,
      latestAt: max(feedItems.publishedAt),
    })
    .from(feeds)
    .leftJoin(feedItems, eq(feedItems.feedId, feeds.id))
    .groupBy(feeds.id)
    .orderBy(asc(feeds.title));
  return rows.map((r) => ({
    ...r.f,
    total: r.total,
    unread: Number(r.unread),
    latestAt: r.latestAt == null ? null : new Date(r.latestAt as unknown as number),
  }));
}

export async function getFeed(id: string): Promise<Feed | null> {
  return (await db.query.feeds.findFirst({ where: eq(feeds.id, id) })) ?? null;
}

export async function findFeedByUrl(url: string): Promise<Feed | null> {
  return (await db.query.feeds.findFirst({ where: eq(feeds.url, url) })) ?? null;
}

const itemWithFeed = {
  item: feedItems,
  feedTitle: feeds.title,
  feedIconUrl: feeds.iconUrl,
  feedSiteUrl: feeds.siteUrl,
  chars: sql<number>`coalesce(${feedItems.articleChars}, length(coalesce(${feedItems.content}, ${feedItems.summary}, '')))`,
};
const flatten = (r: {
  item: FeedItem;
  feedTitle: string;
  feedIconUrl: string | null;
  feedSiteUrl: string | null;
  chars: number;
}): FeedItemWithFeed => ({
  ...r.item,
  feedTitle: r.feedTitle,
  feedIconUrl: r.feedIconUrl,
  feedSiteUrl: r.feedSiteUrl,
  chars: Number(r.chars) || 0,
});

/** Newest first; `unreadOnly` hides read articles, `savedOnly` keeps saved ones. No `content`. */
export async function listFeedItems(
  opts: { feedId?: string; unreadOnly?: boolean; savedOnly?: boolean; limit?: number } = {},
): Promise<FeedItemWithFeed[]> {
  const conditions = [];
  if (opts.feedId) conditions.push(eq(feedItems.feedId, opts.feedId));
  if (opts.unreadOnly) conditions.push(isNull(feedItems.readAt));
  if (opts.savedOnly) conditions.push(isNotNull(feedItems.bookmarkId));
  conditions.push(isNull(feedItems.hiddenAt));
  const rows = await db
    .select(itemWithFeed)
    .from(feedItems)
    .innerJoin(feeds, eq(feeds.id, feedItems.feedId))
    .where(and(...conditions))
    .orderBy(desc(sql`coalesce(${feedItems.publishedAt}, ${feedItems.createdAt})`))
    .limit(opts.limit ?? 150);
  // The list never needs article bodies; drop them so each re-run stays light.
  return rows.map((r) => ({ ...flatten(r), content: null, article: null }));
}

export async function getFeedItem(id: string): Promise<FeedItemWithFeed | null> {
  const row = await db
    .select(itemWithFeed)
    .from(feedItems)
    .innerJoin(feeds, eq(feeds.id, feedItems.feedId))
    .where(eq(feedItems.id, id))
    .get();
  return row ? flatten(row) : null;
}

export async function createFeed(input: Omit<typeof feeds.$inferInsert, 'id'>): Promise<string> {
  const id = newId();
  await db.insert(feeds).values({ ...input, id });
  return id;
}

export async function updateFeed(id: string, patch: Partial<Omit<Feed, 'id' | 'createdAt'>>) {
  await db.update(feeds).set({ ...patch, updatedAt: new Date() }).where(eq(feeds.id, id));
}

export async function deleteFeed(id: string) {
  await db.delete(feeds).where(eq(feeds.id, id));
}

/**
 * Inserts articles not seen before (by feed + guid) and trims the feed to its newest
 * FEED_ITEM_CAP, never dropping saved ones. Returns how many were new.
 */
export async function upsertFeedItems(
  feedId: string,
  items: Omit<typeof feedItems.$inferInsert, 'id' | 'feedId'>[],
): Promise<number> {
  if (!items.length) return 0;
  let added = 0;
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ guid: feedItems.guid })
      .from(feedItems)
      .where(and(eq(feedItems.feedId, feedId), inArray(feedItems.guid, items.map((i) => i.guid))));
    const seen = new Set(existing.map((e) => e.guid));
    const fresh = items.filter((i) => !seen.has(i.guid) && (seen.add(i.guid), true));
    added = fresh.length;
    if (fresh.length) {
      await tx.insert(feedItems).values(fresh.map((i) => ({ ...i, id: newId(), feedId })));
    }
    await tx.run(sql`
      delete from feed_items where feed_id = ${feedId} and bookmark_id is null and id not in (
        select id from feed_items where feed_id = ${feedId}
        order by coalesce(published_at, created_at) desc limit ${FEED_ITEM_CAP}
      )`);
  });
  return added;
}

export async function markFeedItemRead(id: string, read = true) {
  await db.update(feedItems).set({ readAt: read ? new Date() : null }).where(eq(feedItems.id, id));
}

export async function setFeedItemHidden(id: string, hidden = true) {
  await db.update(feedItems).set({ hiddenAt: hidden ? new Date() : null }).where(eq(feedItems.id, id));
}

/** Caches the extracted article ('' when the page had nothing readable). */
export async function setFeedItemArticle(id: string, markdown: string, chars: number) {
  await db.update(feedItems).set({ article: markdown, articleChars: chars }).where(eq(feedItems.id, id));
}

export async function markAllFeedItemsRead(feedId?: string) {
  await db
    .update(feedItems)
    .set({ readAt: new Date() })
    .where(and(isNull(feedItems.readAt), feedId ? eq(feedItems.feedId, feedId) : undefined));
}

export async function linkFeedItemBookmark(id: string, bookmarkId: string | null) {
  await db.update(feedItems).set({ bookmarkId }).where(eq(feedItems.id, id));
}

/* ------------------------------ Smart search ------------------------------ */
// The Search tab: FTS5 candidates (stems, prefixes, synonyms) plus tag and folder matches,
// typo correction against the FTS vocabulary (drizzle/0005_search_vocab.sql), then re-ranked
// in JS by src/features/search/smart.ts. Local only; a query touches a few hundred rows.

export type SmartScope = 'all' | 'links' | 'pdfs' | 'notes' | 'highlights';
export type SmartHit =
  | { kind: 'bookmark'; key: string; b: BookmarkWithTags; why: string | null }
  | { kind: 'highlight'; key: string; h: HighlightWithTags; why: string | null };
export type SmartResults = { hits: SmartHit[]; corrected: string | null };

const SMART_TYPES: Record<SmartScope, SmartFilter['types']> = {
  all: undefined,
  links: ['link'],
  pdfs: ['pdf'],
  notes: ['text'],
  highlights: undefined,
};
/** FTS candidates per pass, and the most results shown. */
const SMART_CAP = 200;
const SMART_SHOWN = 100;
/** Characters of content read per candidate for matching (enough for the opening, cheap). */
const SMART_BODY_CHARS = 1500;
const TOP = String.fromCodePoint(0x10ffff);

/** "% form%" against a tag or folder name, with dashes read as spaces ("web-design"). */
const nameLike = (col: typeof tags.name | typeof folders.name, form: string) =>
  sql`(' ' || replace(lower(${col}), '-', ' ')) like ${`% ${form}%`}`;

function smartForms(terms: QueryTerm[]) {
  return [...new Set(terms.flatMap((t) => t.variants.map((v) => v.form)))].slice(0, 40);
}

/** Does this word (or its stem) occur anywhere: FTS vocab, tag names or folder names? */
async function smartWordExists(forms: string[]): Promise<boolean> {
  const checks = forms.flatMap((f) => [
    sql`exists (select 1 from bookmarks_vocab where term >= ${f} and term < ${f + TOP})`,
    sql`exists (select 1 from highlights_vocab where term >= ${f} and term < ${f + TOP})`,
    sql`exists (select 1 from ${tags} where ${nameLike(tags.name, f)})`,
    sql`exists (select 1 from ${folders} where ${nameLike(folders.name, f)})`,
  ]);
  const row = await db.get<{ ok: number }>(sql`select (${sql.join(checks, sql` or `)}) as ok`);
  return !!row?.ok;
}

/** Vocabulary words that could be one or two edits away (same length band, same first or second letter). */
async function smartVocab(word: string): Promise<VocabWord[]> {
  const max = maxTypoDistance(word);
  const lo = word.length - max;
  const hi = word.length + max;
  const a = word[0];
  const b = word[1] ?? '';
  const near = (table: string) =>
    sql`select term, doc as freq from ${sql.identifier(table)}
        where length(term) between ${lo} and ${hi} and (substr(term, 1, 1) = ${a} or substr(term, 2, 1) = ${b})`;
  const rows = await db.all<VocabWord>(
    sql`${near('bookmarks_vocab')} union all ${near('highlights_vocab')} order by freq desc limit 3000`,
  );
  const freq = new Map<string, number>();
  for (const r of rows) freq.set(r.term, (freq.get(r.term) ?? 0) + r.freq);
  // Tag names count as well-used words: they are the user's own vocabulary.
  const tagRows = await db.select({ name: tags.name }).from(tags);
  for (const t of tagRows) {
    for (const w of t.name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)) freq.set(w, (freq.get(w) ?? 0) + 5);
  }
  return [...freq].map(([term, f]) => ({ term, freq: f }));
}

async function smartCorrections(terms: QueryTerm[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const t of terms) {
    if (!maxTypoDistance(t.raw) || (await smartWordExists(ownForms(t)))) continue;
    const fixed = pickCorrection(t.raw, await smartVocab(t.raw));
    if (fixed) out.set(t.raw, fixed);
  }
  return out;
}

async function smartBookmarkDocs(terms: QueryTerm[], scope: SmartScope): Promise<{ docs: SearchDoc[]; rows: Map<string, BookmarkWithTags> }> {
  const filter = whereForFilter({ types: SMART_TYPES[scope] }) ?? sql`1`;
  const ranked = new Map<string, { bm25: number | null; all: boolean }>();
  const pass = async (match: string | null, all: boolean, limit: number) => {
    if (!match) return;
    const rows = await db.all<{ id: string; score: number }>(
      sql`select ${bookmarks.id} as id, bm25(bookmarks_fts, 10.0, 4.0, 1.0, 2.0, 3.0, 2.0) as score
          from bookmarks_fts join ${bookmarks} on ${bookmarks}.rowid = bookmarks_fts.rowid
          where bookmarks_fts match ${match} and ${filter} order by score limit ${limit}`,
    );
    for (const r of rows) if (!ranked.has(r.id)) ranked.set(r.id, { bm25: r.score, all });
  };
  await pass(toSmartFts(terms, 'and'), true, SMART_CAP);
  if (terms.length > 1) await pass(toSmartFts(terms, 'or'), false, SMART_CAP / 2);

  // Tag and folder names are not in the FTS index: match them directly.
  const forms = smartForms(terms);
  const named = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(
      and(
        filter,
        or(
          sql`exists (select 1 from ${bookmarkTags} join ${tags} on ${tags.id} = ${bookmarkTags.tagId}
              where ${bookmarkTags.bookmarkId} = ${bookmarks.id} and (${sql.join(forms.map((f) => nameLike(tags.name, f)), sql` or `)}))`,
          sql`exists (select 1 from ${folders} where ${folders.id} = ${bookmarks.folderId}
              and (${sql.join(forms.map((f) => nameLike(folders.name, f)), sql` or `)}))`,
        ),
      ),
    )
    .orderBy(...newestFirst)
    .limit(SMART_CAP / 2);
  for (const r of named) if (!ranked.has(r.id)) ranked.set(r.id, { bm25: null, all: false });
  if (!ranked.size) return { docs: [], rows: new Map() };

  const rows = await attachTags(
    await db
      .select({ ...getTableColumns(bookmarks), content: sql<string | null>`substr(${bookmarks.content}, 1, ${SMART_BODY_CHARS})` })
      .from(bookmarks)
      .where(inArray(bookmarks.id, [...ranked.keys()])),
  );
  const folderNames = new Map((await db.select({ id: folders.id, name: folders.name }).from(folders)).map((f) => [f.id, f.name]));
  const docs = rows.map<SearchDoc>((b) => ({
    id: `b:${b.id}`,
    bm25: ranked.get(b.id)!.bm25,
    allTerms: ranked.get(b.id)!.all,
    title: b.title,
    body: [b.description, b.note, b.content].filter(Boolean).join(' '),
    site: b.siteName,
    url: b.url,
    tags: b.tags.map((t) => t.name),
    folder: b.folderId ? (folderNames.get(b.folderId) ?? null) : null,
    favorite: b.isFavorite,
    unread: !b.readAt,
    createdAt: b.createdAt.getTime(),
  }));
  return { docs, rows: new Map(rows.map((b) => [`b:${b.id}`, b])) };
}

async function smartHighlightDocs(terms: QueryTerm[]): Promise<{ docs: SearchDoc[]; rows: Map<string, HighlightWithTags> }> {
  const ranked = new Map<string, { bm25: number | null; all: boolean }>();
  const pass = async (match: string | null, all: boolean) => {
    if (!match) return;
    const rows = await db.all<{ id: string; score: number }>(
      sql`select ${highlights.id} as id, bm25(highlights_fts, 4.0, 2.0, 1.0) as score
          from highlights_fts join ${highlights} on ${highlights}.rowid = highlights_fts.rowid
          where highlights_fts match ${match} order by score limit ${SMART_CAP / 2}`,
    );
    for (const r of rows) if (!ranked.has(r.id)) ranked.set(r.id, { bm25: r.score, all });
  };
  await pass(toSmartFts(terms, 'and'), true);
  if (terms.length > 1) await pass(toSmartFts(terms, 'or'), false);
  const forms = smartForms(terms);
  const named = await db
    .select({ id: highlightTags.highlightId })
    .from(highlightTags)
    .innerJoin(tags, eq(tags.id, highlightTags.tagId))
    .where(sql`${sql.join(forms.map((f) => nameLike(tags.name, f)), sql` or `)}`)
    .limit(SMART_CAP / 4);
  for (const r of named) if (!ranked.has(r.id)) ranked.set(r.id, { bm25: null, all: false });
  if (!ranked.size) return { docs: [], rows: new Map() };

  const rows = await db
    .select({ h: highlights, bookmarkTitle: bookmarks.title })
    .from(highlights)
    .leftJoin(bookmarks, eq(bookmarks.id, highlights.bookmarkId))
    .where(inArray(highlights.id, [...ranked.keys()]));
  const links = await db
    .select({ highlightId: highlightTags.highlightId, tag: tags })
    .from(highlightTags)
    .innerJoin(tags, eq(tags.id, highlightTags.tagId))
    .where(inArray(highlightTags.highlightId, [...ranked.keys()]));
  const byId = new Map<string, Tag[]>();
  for (const l of links) byId.set(l.highlightId, [...(byId.get(l.highlightId) ?? []), l.tag]);

  const out = new Map<string, HighlightWithTags>();
  const docs = rows.map<SearchDoc>(({ h, bookmarkTitle }) => {
    const full: HighlightWithTags = { ...h, bookmarkTitle, tags: byId.get(h.id) ?? [] };
    out.set(`h:${h.id}`, full);
    return {
      id: `h:${h.id}`,
      bm25: ranked.get(h.id)!.bm25,
      allTerms: ranked.get(h.id)!.all,
      title: h.text,
      body: [h.note, bookmarkTitle ?? h.sourceTitle].filter(Boolean).join(' '),
      site: null,
      url: h.sourceUrl,
      tags: full.tags.map((t) => t.name),
      folder: null,
      favorite: false,
      unread: false,
      createdAt: h.createdAt.getTime(),
    };
  });
  return { docs, rows: out };
}

/**
 * Smart search for the Search tab. `correct: false` searches exactly what was typed
 * (the "search for the original instead" link).
 */
export async function smartSearch(input: string, opts: { scope?: SmartScope; correct?: boolean } = {}): Promise<SmartResults> {
  const scope = opts.scope ?? 'all';
  let terms = parseQuery(input);
  if (!terms.length) return { hits: [], corrected: null };
  if (opts.correct !== false) terms = applyCorrections(terms, await smartCorrections(terms));

  const [b, h] = await Promise.all([
    scope === 'highlights' ? null : smartBookmarkDocs(terms, scope),
    scope === 'all' || scope === 'highlights' ? smartHighlightDocs(terms) : null,
  ]);
  const ranked = rankDocs(terms, [...(b?.docs ?? []), ...(h?.docs ?? [])]).slice(0, SMART_SHOWN);
  const hits = ranked.flatMap<SmartHit>((r) => {
    const bm = b?.rows.get(r.id);
    if (bm) return [{ kind: 'bookmark', key: r.id, b: bm, why: r.why }];
    const hl = h?.rows.get(r.id);
    return hl ? [{ kind: 'highlight', key: r.id, h: hl, why: r.why }] : [];
  });
  return { hits, corrected: correctedQuery(terms) };
}

/** Most-used tags, for the Search tab's "Try:" chips. */
export async function topTags(n = 5): Promise<TagWithCount[]> {
  const all = await listTags();
  return all.filter((t) => t.count > 0).sort((a, b) => b.count - a.count).slice(0, n);
}
