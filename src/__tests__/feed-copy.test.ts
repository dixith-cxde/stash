import type { BookmarkWithTags, HighlightWithTags } from '@/db/repo';
import { copiedMessage, copyTargets } from '@/features/feed/copy';
import type { FeedItem } from '@/features/stash/model';

const bookmark = (b: Partial<BookmarkWithTags>): FeedItem => ({
  kind: 'bookmark',
  key: 'b',
  at: 0,
  highlightCount: 0,
  item: {
    id: 'b1',
    type: 'link',
    url: null,
    title: 'Title',
    content: null,
    tags: [],
    ...b,
  } as BookmarkWithTags,
});

const highlight = (h: Partial<HighlightWithTags>): FeedItem => ({
  kind: 'highlight',
  key: 'h',
  at: 0,
  highlight: {
    id: 'h1',
    text: 'Quoted',
    sourceUrl: null,
    sourceTitle: null,
    bookmarkTitle: null,
    tags: [],
    ...h,
  } as HighlightWithTags,
});

describe('copyTargets', () => {
  it('copies a link card URL', () => {
    const t = copyTargets(bookmark({ url: 'https://example.com/a', title: 'A' }));
    expect(t).toEqual({
      link: 'https://example.com/a',
      primary: 'link',
      title: 'A',
    });
    expect(copiedMessage(t, 'link')).toBe('Link copied');
  });

  it('copies a video URL', () => {
    const t = copyTargets(bookmark({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }));
    expect(t.primary).toBe('link');
    expect(t.link).toContain('youtube.com');
  });

  it('copies a note as its Markdown', () => {
    const t = copyTargets(bookmark({ type: 'text', title: '', content: '# Plan\n- [ ] One' }));
    expect(t).toEqual({
      text: '# Plan\n- [ ] One',
      noun: 'Note',
      primary: 'text',
      title: 'Untitled note',
    });
    expect(copiedMessage(t, 'text')).toBe('Note copied');
  });

  it('has no button for an empty note', () => {
    expect(copyTargets(bookmark({ type: 'text', content: '  ' })).primary).toBeUndefined();
  });

  it('copies a highlight and keeps its web source for the sheet', () => {
    const t = copyTargets(
      highlight({
        text: 'Be brief.',
        sourceUrl: 'https://x.org/p',
        sourceTitle: 'Essay',
      }),
    );
    expect(t).toEqual({
      link: 'https://x.org/p',
      text: 'Be brief.',
      noun: 'Highlight',
      primary: 'text',
      title: 'Essay',
    });
    expect(copiedMessage(t, 'text')).toBe('Highlight copied');
  });

  it('copies a text file body', () => {
    const t = copyTargets(
      bookmark({
        type: 'file',
        title: 'notes.md',
        filePath: 'file:///x/notes.md',
        content: 'hello',
      }),
    );
    expect(t).toMatchObject({ text: 'hello', noun: 'Text', primary: 'text' });
    expect(copiedMessage(t, 'text')).toBe('Text copied');
  });

  it('never offers a local path as a link', () => {
    const t = copyTargets(bookmark({ type: 'pdf', url: 'file:///data/doc.pdf' }));
    expect(t.link).toBeUndefined();
    expect(t.primary).toBeUndefined();
  });

  it('offers a PDF web URL in the sheet but shows no button', () => {
    const t = copyTargets(bookmark({ type: 'pdf', url: 'https://x.org/doc.pdf' }));
    expect(t.link).toBe('https://x.org/doc.pdf');
    expect(t.primary).toBeUndefined();
  });
});
