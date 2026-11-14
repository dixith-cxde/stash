import { discoverFeeds, htmlToText, looksLikeFeed, parseFeed } from '@/features/feeds/parse';

const RSS2 = `\uFEFF<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/style.xsl"?>
<!-- generator: test -->
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Example &amp; Co <![CDATA[Blog]]></title>
  <atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml" />
  <link>https://example.com/</link>
  <description><![CDATA[News <b>about</b> things]]></description>
  <image><url>/logo.png</url><title>Example</title></image>
  <item>
    <title><![CDATA[First post: <em>CDATA</em> & friends]]></title>
    <link>/posts/first?a=1&amp;b=2</link>
    <guid isPermaLink="false">tag:example.com,2024:1</guid>
    <pubDate>Tue, 05 Mar 2024 14:30:00 +0100</pubDate>
    <dc:creator>Jane Doe</dc:creator>
    <description><![CDATA[<p>Short <a href="/x">summary</a> here.</p>]]></description>
    <content:encoded><![CDATA[
      <h2>Heading</h2>
      <p>First paragraph with &mdash; dash.</p>
      <script>alert('x')</script>
      <ul><li>One</li><li>Two</li></ul>
      <p><img src="/inline.jpg" alt=""> Last.</p>
    ]]></content:encoded>
    <media:thumbnail url='/thumb.jpg' width='300' />
  </item>
  <item>
    <title>Escaped markup</title>
    <link>https://example.com/posts/second</link>
    <description>&lt;p&gt;Hello &amp;amp; &lt;strong&gt;world&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;&lt;img src="https://cdn.example.com/a.png"&gt;&lt;/p&gt;</description>
    <author>bob@example.com (Bob Smith)</author>
    <enclosure url="https://cdn.example.com/ep.mp3" type="audio/mpeg" length="1" />
    <pubDate>Wed, 6 Mar 24 09:00 GMT</pubDate>
  </item>
  <item>
    <title>Double escaped</title>
    <guid>https://example.com/posts/third</guid>
    <description>&amp;lt;p&amp;gt;Hi there&amp;lt;/p&amp;gt;</description>
    <enclosure url="https://cdn.example.com/pic.jpg" type="image/jpeg" length="1" />
    <pubDate>not a date</pubDate>
  </item>
  <item></item>
</channel>
</rss>`;

describe('parseFeed — RSS 2.0', () => {
  const feed = parseFeed(RSS2, 'https://feeds.example.com/rss');

  it('parses channel metadata', () => {
    expect(feed.title).toBe('Example & Co Blog');
    expect(feed.siteUrl).toBe('https://example.com/');
    expect(feed.description).toBe('News about things');
    expect(feed.iconUrl).toBe('https://example.com/logo.png');
  });

  it('skips empty items and keeps document order', () => {
    expect(feed.items.map((i) => i.title)).toEqual(['First post: CDATA & friends', 'Escaped markup', 'Double escaped']);
  });

  it('parses a CDATA item with content:encoded, media:thumbnail and relative link', () => {
    const it = feed.items[0];
    expect(it.guid).toBe('tag:example.com,2024:1');
    expect(it.url).toBe('https://example.com/posts/first?a=1&b=2');
    expect(it.author).toBe('Jane Doe');
    expect(it.summary).toBe('Short summary here.');
    expect(it.content).toBe('Heading\n\nFirst paragraph with — dash.\n\n• One\n• Two\n\nLast.');
    expect(it.imageUrl).toBe('https://example.com/thumb.jpg');
    expect(it.publishedAt?.toISOString()).toBe('2024-03-05T13:30:00.000Z');
  });

  it('handles entity-escaped markup, email authors and non-image enclosures', () => {
    const it = feed.items[1];
    expect(it.guid).toBe('https://example.com/posts/second');
    expect(it.summary).toBe('Hello & world');
    expect(it.content).toBe('Hello & world');
    expect(it.author).toBe('Bob Smith');
    expect(it.imageUrl).toBe('https://cdn.example.com/a.png');
    expect(it.publishedAt?.toISOString()).toBe('2024-03-06T09:00:00.000Z');
  });

  it('handles double-escaped markup, permalink guids and image enclosures', () => {
    const it = feed.items[2];
    expect(it.url).toBe('https://example.com/posts/third');
    expect(it.guid).toBe('https://example.com/posts/third');
    expect(it.summary).toBe('Hi there');
    expect(it.content).toBe('Hi there');
    expect(it.imageUrl).toBe('https://cdn.example.com/pic.jpg');
    expect(it.publishedAt).toBeNull();
  });
});

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title type="html">Atom &lt;i&gt;Feed&lt;/i&gt;</title>
  <subtitle>All the things</subtitle>
  <link href="https://blog.example.org/atom.xml" rel="self"/>
  <link href="https://blog.example.org/" />
  <icon>/favicon.png</icon>
  <logo>/logo.png</logo>
  <id>urn:uuid:feed</id>
  <updated>2024-01-02T10:00:00Z</updated>
  <author><name>Feed Author</name></author>
  <entry>
    <title>XHTML entry</title>
    <link rel="alternate" type="text/html" href="/2024/01/xhtml"/>
    <link rel="edit" href="/edit/1"/>
    <link rel="enclosure" type="audio/mpeg" href="/a.mp3"/>
    <id>urn:uuid:1</id>
    <published>2024-01-02T10:00:00+02:00</published>
    <updated>2024-01-03T10:00:00Z</updated>
    <summary type="text">A plain &amp; simple summary.</summary>
    <content type="xhtml">
      <div xmlns="http://www.w3.org/1999/xhtml">
        <p>Para <b>one</b> &amp; more.</p>
        <p>Para two<br/>next line</p>
        <img src="/img/pic.png"/>
      </div>
    </content>
  </entry>
  <entry>
    <title type="html">&lt;b&gt;HTML&lt;/b&gt; entry</title>
    <link rel="edit" href="https://blog.example.org/edit/2"/>
    <link href="https://blog.example.org/2024/01/html"/>
    <id>urn:uuid:2</id>
    <updated>2024-01-04</updated>
    <author><name>Entry Author</name></author>
    <content type="html">&lt;p&gt;Hello&lt;/p&gt;&lt;ol&gt;&lt;li&gt;a&lt;/li&gt;&lt;li&gt;b&lt;/li&gt;&lt;/ol&gt;</content>
    <media:thumbnail url="https://cdn.example.org/t.jpg"/>
  </entry>
