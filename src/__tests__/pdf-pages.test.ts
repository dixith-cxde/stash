import { pagesAround } from '@/features/pdf/pages';

describe('pagesAround', () => {
  it('orders the current page, then next before previous', () => {
    expect(pagesAround(5, 20)).toEqual([5, 6, 4, 7]);
  });
  it('stays inside the document at the start and end', () => {
    expect(pagesAround(0, 20)).toEqual([0, 1, 2]);
    expect(pagesAround(19, 20)).toEqual([19, 18]);
  });
  it('handles a one-page PDF', () => {
    expect(pagesAround(0, 1)).toEqual([0]);
  });
});
