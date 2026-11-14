import {
  aggregatorInfo,
  dropJumpLinks,
  dropLeadingChrome,
  parseReaderMarkdown,
  serializeExtras,
  splitInlineThread,
} from '@/features/reader/discussion';

// Shape of a forum-style thread as an older extractor cached it (TechPowerUp-like page).
const INLINE = [
  'by',
  '[Writer](https://site.example.com/members/writer.1/)',
  'Today, 04:01 [Discuss (3 Comments)](https://site.example.com/1/story#comments)',
  'The article body paragraph with the actual news.',
  'Sources: [Paper](https://paper.example.com/x)',
  '## **3 Comments** on [The Story Title](https://site.example.com/forums/threads/story.1/)',
  '[#1](https://site.example.com/forums/posts/101)',
  'First comment text.\nSecond line.',
  '[#2](https://site.example.com/forums/posts/102)',
  '## [a heading inside a comment](https://en.example.org/wiki/x)',
  '[#3](https://site.example.com/forums/posts/103)',
  '> quoted reply',
  'My answer to that.',
].join('\n\n');

describe('splitInlineThread / parseReaderMarkdown (legacy cached articles)', () => {
  it('lifts "#1 #2" posts out of the body into comments', () => {
    const r = parseReaderMarkdown(INLINE);
    expect(r.body).toContain('The article body paragraph');
    expect(r.body).not.toContain('#1');
    expect(r.body).not.toContain('Comments on');
    expect(r.discussion).not.toBeNull();
    const d = r.discussion!;
    expect(d.title).toBe('3 Comments');
    expect(d.count).toBe(3);
    expect(d.url).toBe('https://site.example.com/forums/threads/story.1/');
    expect(d.comments).toHaveLength(3);
    expect(d.comments[0]).toEqual({
      author: null,
      time: null,
      depth: 0,
      markdown: 'First comment text.\nSecond line.',
      permalink: 'https://site.example.com/forums/posts/101',
    });
    expect(d.comments[2].markdown).toBe('> quoted reply\n\nMy answer to that.');
  });

  it('drops "Discuss (N Comments)" jump links from the byline', () => {
    const r = parseReaderMarkdown(INLINE);
    expect(r.body).not.toContain('Discuss (3 Comments)');
    // The dateline scraps left after it ("by", the author link, "Today, 04:01") go too.
    expect(r.body.startsWith('The article body paragraph')).toBe(true);
    expect(dropJumpLinks('See [12 comments](https://x.example.com/a#respond) here')).toBe('See  here');
  });

  it('leaves articles without a thread alone', () => {
    const md = '## Intro\n\nText about comments in general.\n\n## Comments are useful\n\nMore text.';
    expect(splitInlineThread(md)).toBeNull();
    expect(parseReaderMarkdown(md)).toEqual({ body: md, meta: null, discussion: null });
  });

  it('drops a bare trailing "Leave a Reply" heading', () => {
    const r = splitInlineThread('Body text here.\n\n## Leave a Reply');
    expect(r).toEqual({ body: 'Body text here.', discussion: null });
  });
});

describe('dropLeadingChrome', () => {
  it('drops leading byline and date scraps only', () => {
    const md = 'Saturday, November 14th 2026\n\nby\n\n[Cpt. Writer](https://x.example.com/forums/members/w.1/)\n\nToday, 04:01\n\nReal text.\n\nNovember 12, 2026';
    expect(dropLeadingChrome(md)).toBe('Real text.\n\nNovember 12, 2026');
    expect(dropLeadingChrome('12 Nov 2026\n\nBody')).toBe('Body');
    expect(dropLeadingChrome('By the river we sat.\n\nBody')).toBe('By the river we sat.\n\nBody');
  });
});

describe('serializeExtras round trip', () => {
  it('writes and reads byline, discussion and nested comments', () => {
    const extras = serializeExtras(
      { byline: 'Jane -- Doe', siteName: 'Example' },
      {
        title: 'Comments',
        count: 12,
        url: 'https://x.example.com/a#comments',
        comments: [
          { author: 'ann', time: '2026-11-14T04:01:00Z', depth: 0, markdown: 'Top level --> tricky', permalink: null },
          { author: 'bob', time: null, depth: 1, markdown: 'A reply.\n\nWith two paragraphs.', permalink: 'https://x.example.com/c/2' },
        ],
      },
    );
    // Each marker line closes only at its end: no "-->" inside the JSON.
    for (const line of extras.split('\n').filter((l) => l.startsWith('<!--'))) expect(line.indexOf('-->')).toBe(line.length - 3);
    const md = `Body paragraph.\n\n${extras}`;
    const r = parseReaderMarkdown(md);
    expect(r.body).toBe('Body paragraph.');
    expect(r.meta).toEqual({ byline: 'Jane -- Doe', siteName: 'Example' });
    expect(r.discussion!.count).toBe(12);
    expect(r.discussion!.comments).toEqual([
      { author: 'ann', time: '2026-11-14T04:01:00Z', depth: 0, markdown: 'Top level --> tricky', permalink: null },
      { author: 'bob', time: null, depth: 1, markdown: 'A reply.\n\nWith two paragraphs.', permalink: 'https://x.example.com/c/2' },
    ]);
  });

  it('is empty when there is nothing to add', () => {
    expect(serializeExtras(null, null)).toBe('');
    expect(serializeExtras({ byline: null, siteName: null }, { title: null, count: 0, url: null, comments: [] })).toBe('');
  });
});

describe('aggregatorInfo', () => {
  it('reads the Hacker News thread from hnrss boilerplate', () => {
    const hn = 'Article URL: https://example.com/a\n\nComments URL: https://news.ycombinator.com/item?id=50493251\n\nPoints: 397\n\n# Comments: 201';
    expect(aggregatorInfo(null, hn)).toEqual({
      commentsUrl: 'https://news.ycombinator.com/item?id=50493251',
      comments: 201,
      points: 397,
      site: 'Hacker News',
    });
  });
  it('works on the one-line summary and ignores ordinary text', () => {
    const one = 'Article URL: https://e.com/a Comments URL: https://lobste.rs/s/abc Points: 3 # Comments: 0';
    expect(aggregatorInfo(one)?.site).toBe('Lobsters');
    expect(aggregatorInfo(one)?.comments).toBe(0);
    expect(aggregatorInfo('Just a summary.', null)).toBeNull();
  });
});
