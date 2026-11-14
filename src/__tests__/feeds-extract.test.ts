import { extractArticle } from '@/features/feeds/extract';

const LOREM =
  'Reader mode should keep the prose, which is the whole point, and drop everything around it, ' +
  'including menus, share buttons, and comment threads that nobody asked for.';

const BLOG = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Why plain text wins | Example Blog</title>
  <meta property="og:title" content="Why plain text wins">
  <meta property="og:site_name" content="Example Blog">
  <meta property="og:image" content="/img/cover.jpg">
  <meta name="author" content="Jane Doe">
  <script>window.dataLayer = [];</script>
  <style>.x { color: red }</style>
</head>
<body>
  <header class="site-header"><a href="/">Example Blog</a><nav><a href="/about">About</a><a href="/archive">Archive</a></nav></header>
  <div class="share-bar"><a href="https://twitter.com/share">Share on Twitter</a></div>
  <article class="post">
    <h1>Why plain text wins</h1>
    <p class="byline">By Jane Doe</p>
    <p>First paragraph with <strong>bold</strong>, <em>italic</em> and a <a href="/posts/other">relative link</a>. ${LOREM}</p>
    <h2>Section &amp; more</h2>
    <p>Second paragraph &mdash; with an entity.<br>And a line break.</p>
    <ul>
      <li>One</li>
      <li>Two with <code>code</code>
        <ol><li>Nested</li></ol>
      </li>
    </ul>
    <blockquote><p>Quoted wisdom.</p></blockquote>
    <figure>
      <img src="images/chart.png" alt="A chart" width="640" height="480">
      <figcaption>The chart</figcaption>
    </figure>
    <img src="https://tracker.example.com/pixel.gif" width="1" height="1">
    <pre><code class="language-ts">const x = 1;
if (x &lt; 2) {
  go();
}</code></pre>
    <p><a href="javascript:void(0)">Do not link</a> me.</p>
    <div class="share-buttons"><a href="#">Share this</a></div>
    <p style="display:none">Hidden text</p>
    <div class="comments"><h3>3 comments</h3><p>Great post, would read again, a thousand times over.</p></div>
  </article>
  <aside class="sidebar"><h3>Popular</h3><a href="/a">Other post</a></aside>
  <footer><p>&copy; 2026 Example</p></footer>
