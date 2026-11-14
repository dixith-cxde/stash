import { extractArticle } from '@/features/feeds/extract';
import { parseReaderMarkdown } from '@/features/reader/discussion';

const PROSE =
  'This paragraph is the article itself, long enough to count as prose for the extractor, with commas, ' +
  'clauses, and the kind of detail a reader came for in the first place.';

const page = (thread: string) => `<!doctype html><html><head>
  <title>Story title | Site</title><meta property="og:site_name" content="Site">
  <meta name="author" content="Jane Writer">
</head><body>
  <main>
    <article class="post">
      <h1>Story title</h1>
      <p>${PROSE}</p><p>${PROSE}</p><p>${PROSE}</p>
      ${thread}
    </article>
  </main>
</body></html>`;

describe('extractArticle comment threads', () => {
  it('lifts a WordPress-style thread with authors, times and replies', () => {
    const html = page(`
      <div id="comments" class="comments-area">
        <h2 class="comments-title">2 thoughts on “Story title”</h2>
        <ol class="comment-list">
          <li id="comment-11" class="comment depth-1">
            <article class="comment-body">
              <footer class="comment-meta">
                <div class="comment-author vcard"><b class="fn">Ann Reader</b> <span class="says">says:</span></div>
                <div class="comment-metadata"><a href="/story#comment-11"><time datetime="2026-11-14T04:01:00+00:00">November 14</time></a></div>
              </footer>
              <div class="comment-content"><p>Great article, thanks.</p></div>
              <div class="reply"><a class="comment-reply-link" href="#">Reply</a></div>
            </article>
            <ol class="children">
              <li id="comment-12" class="comment depth-2">
                <article class="comment-body">
                  <footer class="comment-meta"><div class="comment-author"><b class="fn">Bob</b></div></footer>
                  <div class="comment-content"><p>Agreed!</p></div>
                </article>
              </li>
            </ol>
          </li>
        </ol>
      </div>`);
    const r = extractArticle(html, 'https://site.example.com/story')!;
    const p = parseReaderMarkdown(r.markdown);
    expect(p.body).toContain('This paragraph is the article itself');
    expect(p.body).not.toContain('Great article');
    expect(p.meta?.byline).toBe('Jane Writer');
    const d = p.discussion!;
    expect(d.count).toBe(2);
    expect(d.url).toBe('https://site.example.com/story#comments');
    expect(d.comments).toEqual([
      { author: 'Ann Reader', time: '2026-11-14T04:01:00+00:00', depth: 0, markdown: 'Great article, thanks.', permalink: null },
      { author: 'Bob', time: null, depth: 1, markdown: 'Agreed!', permalink: null },
    ]);
  });

  it('lifts forum posts in <article> elements (XenForo-style) instead of leaking "#1 #2"', () => {
    const post = (n: number, who: string, text: string) => `
      <article class="message message--post" data-author="${who}" data-content="post-${n}">
        <div class="message-cell message-cell--user"><a class="username">${who}</a></div>
        <div class="message-cell message-cell--main">
          <header class="message-attribution"><time datetime="2026-11-14T0${n}:00:00Z">Today</time>
            <a href="/forums/posts/${n}">#${n}</a></header>
          <div class="message-content"><div class="bbWrapper">${text}</div></div>
        </div>
      </article>`;
    const html = page(`<section class="comments"><h2>2 Comments on Story title</h2>${post(1, 'alice', 'First!')}${post(2, 'carol', 'Second <b>post</b>.')}</section>`);
    const r = extractArticle(html, 'https://site.example.com/story')!;
    const p = parseReaderMarkdown(r.markdown);
    expect(p.body).not.toMatch(/#1|#2|First!/);
    expect(p.discussion!.title).toBe('2 Comments');
    expect(p.discussion!.comments.map((c) => [c.author, c.markdown, c.permalink])).toEqual([
      ['alice', 'First!', 'https://site.example.com/forums/posts/1'],
      ['carol', 'Second **post**.', 'https://site.example.com/forums/posts/2'],
    ]);
  });

  it('splits an undetected inline thread off the Markdown and keeps read time to the body', () => {
    const html = page(`<div class="thread-wrap"><h2>3 Comments</h2>
      <div><a href="/p/1">#1</a></div><p>${PROSE}</p>
      <div><a href="/p/2">#2</a></div><p>${PROSE}</p></div>`);
    const r = extractArticle(html, 'https://site.example.com/story')!;
    const p = parseReaderMarkdown(r.markdown);
    expect(p.body).not.toContain('#1');
    expect(p.discussion?.comments).toHaveLength(2);
    expect(p.discussion?.count).toBe(3);
  });

  it('adds nothing for a page without a thread or byline beyond the meta block', () => {
    const r = extractArticle(page(''), 'https://site.example.com/story')!;
    const p = parseReaderMarkdown(r.markdown);
    expect(p.discussion).toBeNull();
    expect(p.body).not.toContain('stash:');
  });
});
