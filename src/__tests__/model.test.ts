import {
  formatDuration,
  masonry,
  matchesFilter,
  readingMinutes,
  taskStats,
  tasksIn,
  toggleTask,
  wikiLinks,
  wordCount,
} from '@/features/stash/model';

const NOTE = `# Plan
- [x] One
- [ ] Two
* [X] Three
- not a task
Demo [[Saved Article]] and [[Other]]`;

describe('note helpers', () => {
  it('finds tasks with their source lines', () => {
    expect(tasksIn(NOTE)).toEqual([
      { line: 1, done: true, text: 'One' },
      { line: 2, done: false, text: 'Two' },
      { line: 3, done: true, text: 'Three' },
    ]);
    expect(taskStats(NOTE)).toEqual({ total: 3, done: 2 });
  });

  it('toggles exactly one checkbox and leaves the rest untouched', () => {
    const next = toggleTask(NOTE, 2);
    expect(next.split('\n')[2]).toBe('- [x] Two');
    expect(toggleTask(next, 2)).toBe(NOTE);
    expect(next.split('\n').filter((_, i) => i !== 2)).toEqual(NOTE.split('\n').filter((_, i) => i !== 2));
  });

  it('extracts wiki links and counts words without markup', () => {
    expect(wikiLinks(NOTE)).toEqual(['Saved Article', 'Other']);
    expect(wordCount('**Hello** _world_ `code`')).toBe(3);
  });
});

describe('formatting', () => {
  it('formats durations and reading time', () => {
    expect(formatDuration(1122)).toBe('18:42');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(null)).toBeNull();
    expect(readingMinutes(1600)).toBe(7);
  });
});

describe('feed', () => {
  it('balances masonry columns by height', () => {
    const [a, b] = masonry([300, 100, 100, 100], (h) => h);
    expect(a).toEqual([300]);
    expect(b).toEqual([100, 100, 100]);
  });

  it('filters highlights only into Quotes', () => {
    const h = { kind: 'highlight', key: 'h', at: 0, highlight: {} } as never;
    expect(matchesFilter(h, 'quotes')).toBe(true);
    expect(matchesFilter(h, 'links')).toBe(false);
    expect(matchesFilter(h, 'all')).toBe(true);
  });
});
