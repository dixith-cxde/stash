import { cleanTeaser, dropTitleHeading, readMinutes } from '@/features/feeds/format';

describe('cleanTeaser', () => {
  it('drops Hacker News boilerplate run together on one line', () => {
    const hn = 'Article URL: https://example.com/a Comments URL: https://news.ycombinator.com/item?id=1 Points: 117 # Comments: 21';
    expect(cleanTeaser(hn)).toBeNull();
  });
  it('drops boilerplate lines but keeps real text', () => {
    expect(cleanTeaser('A real summary of the article that matters.\n\nPoints: 3')).toBe('A real summary of the article that matters.');
  });
  it('keeps ordinary prose with colons', () => {
    expect(cleanTeaser('Note: this sentence keeps its colon and its words.')).toBe('Note: this sentence keeps its colon and its words.');
  });
});

it('drops a heading that repeats the title, even as a link', () => {
  const md = '## [NVIDIA Allegedly Engineered Scarcity](https://x.y/1)\n\nBody text.';
  expect(dropTitleHeading(md, 'NVIDIA allegedly engineered scarcity')).toBe('\nBody text.');
});

it('estimates read time only for real articles', () => {
  expect(readMinutes(300)).toBeNull();
  expect(readMinutes(7000)).toBe(5);
});
