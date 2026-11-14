import {
  cleanTeaser,
  dropTitleHeading,
  formatCommentTime,
  formatPublished,
  markdownTextLength,
  readMinutes,
} from '@/features/feeds/format';

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

describe('reader dates and lengths', () => {
  it('formats the published date in local time', () => {
    expect(formatPublished(new Date(2026, 10, 12, 14, 30))).toBe('12 Nov 2026, 14:30');
    expect(formatPublished(new Date(2026, 0, 5, 9, 7))).toBe('5 Jan 2026, 09:07');
    expect(formatPublished(new Date(NaN))).toBe('');
  });
  it('formats comment times, keeping the page text when it is not a date', () => {
    const now = new Date(2026, 10, 14, 12, 0);
    expect(formatCommentTime(new Date(2026, 10, 14, 4, 1).toISOString(), now)).toBe('14 Nov, 04:01');
    expect(formatCommentTime(new Date(2025, 2, 1, 18, 45).toISOString(), now)).toBe('1 Mar 2025, 18:45');
    expect(formatCommentTime('Today, 04:01', now)).toBe('Today, 04:01');
    expect(formatCommentTime(null, now)).toBeNull();
  });
  it('counts readable characters only', () => {
    expect(markdownTextLength('## Hi\n\n[link text](https://very.long.example.com/path) ![img](https://x.y/z.jpg)')).toBe('Hi link text'.length);
  });
});