</feed>`;

describe('parseFeed — Atom', () => {
  const feed = parseFeed(ATOM, 'https://blog.example.org/atom.xml');

  it('parses feed metadata with rel=alternate default', () => {
    expect(feed.title).toBe('Atom Feed');
    expect(feed.siteUrl).toBe('https://blog.example.org/');
    expect(feed.description).toBe('All the things');
    expect(feed.iconUrl).toBe('https://blog.example.org/favicon.png');
    expect(feed.items).toHaveLength(2);
  });

  it('parses xhtml content and picks the alternate link among many', () => {
    const it = feed.items[0];
    expect(it.guid).toBe('urn:uuid:1');
    expect(it.url).toBe('https://blog.example.org/2024/01/xhtml');
    expect(it.title).toBe('XHTML entry');
    expect(it.summary).toBe('A plain & simple summary.');
    expect(it.content).toBe('Para one & more.\n\nPara two\nnext line');
    expect(it.author).toBe('Feed Author');
    expect(it.imageUrl).toBe('https://blog.example.org/img/pic.png');
    expect(it.publishedAt?.toISOString()).toBe('2024-01-02T08:00:00.000Z');
  });

  it('parses html content, html titles and entry authors', () => {
    const it = feed.items[1];
    expect(it.title).toBe('HTML entry');
    expect(it.url).toBe('https://blog.example.org/2024/01/html');
    expect(it.content).toBe('Hello\n\n• a\n• b');
    expect(it.summary).toBe('Hello • a • b');
    expect(it.author).toBe('Entry Author');
    expect(it.imageUrl).toBe('https://cdn.example.org/t.jpg');
    expect(it.publishedAt?.toISOString()).toBe('2024-01-04T00:00:00.000Z');
  });
});

const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="http://rdf.example.net/">
    <title>RDF Site</title>
    <link>http://rdf.example.net/</link>
    <description>RSS 1.0 feed</description>
    <image rdf:resource="http://rdf.example.net/logo.gif" />
    <items><rdf:Seq><rdf:li resource="http://rdf.example.net/1" /></rdf:Seq></items>
  </channel>
  <image rdf:about="http://rdf.example.net/logo.gif">
    <url>http://rdf.example.net/logo.gif</url>
  </image>
  <item rdf:about="http://rdf.example.net/1">
    <title>RDF item one</title>
    <link>http://rdf.example.net/1</link>
    <description>Desc one</description>
    <dc:date>2023-12-31T23:59:59-05:00</dc:date>
    <dc:creator>Rita</dc:creator>
  </item>
  <item rdf:about="http://rdf.example.net/2">
    <title>RDF item two</title>
  </item>
</rdf:RDF>`;