</body>
</html>`;

describe('extractArticle', () => {
  it('extracts a typical blog post from an <article>', () => {
    const r = extractArticle(BLOG, 'https://blog.example.com/posts/plain-text')!;
    expect(r).not.toBeNull();
    const md = r.markdown;
    expect(md).toContain(
      'First paragraph with **bold**, *italic* and a [relative link](https://blog.example.com/posts/other).',
    );
    expect(md).toContain('## Section & more');
    expect(md).toContain('Second paragraph — with an entity.\nAnd a line break.');
    expect(md).toContain('- One\n- Two with `code`\n  1. Nested');
    expect(md).toContain('> Quoted wisdom.');
    expect(md).toContain('![A chart](https://blog.example.com/posts/images/chart.png)\n\n*The chart*');
    expect(md).toContain('```ts\nconst x = 1;\nif (x < 2) {\n  go();\n}\n```');
    expect(md).toContain('Do not link me.');
    // The title h1 is not repeated in the body.
    expect(md).not.toMatch(/^## Why plain text wins/m);
    for (const junk of ['Archive', 'Share', 'Hidden text', 'comments', 'Great post', 'Popular', '2026', 'pixel', 'javascript']) {
      expect(md).not.toContain(junk);
    }
    expect(md).not.toMatch(/\n{3,}/);
    expect(r.chars).toBeGreaterThan(150);
    expect(r.title).toBe('Why plain text wins');
    expect(r.byline).toBe('Jane Doe');
    expect(r.siteName).toBe('Example Blog');
    expect(r.imageUrl).toBe('https://blog.example.com/img/cover.jpg');
  });

  it('scores div soup and picks the story over link lists', () => {
    const para = (n: number) =>
      `<p>Paragraph ${n} of the story, with commas, clauses, and detail, describing what happened in the city council meeting on Tuesday night, at length.</p>`;
    const links = Array.from({ length: 12 }, (_, i) => `<div><a href="/n/${i}">Trending headline number ${i} about something</a></div>`).join('');
    const html = `<html><head><title>Council approves budget - The Daily</title></head><body>
      <div id="wrap">
        <div class="top-links">${links}</div>
        <div class="col-left">
          <div class="story-text">${[1, 2, 3, 4, 5].map(para).join('')}</div>
        </div>
        <div class="col-right"><div class="trending">${links}</div></div>
      </div></body></html>`;
    const r = extractArticle(html, 'https://news.example.com/2026/budget')!;
    expect(r).not.toBeNull();
    expect(r.markdown).toContain('Paragraph 1 of the story');
    expect(r.markdown).toContain('Paragraph 5 of the story');
    expect(r.markdown).not.toContain('Trending headline');
    expect(r.title).toBe('Council approves budget - The Daily');
  });

  it('uses lazy image sources and skips tiny images', () => {
    const html = `<html><body><article>
      <p>${LOREM}</p>
      <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-src="/media/photo.jpg" alt="Photo">
      <img src="/static/placeholder.png" data-srcset="/media/a-800.jpg 800w, /media/a-1600.jpg 1600w" alt="Srcset">
      <img class="lazy" data-lazy-src="//cdn.example.com/b.png" alt="Protocol relative">
      <img src="/icons/avatar.png" width="40" height="40" alt="Avatar">
      <p>Another paragraph with <a href="/x"><img src="/media/inline.jpg" alt="Inline"> linked image</a> inside.</p>
    </article></body></html>`;
    const r = extractArticle(html, 'https://site.example.com/a/b')!;
    expect(r.markdown).toContain('![Photo](https://site.example.com/media/photo.jpg)');
    expect(r.markdown).toContain('![Srcset](https://site.example.com/media/a-800.jpg)');
    expect(r.markdown).toContain('![Protocol relative](https://cdn.example.com/b.png)');
    expect(r.markdown).not.toContain('avatar');
    expect(r.markdown).not.toContain('data:');
    expect(r.markdown).toContain(
      'Another paragraph with [linked image](https://site.example.com/x) inside.\n\n![Inline](https://site.example.com/media/inline.jpg)',
    );
  });

  it('extracts a GitHub-release-like page from <main> / markdown-body', () => {
    const html = `<html><head>
      <meta property="og:title" content="Release v2.0.0 · acme/widget">
      <meta property="og:site_name" content="GitHub">
      <meta property="og:image" content="https://opengraph.githubassets.com/abc/acme/widget">
    </head><body>
      <header class="AppHeader"><nav><a href="/features">Features</a></nav></header>
      <main>
        <div class="Layout-sidebar"><a href="/acme/widget/releases">Releases 12</a></div>
        <h1 class="d-inline">v2.0.0</h1>
        <div class="markdown-body my-3">
          <h2>What's Changed</h2>
          <p>This release rewrites the tokenizer for speed.</p>
          <ul>
            <li>Faster parsing of large inputs by <a href="https://github.com/jdoe">@jdoe</a> in <a href="https://github.com/acme/widget/pull/42">#42</a></li>
            <li>Fix crash on empty config files by <a href="https://github.com/asmith">@asmith</a></li>
          </ul>
          <p><strong>Full Changelog</strong>: <a href="https://github.com/acme/widget/compare/v1.9.0...v2.0.0">v1.9.0...v2.0.0</a></p>
        </div>
      </main>
      <footer>© GitHub</footer>
    </body></html>`;
    const r = extractArticle(html, 'https://github.com/acme/widget/releases/tag/v2.0.0')!;
    expect(r).not.toBeNull();
    expect(r.markdown).toMatch(/^## What's Changed/);
    expect(r.markdown).toContain(
      '- Faster parsing of large inputs by [@jdoe](https://github.com/jdoe) in [#42](https://github.com/acme/widget/pull/42)',
    );
    expect(r.markdown).toContain('**Full Changelog**: [v1.9.0...v2.0.0]');
    expect(r.markdown).not.toContain('Releases 12');
    expect(r.markdown).not.toContain('Features');
    expect(r.title).toBe('Release v2.0.0 · acme/widget');
    expect(r.siteName).toBe('GitHub');
    expect(r.imageUrl).toBe('https://opengraph.githubassets.com/abc/acme/widget');
  });

  it('returns null for a JS app shell', () => {
    const html = `<!doctype html><html><head><title>App</title>
      <script type="module" src="/assets/index.js"></script></head>
      <body><noscript>You need to enable JavaScript to run this app. ${LOREM}</noscript><div id="root"></div></body></html>`;
    expect(extractArticle(html, 'https://app.example.com/')).toBeNull();
    expect(extractArticle('%PDF-1.7 binary', 'https://x.example.com/a.pdf')).toBeNull();
    expect(extractArticle('', 'https://x.example.com/')).toBeNull();
  });

  it('extracts metadata from meta tags, rel=author and <title> fallbacks', () => {
    const body = `<article><p>${LOREM} ${LOREM}</p></article>`;
    const a = extractArticle(
      `<html><head>
        <meta name="twitter:image" content="https://cdn.example.com/card.png">
        <meta property="og:site_name" content="Daily Planet">
        <title>Big news today | Daily Planet</title>
      </head><body><a rel="author" href="/u/ck">Clark Kent</a>${body}</body></html>`,
      'https://planet.example.com/news/1',
    )!;
    expect(a.title).toBe('Big news today');
    expect(a.byline).toBe('Clark Kent');
    expect(a.imageUrl).toBe('https://cdn.example.com/card.png');
    expect(a.siteName).toBe('Daily Planet');

    const b = extractArticle(`<html><body><h1>Only a heading</h1>${body}</body></html>`, 'https://x.example.com/')!;
    expect(b.title).toBe('Only a heading');
    expect(b.byline).toBeNull();
    expect(b.imageUrl).toBeNull();
    expect(b.siteName).toBeNull();
  });

  it('renders tables as rows and caps markdown length', () => {
    const table = `<table><tr><th>Name</th><th>Score</th></tr><tr><td>Ada</td><td>10</td></tr></table>`;
    const r = extractArticle(`<article><p>${LOREM}</p>${table}</article>`, 'https://x.example.com/')!;
    expect(r.markdown).toContain('Name | Score\nAda | 10');

    const huge = `<article>${Array.from({ length: 800 }, () => `<p>${LOREM}</p>`).join('')}</article>`;
    expect(extractArticle(huge, 'https://x.example.com/')!.markdown.length).toBeLessThanOrEqual(60_000);
  });
});
