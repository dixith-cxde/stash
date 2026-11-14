import { sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const BOOKMARK_TYPES = ['link', 'pdf', 'text', 'image', 'file'] as const;
export type BookmarkType = (typeof BOOKMARK_TYPES)[number];

export const FETCH_STATUS = ['idle', 'pending', 'done', 'failed'] as const;
export type FetchStatus = (typeof FETCH_STATUS)[number];

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
};

export const folders = sqliteTable(
  'folders',
  {
    id: text('id').primaryKey(),
    parentId: text('parent_id').references((): AnySQLiteColumn => folders.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    /** MaterialShapes name used for the folder avatar, e.g. "cookie9Sided". */
    shape: text('shape').notNull().default('cookie9Sided'),
    /** Seed color (#RRGGBB); the UI derives container/content tones for both themes. */
    color: text('color'),
    /** Icon name from src/theme/icons.ts shown on the collection's card and hero. */
    icon: text('icon'),
    sort: integer('sort').notNull().default(0),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index('folders_parent_idx').on(t.parentId)],
);

export const bookmarks = sqliteTable(
  'bookmarks',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: BOOKMARK_TYPES }).notNull(),
    title: text('title').notNull().default(''),
    description: text('description'),
    url: text('url'),
    /** Text body for text/notes, or extracted text for links/PDFs. */
    content: text('content'),
    note: text('note'),
    /** Local file:// path for PDFs/images/files copied into app storage. */
    filePath: text('file_path'),
    mimeType: text('mime_type'),
    fileSize: integer('file_size'),
    thumbPath: text('thumb_path'),
    imageUrl: text('image_url'),
    favicon: text('favicon'),
    siteName: text('site_name'),
    sourceApp: text('source_app'),
    folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    /** PDFs: total pages and the last page the reader showed (1-based), for progress. */
    pageCount: integer('page_count'),
    lastPage: integer('last_page'),
    /** Links: article length, for "7 min read". */
    wordCount: integer('word_count'),
    /** Videos: length in seconds, when the page exposes it. */
    durationSec: integer('duration_sec'),
    fetchStatus: text('fetch_status', { enum: FETCH_STATUS }).notNull().default('idle'),
    ...timestamps,
  },
  (t) => [
    index('bookmarks_folder_idx').on(t.folderId),
    index('bookmarks_type_idx').on(t.type),
    index('bookmarks_created_idx').on(t.createdAt),
  ],
);

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color'),
  ...timestamps,
});

export const bookmarkTags = sqliteTable(
  'bookmark_tags',
  {
    bookmarkId: text('bookmark_id')
      .notNull()
      .references(() => bookmarks.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.bookmarkId, t.tagId] }), index('bookmark_tags_tag_idx').on(t.tagId)],
);

export const LIST_KINDS = ['manual', 'smart'] as const;

export const lists = sqliteTable('lists', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  kind: text('kind', { enum: LIST_KINDS }).notNull().default('manual'),
  /** JSON-encoded SmartFilter for kind = 'smart'. */
  filter: text('filter', { mode: 'json' }).$type<SmartFilter>(),
  shape: text('shape').notNull().default('clover4Leaf'),
  color: text('color'),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  sort: integer('sort').notNull().default(0),
  ...timestamps,
});

export const listItems = sqliteTable(
  'list_items',
  {
    listId: text('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    bookmarkId: text('bookmark_id')
      .notNull()
      .references(() => bookmarks.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    addedAt: integer('added_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => [primaryKey({ columns: [t.listId, t.bookmarkId] })],
);

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'purple'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const highlights = sqliteTable(
  'highlights',
  {
    id: text('id').primaryKey(),
    /** Optional: highlight can belong to a saved bookmark (e.g. a PDF page) or stand alone. */
    bookmarkId: text('bookmark_id').references(() => bookmarks.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    note: text('note'),
    color: text('color', { enum: HIGHLIGHT_COLORS }).notNull().default('yellow'),
    sourceApp: text('source_app'),
    sourceUrl: text('source_url'),
    sourceTitle: text('source_title'),
    /** Page number for PDFs. */
    page: integer('page'),
    ...timestamps,
  },
  (t) => [index('highlights_bookmark_idx').on(t.bookmarkId)],
);

export const highlightTags = sqliteTable(
  'highlight_tags',
  {
    highlightId: text('highlight_id')
      .notNull()
      .references(() => highlights.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.highlightId, t.tagId] })],
);

/** Saved filter that powers a smart list. Every field is optional and AND-combined. */
export type SmartFilter = {
  types?: BookmarkType[];
  tagIds?: string[];
  folderId?: string | null;
  favorite?: boolean;
  unread?: boolean;
  archived?: boolean;
  query?: string;
  /** Only items created within the last N days. */
  withinDays?: number;
};

export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type List = typeof lists.$inferSelect;
export type Highlight = typeof highlights.$inferSelect;

/* --------------------------------- Feeds ---------------------------------- */

/** An RSS/Atom subscription. */
export const feeds = sqliteTable('feeds', {
  id: text('id').primaryKey(),
  /** The feed document's URL (after autodiscovery). */
  url: text('url').notNull().unique(),
  title: text('title').notNull(),
  siteUrl: text('site_url'),
  description: text('description'),
  iconUrl: text('icon_url'),
  /** Conditional-GET validators, so unchanged feeds cost one tiny request. */
  etag: text('etag'),
  lastModified: text('last_modified'),
  lastFetchedAt: integer('last_fetched_at', { mode: 'timestamp_ms' }),
  lastError: text('last_error'),
  ...timestamps,
});

/** One article from a feed. Saving it to the stash creates a bookmark and links it here. */
export const feedItems = sqliteTable(
  'feed_items',
  {
    id: text('id').primaryKey(),
    feedId: text('feed_id')
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    guid: text('guid').notNull(),
    url: text('url'),
    title: text('title').notNull(),
    summary: text('summary'),
    content: text('content'),
    author: text('author'),
    imageUrl: text('image_url'),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    /** Hidden from the list by the user (swipe or menu). */
    hiddenAt: integer('hidden_at', { mode: 'timestamp_ms' }),
    /**
     * The full article as Markdown, extracted from its web page the first time it is opened
     * (feeds like Hacker News carry only links). '' = extraction found nothing; null = not tried.
     */
    article: text('article'),
    articleChars: integer('article_chars'),
    bookmarkId: text('bookmark_id').references(() => bookmarks.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('feed_items_feed_idx').on(t.feedId, t.publishedAt),
    index('feed_items_published_idx').on(t.publishedAt),
    uniqueIndex('feed_items_guid_idx').on(t.feedId, t.guid),
  ],
);

export type Feed = typeof feeds.$inferSelect;
export type FeedItem = typeof feedItems.$inferSelect;
