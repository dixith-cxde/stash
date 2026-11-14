import type { BookmarkWithTags } from '@/db/repo';
import { checkLink, healthFromStatus, runPool } from '@/features/links/check';
import { highlightsMarkdown, readingQueue } from '@/features/stash/model';
import { savedOn } from '@/lib/format';

let n = 0;
const bm = (p: Partial<BookmarkWithTags>): BookmarkWithTags =>
  ({
    id: `b${++n}`,
    type: 'link',
    title: 't',
    url: null,
    isArchived: false,
    readAt: null,
    pageCount: null,
    lastPage: null,
    sourceApp: null,
    wordCount: null,
    createdAt: new Date(2026, 10, n),
    updatedAt: new Date(2026, 10, n),
    tags: [],
    ...p,
  }) as BookmarkWithTags;

describe('readingQueue', () => {
  it('puts part-read PDFs first, then unread reading, and skips apps and finished items', () => {
    const pdf = bm({ type: 'pdf', pageCount: 20, lastPage: 5, readAt: new Date() });
    const done = bm({ type: 'pdf', pageCount: 20, lastPage: 20, readAt: new Date() });
    const article = bm({ url: 'https://example.com/a', sourceApp: 'Feeds' });
    const app = bm({ url: 'https://play.google.com/store/apps/details?id=x' });
    const unreadPdf = bm({ type: 'pdf', pageCount: 3 });
    const q = readingQueue([pdf, done, article, app, unreadPdf]);
    expect(q.map((e) => e.item.id)).toEqual([pdf.id, unreadPdf.id, article.id]);
    expect(q[0].progress).toBe(0.25);
  });
});

describe('highlightsMarkdown', () => {
  it('writes quotes with pages', () => {
    const md = highlightsMarkdown({ title: 'Doc', url: null, type: 'pdf' }, [{ text: 'Line one', page: 2, note: null }]);
    expect(md).toBe('# Doc\n\n> Line one\n>\n> — p. 2\n');
  });
});

describe('savedOn', () => {
  const now = new Date(2026, 10, 14, 12);
  it('names nearby days and dates', () => {
    expect(savedOn(new Date(2026, 10, 14, 1), now)).toBe('today');
    expect(savedOn(new Date(2026, 10, 13, 23), now)).toBe('yesterday');
    expect(savedOn(new Date(2026, 10, 2), now)).toBe('on Nov 2');
    expect(savedOn(new Date(2025, 0, 5), now)).toBe('on Jan 5, 2025');
  });
});

describe('link check', () => {
  it('maps statuses', () => {
    expect(healthFromStatus(200)).toBe('ok');
    expect(healthFromStatus(404)).toBe('broken');
    expect(healthFromStatus(403)).toBe('unsure');
  });
  it('treats a failed connection as broken', async () => {
    const f = (() => Promise.reject(new TypeError('Network request failed'))) as unknown as typeof fetch;
    expect(await checkLink('https://gone.invalid', f)).toBe('broken');
  });
  it('runs a pool and reports every item', async () => {
    const seen: number[] = [];
    await runPool([1, 2, 3, 4, 5], 2, async (x) => x * 2, (_, r) => seen.push(r));
    expect(seen.sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10]);
  });
});
