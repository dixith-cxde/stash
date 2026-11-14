import { extractUrl, normalizeShare, typeForFile } from '@/features/capture/normalize';

describe('normalizeShare', () => {
  it('treats PROCESS_TEXT selections as highlights', () => {
    expect(normalizeShare({ processText: '  a quote  ', text: 'https://x.com' })).toEqual([
      { kind: 'highlight', text: 'a quote', sourceApp: undefined },
    ]);
  });

  it('turns a bare URL into a link titled by host', () => {
    const [d] = normalizeShare({ text: 'https://www.example.com/post/1' });
    expect(d).toMatchObject({ kind: 'bookmark', type: 'link', url: 'https://www.example.com/post/1', title: 'example.com' });
  });

  it('uses surrounding text as the title for "Title https://…" shares', () => {
    const [d] = normalizeShare({ text: 'Great article about RN https://blog.dev/a?b=1' });
    expect(d).toMatchObject({ type: 'link', url: 'https://blog.dev/a?b=1', title: 'Great article about RN' });
  });

  it('prefers webUrl when provided', () => {
    const [d] = normalizeShare({ text: 'Some page', webUrl: 'https://a.io' });
    expect(d).toMatchObject({ type: 'link', url: 'https://a.io', title: 'Some page' });
  });

  it('keeps plain text as a note', () => {
    const [d] = normalizeShare({ text: 'first line\nsecond line' });
    expect(d).toMatchObject({ type: 'text', title: 'first line', content: 'first line\nsecond line' });
  });

  it('creates one bookmark per shared file', () => {
    const drafts = normalizeShare({
      files: [
        { path: 'content://a', mimeType: 'application/pdf', fileName: 'paper.pdf' },
        { path: 'content://b', mimeType: 'image/png', fileName: 'shot.png' },
      ],
    });
    expect(drafts.map((d) => d.kind === 'bookmark' && d.type)).toEqual(['pdf', 'image']);
  });

  it('returns nothing for empty shares', () => {
    expect(normalizeShare({ text: '   ' })).toEqual([]);
  });
});

describe('helpers', () => {
  it('strips trailing punctuation from extracted URLs', () => {
    expect(extractUrl('see (https://a.com/x).')).toBe('https://a.com/x');
  });

  it('detects file types from name when mime is missing', () => {
    expect(typeForFile({ path: '/x/Doc.PDF' })).toBe('pdf');
    expect(typeForFile({ path: '/x/a.zip', mimeType: 'application/zip' })).toBe('file');
    // Text files are files (shown in the file viewer), not editable notes.
    expect(typeForFile({ path: '/x/n.txt', mimeType: 'text/plain' })).toBe('file');
  });
});
