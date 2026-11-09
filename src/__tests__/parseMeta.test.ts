import { decodeEntities, parseMeta, youtubeId } from '@/features/preview/parseMeta';

const html = `<!doctype html><html><head>
  <title>  Fallback &amp; Title </title>
  <meta property="og:title" content="OG &quot;Title&quot;">
  <meta name="description" content="Plain description">
  <meta property='og:image' content='/img/hero.png'>
  <meta property="og:site_name" content="Example">
  <link rel="icon" href="/fav.svg">
</head><body></body></html>`;

describe('parseMeta', () => {
  it('prefers OpenGraph and resolves relative URLs', () => {
    expect(parseMeta(html, 'https://example.com/a/b')).toEqual({
      title: 'OG "Title"',
      description: 'Plain description',
      image: 'https://example.com/img/hero.png',
      siteName: 'Example',
      favicon: 'https://example.com/fav.svg',
      url: undefined,
    });
  });

  it('falls back to <title> and /favicon.ico', () => {
    const m = parseMeta('<title>Hi &#39;there&#39;</title>', 'https://x.org/p');
    expect(m.title).toBe("Hi 'there'");
    expect(m.favicon).toBe('https://x.org/favicon.ico');
  });

  it('decodes numeric entities', () => {
    expect(decodeEntities('&#x2014; &#8212;')).toBe('— —');
  });
});

describe('youtubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc123', 'abc123'],
    ['https://youtu.be/xyz?t=3', 'xyz'],
    ['https://m.youtube.com/shorts/s1', 's1'],
    ['https://example.com/watch?v=no', null],
  ])('%s → %s', (url, id) => expect(youtubeId(url)).toBe(id));
});
