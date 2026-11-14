/** Screen-level live queries (re-run whenever the database changes). */
import { and, count, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { whereForFilter } from '@/db/filters';
import { useDbQuery } from '@/db/hooks';
import {
  countUnread,
  folderTree,
  type FolderNode,
  highlightCounts,
  queryBookmarks,
  queryHighlights,
} from '@/db/repo';
import { bookmarks, type BookmarkType, highlights, type SmartFilter } from '@/db/schema';

import { type FeedItem, mergeFeed } from './model';

export type Collection = FolderNode & { byType: Partial<Record<BookmarkType, number>> };

/** Top-level collections (folders) with per-type counts, in the user's order. */
export async function loadCollections(): Promise<Collection[]> {
  const [tree, rows] = await Promise.all([
    folderTree(),
    db
      .select({ folderId: bookmarks.folderId, type: bookmarks.type, n: count() })
      .from(bookmarks)
      .where(and(isNotNull(bookmarks.folderId), eq(bookmarks.isArchived, false)))
      .groupBy(bookmarks.folderId, bookmarks.type),
  ]);
  const byFolder = new Map<string, Partial<Record<BookmarkType, number>>>();
  for (const r of rows) byFolder.set(r.folderId!, { ...byFolder.get(r.folderId!), [r.type]: r.n });
  return tree.filter((f) => f.depth === 0).map((f) => ({ ...f, byType: byFolder.get(f.id) ?? {} }));
}

export function useCollections() {
  return useDbQuery(loadCollections, [], [] as Collection[]);
}

export type Totals = {
  all: number;
  unread: number;
  pdfs: number;
  pdfsInProgress: number;
  notes: number;
  highlights: number;
};

const ZERO: Totals = { all: 0, unread: 0, pdfs: 0, pdfsInProgress: 0, notes: 0, highlights: 0 };

export function useTotals() {
  return useDbQuery(
    async (): Promise<Totals> => {
      const active = eq(bookmarks.isArchived, false);
      const [[all], [pdfs], [progress], [notes], [hl], unread] = await Promise.all([
        db.select({ n: count() }).from(bookmarks).where(active),
        db.select({ n: count() }).from(bookmarks).where(and(active, eq(bookmarks.type, 'pdf'))),
        db
          .select({ n: count() })
          .from(bookmarks)
          .where(
            and(active, eq(bookmarks.type, 'pdf'), sql`${bookmarks.lastPage} > 1 and ${bookmarks.lastPage} < ${bookmarks.pageCount}`),
          ),
        db.select({ n: count() }).from(bookmarks).where(and(active, eq(bookmarks.type, 'text'))),
        db.select({ n: count() }).from(highlights),
        countUnread(),
      ]);
      return { all: all.n, unread, pdfs: pdfs.n, pdfsInProgress: progress.n, notes: notes.n, highlights: hl.n };
    },
    [],
    ZERO,
  );
}

/**
 * Feed for a scope: bookmarks matching `filter` plus highlights (all of them on Home, or the
 * ones attached to the scope's bookmarks in a collection), newest first.
 */
export function useFeed(filter: SmartFilter, opts: { highlights?: 'all' | 'scoped' | 'none'; limit?: number } = {}) {
  const { highlights: hlMode = 'all', limit = 120 } = opts;
  const key = JSON.stringify(filter);
  return useDbQuery(
    async (): Promise<FeedItem[]> => {
      const items = await queryBookmarks(filter, limit);
      const ids = items.map((i) => i.id);
      const [counts, hls] = await Promise.all([
        highlightCounts(ids),
        hlMode === 'none'
          ? Promise.resolve([])
          : queryHighlights().then((all) =>
              hlMode === 'all' ? all.slice(0, 40) : all.filter((h) => h.bookmarkId && ids.includes(h.bookmarkId)),
            ),
      ]);
      return mergeFeed(items, hls, counts);
    },
    [key, hlMode, limit],
    [] as FeedItem[],
  );
}

/** Bookmarks in no collection (the capture sheet's "Inbox"). */
export async function inboxCount() {
  const [{ n }] = await db
    .select({ n: count() })
    .from(bookmarks)
    .where(and(isNull(bookmarks.folderId), whereForFilter({})));
  return n;
}
