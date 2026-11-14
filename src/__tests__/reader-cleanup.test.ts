import { cleanArticle, cleanArticleWithByline, looksLikeHtml } from '@/features/reader/cleanup';
import { splitEndMatter } from '@/features/reader/endmatter';

const PARA = 'Following the departure of the CEO, a new report has emerged alleging that the company inflated the shortage by investing in startups that would buy its GPUs and build data centers.';

describe('cleanArticle', () => {
  it('drops a byline and dateline the meta card shows', () => {
    const md = [
      'Saturday, November 14th 2026',
      'by',
      '[Cpt.Jank](https://example.com/forums/members/cpt-jank.1/)',
      'Today, 04:01 [Discuss (37 Comments)](https://example.com/a#comments)',
      PARA,
    ].join('\n\n');
    expect(cleanArticle(md, ['Cpt.Jank'])).toBe(PARA);
  });

  it('drops story-by / published / share sections and promo images at the top', () => {
    const md = [
      'A subtitle for the story',
      '## Story by:',
      '- [Mario Aguilera](https://x.edu/author/m) - m@x.edu',
      '![Help us turn curiosity into progress: Support Research](https://x.edu/img/bug.jpg)',
      '## Published Date',
      'November 12, 2026',
      '## Share This:',
      '## Article Content',
      '### Key Takeaways',
      '- One',
      PARA,
      '## Share This:',
      '## You May Also Like',
      '### [First story](https://x.edu/story/1)',
      '[Science](https://x.edu/research/science)',
      '### Second story',
      '[Business](https://x.edu/research/business)',
    ].join('\n\n');
    const out = cleanArticle(md, ['Mario Aguilera']);
    expect(out).not.toMatch(/Story by|Published Date|Share This|Support Research|Article Content|November 12/);
    expect(out).toMatch(/^A subtitle for the story\n\n### Key Takeaways/);
    expect(cleanArticleWithByline(md).byline).toBe('Mario Aguilera');
    const end = splitEndMatter(out);
    expect(end.related?.title).toBe('You May Also Like');
    expect(end.related?.links).toEqual([
      expect.objectContaining({ title: 'First story', url: 'https://x.edu/story/1', blurb: 'Science' }),
      expect.objectContaining({ title: 'Second story', url: null, blurb: 'Business' }),
    ]);
    expect(end.body).not.toMatch(/You May Also Like/);
  });

  it('keeps the article when nothing is chrome', () => {
    const md = `## Intro\n\n${PARA}\n\n## Details\n\n${PARA}`;
    expect(cleanArticle(md, [])).toBe(md);
  });
});

describe('author echoes', () => {
  it('drops the repeated name heading under "Written by" and keeps the bio', () => {
    const md = `${PARA}\n\nWritten by [Jane Doe](https://x.com/jane)\n\n## Jane Doe\n\nJane Doe covers chips and data centers.`;
    const end = splitEndMatter(md);
    expect(end.author).toEqual({ name: 'Jane Doe', url: 'https://x.com/jane', bio: 'Jane Doe covers chips and data centers.' });
    expect(end.body).toBe(PARA);
  });
});

describe('looksLikeHtml', () => {
  it('tells HTML from Markdown', () => {
    expect(looksLikeHtml('<p>One</p><p>Two <a href="x">link</a></p><div>Three</div>')).toBe(true);
    expect(looksLikeHtml(`# Title\n\n${PARA}`)).toBe(false);
  });
});

describe('bylines', () => {
  it('drops a "By Name · 3 hours ago" line and keeps the name', () => {
    const md = `By Jane Doe · 3 hours ago\n\n${PARA}`;
    expect(cleanArticleWithByline(md)).toEqual({ body: PARA, byline: 'Jane Doe' });
  });
  it('keeps a sentence that starts with "By"', () => {
    const md = `By the end of the year, prices had doubled.\n\n${PARA}`;
    expect(cleanArticle(md)).toBe(md);
  });
});
