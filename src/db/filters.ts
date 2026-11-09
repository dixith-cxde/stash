import { and, desc, eq, exists, gte, inArray, isNull, isNotNull, type SQL, sql } from 'drizzle-orm';

import { bookmarks, bookmarkTags, type SmartFilter } from './schema';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Builds the WHERE clause for a SmartFilter. Kept pure so it can be unit-tested and
 * reused by smart lists, the Home type filter and the search screen.
 */
export function whereForFilter(filter: SmartFilter, now = Date.now()): SQL | undefined {
  const parts: (SQL | undefined)[] = [];

  parts.push(eq(bookmarks.isArchived, filter.archived ?? false));

  if (filter.types?.length) parts.push(inArray(bookmarks.type, filter.types));
  if (filter.favorite) parts.push(eq(bookmarks.isFavorite, true));
  if (filter.unread) parts.push(isNull(bookmarks.readAt));
  if (filter.unread === false) parts.push(isNotNull(bookmarks.readAt));

  if (filter.folderId !== undefined) {
    parts.push(filter.folderId === null ? isNull(bookmarks.folderId) : eq(bookmarks.folderId, filter.folderId));
  }

  if (filter.withinDays) {
    parts.push(gte(bookmarks.createdAt, new Date(now - filter.withinDays * DAY_MS)));
  }

  // Every selected tag must be present (AND semantics) — matches how people narrow down.
  for (const tagId of filter.tagIds ?? []) {
    parts.push(
      exists(
        sql`(select 1 from ${bookmarkTags} where ${bookmarkTags.bookmarkId} = ${bookmarks.id} and ${bookmarkTags.tagId} = ${tagId})`,
      ),
    );
  }

  if (filter.query?.trim()) {
    const match = toFtsQuery(filter.query);
    if (match) {
      parts.push(sql`${bookmarks}.rowid in (select rowid from bookmarks_fts where bookmarks_fts match ${match})`);
    }
  }

  return and(...parts.filter(Boolean));
}

export const newestFirst = [desc(bookmarks.createdAt)];

/**
 * Converts free text into a safe FTS5 query: every token becomes a quoted prefix term,
 * so user input can never produce an FTS syntax error ("c++", "foo:bar", unbalanced quotes).
 */
export function toFtsQuery(input: string): string | null {
  const tokens = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 12);
  if (!tokens.length) return null;
  return tokens.map((t) => `"${t}"*`).join(' ');
}
