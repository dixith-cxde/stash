import {
  applyCorrections,
  correctedQuery,
  editDistance,
  expandTerm,
  hostOf,
  makeTerm,
  parseQuery,
  pickCorrection,
  rankDocs,
  type SearchDoc,
  stem,
  tokenize,
  toSmartFts,
} from '@/features/search/smart';
import { SYNONYM_GROUPS, SYNONYMS } from '@/features/search/synonyms';

const NOW = 1_800_000_000_000;
const doc = (over: Partial<SearchDoc> & { id: string }): SearchDoc => ({
  bm25: null,
  title: '',
  body: '',
  site: null,
  url: null,
  tags: [],
  folder: null,
  favorite: false,
  unread: false,
  createdAt: NOW - 365 * 86_400_000,
  ...over,
});
const ids = (terms: string, docs: SearchDoc[]) => rankDocs(parseQuery(terms), docs, NOW).map((r) => r.id);

describe('tokenize', () => {
  it('lowercases, strips diacritics and drops stopwords', () => {
    expect(tokenize('The Café of Paris')).toEqual(['cafe', 'paris']);
  });
  it('keeps stopwords when they are the whole query', () => {
    expect(tokenize('the of')).toEqual(['the', 'of']);
  });
  it('drops FTS syntax and duplicates', () => {
    expect(tokenize('c++ "react" react OR foo:bar')).toEqual(['c', 'react', 'foo', 'bar']);
  });
});

describe('stem', () => {
  it.each([
    ['recipes', 'recipe'],
    ['links', 'link'],
    ['boxes', 'box'],
    ['dishes', 'dish'],
    ['studies', 'study'],
    ['cooking', 'cook'],
    ['running', 'run'],
    ['stopped', 'stop'],
    ['cooked', 'cook'],
    ['quickly', 'quick'],
    ['really', 'real'],
  ])('%s → %s', (word, out) => expect(stem(word)).toBe(out));

  it.each(['class', 'status', 'basis', 'speed', 'used', 'bus', 'apply', 'family', 'css', 'mp3s'])(
    'leaves %s alone',
    (word) => expect(stem(word)).toBe(word),
  );
});

describe('expandTerm', () => {
  it('orders literal, stem, then synonyms', () => {
    const v = expandTerm('videos');
    expect(v[0]).toEqual({ form: 'videos', kind: 'literal', prefix: true });
    expect(v[1]).toEqual({ form: 'video', kind: 'stem', prefix: true });
    expect(v.filter((x) => x.kind === 'synonym').map((x) => x.form)).toEqual(
      expect.arrayContaining(['youtube', 'clip']),
    );
  });
  it('finds synonyms through the stem', () => {
    expect(expandTerm('recipes').some((v) => v.kind === 'synonym' && v.form === 'cooking')).toBe(true);
  });
  it('adds the -ies plural for -y stems', () => {
    expect(expandTerm('study')).toContainEqual({ form: 'studies', kind: 'stem', prefix: false });
  });
  it('caps synonyms and never repeats a form', () => {
    const v = expandTerm('code');
    expect(v.filter((x) => x.kind === 'synonym').length).toBeLessThanOrEqual(6);
    expect(new Set(v.map((x) => x.form)).size).toBe(v.length);
  });
  it('does not prefix-match one-letter words', () => {
    expect(expandTerm('c')[0].prefix).toBe(false);
  });
});

describe('synonyms', () => {
  it('has a usable curated table', () => {
    expect(SYNONYM_GROUPS.length).toBeGreaterThanOrEqual(60);
    expect(SYNONYM_GROUPS.length).toBeLessThanOrEqual(130);
    for (const g of SYNONYM_GROUPS) for (const w of g) expect(w).toMatch(/^[a-z0-9]+$/);
  });
  it('is symmetric', () => {
    expect(SYNONYMS.get('pdf')).toContain('paper');
    expect(SYNONYMS.get('paper')).toContain('pdf');
  });
});

describe('toSmartFts', () => {
  it('builds quoted OR groups, joined by AND or OR', () => {
    const terms = [makeTerm('ux'), makeTerm('c')];
    const ux = '("ux"* OR "design"* OR "ui" OR "interface"* OR "layout"*)';
    expect(toSmartFts(terms, 'and')).toBe(`${ux} AND "c"`);
    expect(toSmartFts(terms, 'or')).toBe(`${ux} OR "c"`);
    expect(toSmartFts([], 'and')).toBeNull();
  });
});

describe('editDistance', () => {
  it('counts edits, with adjacent swaps as one', () => {
    expect(editDistance('recipe', 'recipe')).toBe(0);
    expect(editDistance('recpie', 'recipe')).toBe(1);
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('desgin', 'design')).toBe(1);
  });
  it('gives up past the limit', () => {
    expect(editDistance('kitten', 'sitting', 1)).toBe(2);
    expect(editDistance('a', 'abcdef', 2)).toBe(3);
  });
});

