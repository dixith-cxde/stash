import { parseNetscapeBookmarks, toNetscapeHtml } from '@/features/backup/netscape';

const file = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1>
<DL><p>
  <DT><A HREF="https://root.com" ADD_DATE="1700000000">Root link</A>
  <DT><H3 ADD_DATE="1">Work</H3>
  <DL><p>
    <DT><A HREF="https://a.com" TAGS="rn,expo">A &amp; B</A>
    <DD>Description here
    <DT><H3>Deep</H3>
    <DL><p>
      <DT><A HREF="https://deep.com">Deep</A>
    </DL><p>
  </DL><p>
  <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
</DL><p>`;

describe('parseNetscapeBookmarks', () => {
  const items = parseNetscapeBookmarks(file);

  it('reads links with folders, tags, dates and descriptions', () => {
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ url: 'https://root.com', folderPath: [], title: 'Root link' });
    expect(items[0].addedAt?.getTime()).toBe(1700000000 * 1000);
    expect(items[1]).toMatchObject({ url: 'https://a.com', title: 'A & B', tags: ['rn', 'expo'], folderPath: ['Work'], description: 'Description here' });
    expect(items[2]).toMatchObject({ url: 'https://deep.com', folderPath: ['Work', 'Deep'] });
  });

  it('round-trips through the exporter', () => {
    const html = toNetscapeHtml([
      { url: 'https://x.com/?a=1&b=2', title: 'X <y>', createdAt: new Date(1_000_000_000_000), tags: ['t1'], folder: 'F' },
    ]);
    expect(parseNetscapeBookmarks(html)).toEqual([
      expect.objectContaining({ url: 'https://x.com/?a=1&b=2', title: 'X <y>', tags: ['t1'], folderPath: ['F'] }),
    ]);
  });
});