describe('parseFeed — RSS 1.0 (RDF)', () => {
  const feed = parseFeed(RDF, 'http://rdf.example.net/index.rdf');

  it('parses channel and root-level items', () => {
    expect(feed.title).toBe('RDF Site');
    expect(feed.siteUrl).toBe('http://rdf.example.net/');
    expect(feed.description).toBe('RSS 1.0 feed');
    expect(feed.iconUrl).toBe('http://rdf.example.net/logo.gif');
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]).toEqual({
      guid: 'http://rdf.example.net/1',
      url: 'http://rdf.example.net/1',
      title: 'RDF item one',
      summary: 'Desc one',
      content: 'Desc one',
      author: 'Rita',
      imageUrl: null,
      publishedAt: new Date('2024-01-01T04:59:59.000Z'),
    });
    expect(feed.items[1].url).toBe('http://rdf.example.net/2');
    expect(feed.items[1].guid).toBe('http://rdf.example.net/2');
  });
});

describe('parseFeed — errors and limits', () => {
  it('throws on HTML pages and garbage', () => {
    const html = '<!doctype html><html><head><title>Hi</title></head><body><p>x</p></body></html>';
    expect(() => parseFeed(html, 'https://x.com/')).toThrow('Not a feed');
    expect(() => parseFeed('', 'https://x.com/')).toThrow('Not a feed');
    expect(() => parseFeed('just text', 'https://x.com/')).toThrow('Not a feed');
    expect(() => parseFeed('<rss version="2.0"></rss>', 'https://x.com/')).toThrow('Not a feed');
  });

  it('caps items at 100 in document order', () => {
    const items = Array.from({ length: 150 }, (_, i) => `<item><title>T${i}</title><link>/p/${i}</link></item>`).join('');
    const feed = parseFeed(`<rss><channel><title>Big</title>${items}</channel></rss>`, 'https://big.example/feed');
    expect(feed.items).toHaveLength(100);
    expect(feed.items[0].url).toBe('https://big.example/p/0');
    expect(feed.items[99].title).toBe('T99');
  });

  it('falls back to title+date guid and tolerates unclosed tags', () => {
    const xml = `<rss><channel><title>T</title>
      <item><title>No link</title><pubDate>2024-02-01T00:00:00Z</pubDate><description><p>raw <br> html</description></item>
    </channel></rss>`;
    const feed = parseFeed(xml, 'https://t.example/');
    expect(feed.items[0].guid).toBe('No link|2024-02-01T00:00:00.000Z');
    expect(feed.items[0].url).toBeNull();
    expect(feed.items[0].content).toBe('raw\nhtml');
    expect(feed.siteUrl).toBeNull();
  });

  it('prefers media:content images inside media:group', () => {
    const xml = `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title>
      <item><title>a</title><link>https://m.example/a</link>
        <media:group><media:content url="https://m.example/v.mp4" type="video/mp4"/>
          <media:content url="https://m.example/i.jpg" medium="image"/></media:group>
      </item></channel></rss>`;
    expect(parseFeed(xml, 'https://m.example/feed').items[0].imageUrl).toBe('https://m.example/i.jpg');
  });
});

describe('dates', () => {
  const at = (d: string) => {
    const xml = `<rss><channel><title>T</title><item><title>x</title><link>https://d.example/</link><pubDate>${d}</pubDate></item></channel></rss>`;
    return parseFeed(xml, 'https://d.example/').items[0].publishedAt?.toISOString() ?? null;
  };

  it('parses RFC 822 variants', () => {
    expect(at('Mon, 01 Jan 2024 00:00:00 GMT')).toBe('2024-01-01T00:00:00.000Z');
    expect(at('Mon, 01 Jan 2024 00:00:00 EST')).toBe('2024-01-01T05:00:00.000Z');
    expect(at('1 Jan 2024 12:00 -0800')).toBe('2024-01-01T20:00:00.000Z');
    expect(at('Sunday, 15 September 2024 08:05:09 +05:30')).toBe('2024-09-15T02:35:09.000Z');
  });

  it('parses ISO 8601 variants', () => {
    expect(at('2024-06-01T12:34:56.789Z')).toBe('2024-06-01T12:34:56.789Z');
    expect(at('2024-06-01T12:34:56+0200')).toBe('2024-06-01T10:34:56.000Z');
    expect(at('2024-06-01 12:34:56')).toBe('2024-06-01T12:34:56.000Z');
    expect(at('2024-06-01')).toBe('2024-06-01T00:00:00.000Z');
  });

  it('returns null for garbage', () => {
    expect(at('yesterday-ish')).toBeNull();
    expect(at('')).toBeNull();
  });
});