describe('pickCorrection', () => {
  const vocab = [
    { term: 'design', freq: 40 },
    { term: 'resign', freq: 2 },
    { term: 'react', freq: 30 },
    { term: 'reach', freq: 90 },
    { term: 'recipe', freq: 12 },
    { term: 'recipes', freq: 3 },
  ];
  it('picks the nearest word', () => {
    expect(pickCorrection('desgin', vocab)).toBe('design');
    expect(pickCorrection('recipies', vocab)).toBe('recipes');
  });
  it('breaks distance ties by frequency', () => {
    // "reacz" is one edit from both react and reach; reach is used more.
    expect(pickCorrection('reacz', vocab)).toBe('reach');
  });
  it('allows one edit for short words and two from six letters', () => {
    expect(pickCorrection('rxacz', vocab)).toBeNull();
    expect(pickCorrection('recxpx', vocab)).toBe('recipe');
  });
  it('never corrects very short words or numbers', () => {
    expect(pickCorrection('re', vocab)).toBeNull();
    expect(pickCorrection('2024', [{ term: '2025', freq: 9 }])).toBeNull();
  });
});

describe('corrections', () => {
  it('replaces the term and reports the corrected query', () => {
    const terms = applyCorrections(parseQuery('desgin tokens'), new Map([['desgin', 'design']]));
    expect(terms[0]).toMatchObject({ raw: 'desgin', word: 'design', corrected: true });
    expect(terms[0].variants.some((v) => v.form === 'ui')).toBe(true);
    expect(correctedQuery(terms)).toBe('design tokens');
    expect(correctedQuery(parseQuery('design'))).toBeNull();
  });
});

describe('hostOf', () => {
  it('reads the host without www', () => {
    expect(hostOf('https://www.youtube.com/watch?v=1')).toBe('youtube.com');
    expect(hostOf(null)).toBeNull();
  });
});

describe('rankDocs', () => {
  it('ranks literal > stem/prefix > synonym', () => {
    const docs = [
      doc({ id: 'syn', title: 'Weeknight cooking ideas', bm25: -5 }),
      doc({ id: 'stem', title: 'Recipes for spring', bm25: -5 }),
      doc({ id: 'lit', title: 'A recipe for bread', bm25: -5 }),
    ];
    expect(ids('recipe', docs)).toEqual(['lit', 'stem', 'syn']);
  });

  it('ranks a typo-corrected match below a synonym match', () => {
    const terms = applyCorrections(parseQuery('desgin'), new Map([['desgin', 'design']]));
    const typo = rankDocs(terms, [doc({ id: 'a', title: 'design', bm25: -5 })], NOW)[0].score;
    const syn = rankDocs(parseQuery('ux'), [doc({ id: 'b', title: 'design', bm25: -5 })], NOW)[0].score;
    expect(syn).toBeGreaterThan(typo);
  });

  it('boosts title and tag matches over body matches', () => {
    const docs = [
      doc({ id: 'body', title: 'Notes', body: 'something about typography here', bm25: -6 }),
      doc({ id: 'tag', title: 'Fonts I like', tags: ['typography'], bm25: null }),
    ];
    expect(ids('typography', docs)).toEqual(['tag', 'body']);
  });

  it('boosts collection and site matches, and explains them', () => {
    const docs = [
      doc({ id: 'plain', title: 'Read later', body: 'research methods', bm25: -4 }),
      doc({ id: 'folder', title: 'Survey methods', folder: 'Research', bm25: null }),
    ];
    const ranked = rankDocs(parseQuery('research'), docs, NOW);
    expect(ranked.map((r) => r.id)).toEqual(['folder', 'plain']);
    expect(ranked[0].why).toBe('in Research');

    const site = rankDocs(parseQuery('youtube'), [doc({ id: 's', title: 'Talk', url: 'https://www.youtube.com/x', bm25: -2 })], NOW);
    expect(site[0].why).toBe('on youtube.com');
  });

  it('explains tag and synonym matches', () => {
    expect(rankDocs(parseQuery('typography'), [doc({ id: 't', title: 'Fonts', tags: ['typography'] })], NOW)[0].why).toBe(
      'tag #typography',
    );
    expect(rankDocs(parseQuery('pdf'), [doc({ id: 'p', title: 'A paper on sleep', bm25: -3 })], NOW)[0].why).toBe('also: paper');
    expect(rankDocs(parseQuery('sleep'), [doc({ id: 'p', title: 'A paper on sleep', bm25: -3 })], NOW)[0].why).toBeNull();
  });

  it('prefers rows that match every term', () => {
    const docs = [
      doc({ id: 'one', title: 'Bread bread bread', bm25: -9 }),
      doc({ id: 'both', title: 'Sourdough bread', bm25: -3, allTerms: true }),
    ];
    expect(ids('sourdough bread', docs)).toEqual(['both', 'one']);
  });

  it('nudges favorites, unread and recent items on ties', () => {
    const docs = [
      doc({ id: 'old', title: 'Bread' }),
      doc({ id: 'fav', title: 'Bread', favorite: true }),
      doc({ id: 'new', title: 'Bread', createdAt: NOW - 86_400_000 }),
    ];
    expect(ids('bread', docs.map((d) => ({ ...d, bm25: -1 })))).toEqual(['new', 'fav', 'old']);
  });

  it('drops tag/folder-only candidates that do not really match', () => {
    expect(ids('design', [doc({ id: 'x', title: 'Other', tags: ['resign'] })])).toEqual([]);
  });

  it('keeps FTS hits whose match is beyond the content slice', () => {
    expect(ids('zebra', [doc({ id: 'deep', title: 'Long read', bm25: -1 })])).toEqual(['deep']);
  });
});
