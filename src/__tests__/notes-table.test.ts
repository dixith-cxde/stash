import { fitColumns, tableColumnWidths } from '@/features/notes/table';

describe('tableColumnWidths', () => {
  it('sizes columns by content within bounds', () => {
    const w = tableColumnWidths([
      ['Id', 'Description'],
      ['1', 'A fairly long description that should hit the maximum width cap for a column'],
    ]);
    expect(w[0]).toBe(64);
    expect(w[1]).toBe(240);
  });
  it('never makes a column narrower than its longest word', () => {
    const [w] = tableColumnWidths([['supercalifragilisticexpialidocious']], { max: 100 });
    expect(w).toBeGreaterThanOrEqual(100);
  });
  it('handles ragged rows and empty input', () => {
    expect(tableColumnWidths([['a'], ['b', 'c']])).toHaveLength(2);
    expect(tableColumnWidths([])).toEqual([]);
  });
});

describe('fitColumns', () => {
  it('stretches narrow tables to the available width', () => {
    expect(fitColumns([100, 100], 300)).toEqual([150, 150]);
  });
  it('leaves wide tables for sideways scrolling', () => {
    expect(fitColumns([300, 300], 360)).toEqual([300, 300]);
  });
});