describe('entities', () => {
  it('decodes numeric, hex and named entities', () => {
    expect(htmlToText('&#65;&#x42;&#X43; &nbsp;&mdash;&rsquo;&hellip;&ldquo;&rdquo;&eacute;&yuml;&copy;&euro;'))
      .toBe('ABC —’…“”éÿ©€');
  });

  it('keeps unknown entities and bare ampersands', () => {
    expect(htmlToText('AT&T &foo; a & b &amp c')).toBe('AT&T &foo; a & b & c');
  });

  it('does not re-parse decoded markup', () => {
    expect(htmlToText('<p>&lt;script&gt;x&lt;/script&gt;</p>')).toBe('<script>x</script>');
  });
});

describe('htmlToText', () => {
  it('separates block elements into paragraphs and normalizes whitespace', () => {
    expect(htmlToText('<div>  a\n  b </div><p>c</p><h3>d</h3>text <b>bold</b> tail')).toBe('a b\n\nc\n\nd\n\ntext bold tail');
  });

  it('renders lists with bullets and breaks with newlines', () => {
    expect(htmlToText('<p>Intro</p><ul>\n<li>One</li>\n<li>Two <i>it</i></li></ul>after<br/>line')).toBe(
      'Intro\n\n• One\n• Two it\n\nafter\nline',
    );
  });

  it('drops scripts, styles and comments', () => {
    expect(htmlToText('<style>.a{}</style><p>Hi<!-- secret --></p><script type="x">var a = "<p>";</script>')).toBe('Hi');
  });

  it('returns empty string for empty input', () => {
    expect(htmlToText('')).toBe('');
    expect(htmlToText('<p> </p><br>')).toBe('');
  });
});

describe('summary truncation', () => {
  it('cuts to 400 chars on a word boundary with an ellipsis', () => {
    const long = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const xml = `<rss><channel><title>T</title><item><title>x</title><link>https://s.example/</link><description>${long}</description></item></channel></rss>`;
    const it = parseFeed(xml, 'https://s.example/').items[0];
    expect(it.summary!.length).toBeLessThanOrEqual(400);
    expect(it.summary!.endsWith('…')).toBe(true);
    expect(it.summary!.slice(0, -1)).toMatch(/word\d+$/);
    expect(long.startsWith(it.summary!.slice(0, -1))).toBe(true);
  });
});

describe('discoverFeeds', () => {
  const html = `<!doctype html><html><head>
    <link rel="stylesheet" href="/s.css">
    <link rel="alternate" type="application/rss+xml" title="RSS" href="/feed.xml">
    <link type='application/atom+xml' rel='alternate' href='../atom.xml?x=1&amp;y=2'>
    <link rel="alternate" type="application/rss+xml" href="https://example.com/feed.xml">
    <link rel="alternate" type="application/feed+json" href="/feed.json">
    <link rel="alternate" hreflang="de" href="/de/">
    <!-- <link rel="alternate" type="application/rss+xml" href="/commented.xml"> -->
    <link rel="alternate" type="application/rss+xml; charset=utf-8" href="//cdn.example.com/c.rss" />
  </head><body></body></html>`;

  it('returns absolute, deduped RSS/Atom hrefs in page order', () => {
    expect(discoverFeeds(html, 'https://example.com/blog/post.html')).toEqual([
      'https://example.com/feed.xml',
      'https://example.com/atom.xml?x=1&y=2',
      'https://cdn.example.com/c.rss',
    ]);
  });

  it('honours <base href>', () => {
    const h = '<head><base href="https://other.example/sub/"><link rel="alternate" type="application/atom+xml" href="a.xml"></head>';
    expect(discoverFeeds(h, 'https://example.com/')).toEqual(['https://other.example/sub/a.xml']);
  });

  it('returns [] when there are none', () => {
    expect(discoverFeeds('<html><head></head></html>', 'https://example.com/')).toEqual([]);
  });
});

describe('looksLikeFeed', () => {
  it('detects feeds after BOM, prolog and comments', () => {
    expect(looksLikeFeed(RSS2)).toBe(true);
    expect(looksLikeFeed(ATOM)).toBe(true);
    expect(looksLikeFeed(RDF)).toBe(true);
    expect(looksLikeFeed('  <feed xmlns="http://www.w3.org/2005/Atom">')).toBe(true);
  });

  it('rejects HTML and other documents', () => {
    expect(looksLikeFeed('<!DOCTYPE html><html><head></head></html>')).toBe(false);
    expect(looksLikeFeed('<?xml version="1.0"?><svg></svg>')).toBe(false);
    expect(looksLikeFeed('{"version":"https://jsonfeed.org/version/1"}')).toBe(false);
    expect(looksLikeFeed('')).toBe(false);
    expect(looksLikeFeed('<rssfoo>')).toBe(false);
  });
});
