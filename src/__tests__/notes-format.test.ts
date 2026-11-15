import { applyFormat } from '@/features/notes/format';

describe('applyFormat', () => {
  it('puts the caret between empty bold markers', () => {
    expect(applyFormat('abc', { start: 3, end: 3 }, { wrap: ['**', '**'] })).toEqual({ text: 'abc****', selection: { start: 5, end: 5 } });
  });
  it('wraps a selection and keeps it selected', () => {
    expect(applyFormat('say hi now', { start: 4, end: 6 }, { wrap: ['_', '_'] })).toEqual({ text: 'say _hi_ now', selection: { start: 5, end: 7 } });
  });
  it('prefixes the current line and shifts the caret', () => {
    expect(applyFormat('one\ntwo', { start: 6, end: 6 }, { line: '## ' })).toEqual({ text: 'one\n## two', selection: { start: 9, end: 9 } });
    expect(applyFormat('\nx', { start: 0, end: 0 }, { line: '- ' })).toEqual({ text: '- \nx', selection: { start: 2, end: 2 } });
  });
});
