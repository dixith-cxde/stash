import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';

import { toFtsQuery, whereForFilter } from '@/db/filters';

const dialect = new SQLiteSyncDialect();
const render = (f: Parameters<typeof whereForFilter>[0]) => dialect.sqlToQuery(whereForFilter(f, 1_000_000)!);

describe('toFtsQuery', () => {
  it('quotes tokens as prefix terms and drops FTS syntax', () => {
    expect(toFtsQuery('React-Native "c++" OR foo:bar')).toBe('"react"* "native"* "c"* "or"* "foo"* "bar"*');
  });
  it('returns null for punctuation-only input', () => {
    expect(toFtsQuery(' ** ')).toBeNull();
  });
  it('keeps non-latin letters', () => {
    expect(toFtsQuery('café 東京')).toBe('"café"* "東京"*');
  });
});

describe('whereForFilter', () => {
  it('excludes archived items by default', () => {
    const q = render({});
    expect(q.sql).toContain('"is_archived" = ?');
    expect(q.params).toEqual([0]);
  });

  it('combines types, favorites, tags and recency', () => {
    const q = render({ types: ['link', 'pdf'], favorite: true, tagIds: ['t1', 't2'], withinDays: 1 });
    expect(q.sql).toContain('"type" in (?, ?)');
    expect(q.sql.match(/exists \(select 1 from "bookmark_tags"/g)).toHaveLength(2);
    expect(q.params).toEqual(expect.arrayContaining(['link', 'pdf', 1, 't1', 't2', 1_000_000 - 86_400_000]));
  });

  it('matches root items with folderId null', () => {
    expect(render({ folderId: null }).sql).toContain('"folder_id" is null');
  });

  it('adds an FTS subquery for text queries', () => {
    const q = render({ query: 'hello' });
    expect(q.sql).toContain('bookmarks_fts match ?');
    expect(q.params).toContain('"hello"*');
  });
});
