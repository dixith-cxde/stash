import { mdBlocks, plainText, splitEndMatter } from '@/features/reader/endmatter';

const P = 'The article body has a paragraph of reasonably long text so it reads like prose.';
const body = (n: number) => Array.from({ length: n }, (_, i) => `${P} (${i + 1})`).join('\n\n');

describe('mdBlocks / plainText', () => {
  it('keeps fenced code blocks whole', () => {
    expect(mdBlocks('a\n\n```js\nx\n\ny\n```\n\nb')).toEqual(['a', '```js\nx\n\ny\n```', 'b']);
  });
  it('strips Markdown to text', () => {
    expect(plainText('**Hi** [there](https://x.com) ![img](https://x.com/a.png) `code`')).toBe('Hi there code');
  });
});

describe('splitEndMatter', () => {
  it('lifts a Continue reading list into related cards', () => {
    const md = `${body(5)}\n\n## Continue reading\n\n- [First story title](https://ex.com/one)\n- [![](https://ex.com/2.jpg)](https://ex.com/two) [Second story](https://ex.com/two)\n- [Third](https://other.org/three) – a short blurb about it`;
    const r = splitEndMatter(md);
    expect(r.body).toBe(body(5));
    expect(r.related?.title).toBe('Continue reading');
    expect(r.related?.links).toEqual([
      { title: 'First story title', url: 'https://ex.com/one', image: null, host: 'ex.com', blurb: null },
      { title: 'Second story', url: 'https://ex.com/two', image: 'https://ex.com/2.jpg', host: 'ex.com', blurb: null },
      { title: 'Third', url: 'https://other.org/three', image: null, host: 'other.org', blurb: 'a short blurb about it' },
    ]);
  });

  it('handles bold-paragraph headings, image paragraphs and date lines', () => {
    const md = `${body(4)}\n\n**Related articles:**\n\n![](https://ex.com/a.jpg)\n\n[Alpha article](https://ex.com/a)\n\nNov 3, 2026\n\n[Beta article](https://ex.com/b)`;
    const r = splitEndMatter(md);
    expect(r.body).toBe(body(4));
    expect(r.related?.links.map((l) => [l.title, l.image, l.blurb])).toEqual([
      ['Alpha article', 'https://ex.com/a.jpg', 'Nov 3, 2026'],
      ['Beta article', null, null],
    ]);
  });

  it('leaves prose with links alone', () => {
    const md = `${body(2)}\n\n## Related work\n\nThis is a long paragraph that mentions [one paper](https://ex.com/p) in passing and keeps going with real prose that is clearly part of the article and not a list.\n\n${body(2)}`;
    expect(splitEndMatter(md).related).toBeNull();
    expect(splitEndMatter(md).body).toBe(md);
  });

  it('reads author and tag lines at the end', () => {
    const md = `${body(4)}\n\n---\n\n*Written by [Jane Doe](https://ex.com/jane) on March 3, 2026*\n\n**Tags:** [Android](https://ex.com/tag/android), [Design](https://ex.com/tag/design)`;
    const r = splitEndMatter(md);
    expect(r.body).toBe(body(4));
    expect(r.author).toEqual({ name: 'Jane Doe', url: 'https://ex.com/jane', bio: null });
    expect(r.tags).toEqual([
      { label: 'Android', url: 'https://ex.com/tag/android' },
      { label: 'Design', url: 'https://ex.com/tag/design' },
    ]);
  });

  it('reads plain tag lists, tag-link rows and About the author sections', () => {
    const a = splitEndMatter(`${body(3)}\n\nFiled under: Phones, #Reviews · Google`);
    expect(a.tags.map((t) => t.label)).toEqual(['Phones', 'Reviews', 'Google']);
    const b = splitEndMatter(`${body(3)}\n\n[AI](https://ex.com/topic/ai) [Policy](https://ex.com/topic/policy)`);
    expect(b.tags.map((t) => t.label)).toEqual(['AI', 'Policy']);
    const c = splitEndMatter(`${body(3)}\n\n## About the author\n\n**Sam Lee** writes about mobile design and has done so for ten years at several magazines.`);
    expect(c.author?.name).toBe('Sam Lee');
    expect(c.author?.bio).toContain('writes about mobile design');
    expect(c.body).toBe(body(3));
  });

  it('does not mistake prose for an author line', () => {
    const md = `${body(3)}\n\nBy the way, this is still the article.`;
    expect(splitEndMatter(md).author).toBeNull();
    expect(splitEndMatter(`${body(3)}\n\nBy Alex Kim`).author?.name).toBe('Alex Kim');
  });

  it('stops a related list at the author and tags lines', () => {
    const md = `${body(3)}\n\n## Continue reading\n\n- [One story](https://ex.com/1)\n- [Two story](https://ex.com/2)\n\n*Written by [Jane Doe](https://ex.com/jane)*\n\n**Tags:** [Android](https://ex.com/tag/android), [Phones](https://ex.com/tag/phones)`;
    const r = splitEndMatter(md);
    expect(r.related?.links).toHaveLength(2);
    expect(r.author?.name).toBe('Jane Doe');
    expect(r.tags.map((t) => t.label)).toEqual(['Android', 'Phones']);
    expect(r.body).toBe(body(3));
  });
});
