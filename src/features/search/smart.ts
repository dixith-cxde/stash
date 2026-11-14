import { SYNONYMS } from './synonyms';

/**
 * Smart local search, the pure half: query parsing and expansion (stems, prefixes, synonyms),
 * typo correction against the FTS vocabulary, and re-ranking of FTS candidates. No model and
 * no network; everything here is cheap string work over at most a few hundred rows.
 * The SQL half lives in the "Smart search" section of src/db/repo.ts.
 */

export type MatchKind = 'literal' | 'stem' | 'synonym';
export type Variant = { form: string; kind: MatchKind; prefix: boolean };
export type QueryTerm = {
  /** What the user typed (normalized). */
  raw: string;
  /** The word actually searched: raw, or its typo correction. */
  word: string;
  corrected: boolean;
  variants: Variant[];
};

/** literal > stem/prefix > synonym > typo correction. */
export const KIND_WEIGHT: Record<MatchKind, number> = { literal: 1, stem: 0.7, synonym: 0.45 };
/** Multiplies every match of a typo-corrected term (corrected literal 0.4 < synonym 0.45). */
export const TYPO_FACTOR = 0.4;
/** Where a term matched: tags and titles matter most, body text least. */
export const FIELD_WEIGHT = { title: 3, tag: 3, folder: 2.5, site: 2, body: 1 } as const;
export type Field = keyof typeof FIELD_WEIGHT;

const MAX_TERMS = 8;
const MAX_SYNONYMS = 6;
const STOPWORDS = new Set([
  'a', 'an', 'and', 'the', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 'from', 'or', 'is', 'it', 'my', 'about',
]);

/* --------------------------------- Parsing -------------------------------- */

/** Lowercase and strip diacritics, like the FTS tokenizer (unicode61 remove_diacritics 2). */
export function normalizeWord(s: string): string {
  return s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}

/** Splits text into normalized word tokens (letters and digits only). */
export function words(text: string): string[] {
  return normalizeWord(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Query tokens: stopwords dropped (unless that leaves nothing), duplicates removed, capped. */
export function tokenize(input: string): string[] {
  const all = [...new Set(words(input))];
  const kept = all.filter((w) => !STOPWORDS.has(w));
  return (kept.length ? kept : all).slice(0, MAX_TERMS);
}

/**
 * Light English stemmer: plurals, -ing, -ed and -ly. Deliberately conservative: the literal
 * word is always searched too, so a stem only has to widen recall, never replace the word.
 */
export function stem(word: string): string {
  const w = word;
  if (w.length <= 3 || /\d/.test(w)) return w;
  let s = w;
  let undouble = false;
  if (s.endsWith('ies') && s.length > 4) return `${s.slice(0, -3)}y`;
  if (s.endsWith('ing') && s.length >= 6) {
    s = s.slice(0, -3);
    undouble = true;
  } else if (s.endsWith('ly') && s.length >= 6 && !/(ply|ily)$/.test(s)) {
    s = s.slice(0, -2);
  } else if (s.endsWith('ed') && s.length >= 5 && !s.endsWith('eed')) {
    s = s.slice(0, -2);
    undouble = true;
  } else if (/(ss|sh|ch|x|z)es$/.test(s)) {
    s = s.slice(0, -2);
  } else if (s.endsWith('s') && !/(ss|us|is)$/.test(s)) {
    s = s.slice(0, -1);
  }
  // running → runn → run, stopped → stopp → stop (but not "fall", "kiss", "buzz").
  if (undouble && /([^aeiouslz])\1$/.test(s)) s = s.slice(0, -1);
  return s.length >= 3 ? s : w;
}

/** Every searched form of one word, best first: literal, stem forms, then synonyms. */
export function expandTerm(word: string, synonyms: ReadonlyMap<string, readonly string[]> = SYNONYMS): Variant[] {
  const out: Variant[] = [{ form: word, kind: 'literal', prefix: word.length >= 2 }];
  const seen = new Set([word]);
  const add = (form: string, kind: MatchKind, prefix: boolean) => {
    if (!form || seen.has(form)) return;
    seen.add(form);
    out.push({ form, kind, prefix });
  };

  const s = stem(word);
  add(s, 'stem', true);
  // study → studies (a prefix on "study" can't reach the -ies plural).
  if (/[^aeiou]y$/.test(s) && s.length > 3) add(`${s.slice(0, -1)}ies`, 'stem', false);

  const syn = [...(synonyms.get(word) ?? []), ...(synonyms.get(s) ?? [])];
  let n = 0;
  for (const form of syn) {
    if (n >= MAX_SYNONYMS) break;
    if (seen.has(form)) continue;
    add(form, 'synonym', form.length >= 4);
    n++;
  }
  return out;
}

export function makeTerm(raw: string, word = raw): QueryTerm {
  return { raw, word, corrected: word !== raw, variants: expandTerm(word) };
}

export function parseQuery(input: string): QueryTerm[] {
  return tokenize(input).map((w) => makeTerm(w));
}

/** Replaces terms that had no hits with their corrections (raw → corrected word). */
export function applyCorrections(terms: QueryTerm[], corrections: ReadonlyMap<string, string>): QueryTerm[] {
  return terms.map((t) => {
    const fixed = corrections.get(t.raw);
    return fixed && fixed !== t.raw ? makeTerm(t.raw, fixed) : t;
  });
}

/** The query as the user would read it after corrections ("Showing results for …"). */
export function correctedQuery(terms: QueryTerm[]): string | null {
  return terms.some((t) => t.corrected) ? terms.map((t) => t.word).join(' ') : null;
}

/** Forms that count as "the word itself is in the stash" (no synonyms) for typo checks. */
export function ownForms(term: QueryTerm): string[] {
  return term.variants.filter((v) => v.kind !== 'synonym').map((v) => v.form);
}

/* ----------------------------------- FTS ---------------------------------- */

const ftsVariant = (v: Variant) => `"${v.form}"${v.prefix ? '*' : ''}`;

/** One term as an FTS5 OR group. Forms are letters/digits only, so quoting is always safe. */
export function ftsGroup(term: QueryTerm): string {
  const parts = term.variants.map(ftsVariant);
  return parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`;
}

/** 'and' needs every term (in some form); 'or' any term, for the looser second pass. */
export function toSmartFts(terms: QueryTerm[], mode: 'and' | 'or'): string | null {
  if (!terms.length) return null;
  return terms.map(ftsGroup).join(mode === 'and' ? ' AND ' : ' OR ');
}

/* ------------------------------ Typo tolerance ---------------------------- */

/** ≤1 edit for short words, ≤2 from six letters; none under three letters or for numbers. */
export function maxTypoDistance(word: string): number {
  if (word.length < 3 || /^\d+$/.test(word)) return 0;
  return word.length >= 6 ? 2 : 1;
}

/**
 * Optimal string alignment distance (Levenshtein + adjacent transposition), giving up early:
 * returns max + 1 as soon as the distance must exceed max.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = b.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      cur.push(d);
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

export type VocabWord = { term: string; freq: number };

/** Nearest vocabulary word within the allowed distance; ties go to the more frequent word. */
export function pickCorrection(word: string, vocab: readonly VocabWord[]): string | null {
  const max = maxTypoDistance(word);
  if (!max) return null;
  let best: { term: string; d: number; freq: number } | null = null;
  for (const { term, freq } of vocab) {
    if (term === word || term.length < 2) continue;
    const d = editDistance(word, term, max);
    if (d > max) continue;
    if (!best || d < best.d || (d === best.d && (freq > best.freq || (freq === best.freq && term < best.term)))) {
      best = { term, d, freq };
    }
  }
  return best?.term ?? null;
}

/* --------------------------------- Ranking -------------------------------- */

/** One candidate row, flattened to plain strings for matching. */
export type SearchDoc = {
  id: string;
  /** Raw FTS bm25 (negative; lower is better), or null when found only through tags/folders. */
  bm25: number | null;
  /** True when the FTS AND pass found it: every term matched somewhere in its text. */
  allTerms?: boolean;
  title: string;
  /** Description, note and a slice of the content. */
  body: string;
  site: string | null;
  url: string | null;
  tags: string[];
  folder: string | null;
  favorite: boolean;
  unread: boolean;
  createdAt: number;
};

export type RankedDoc = { id: string; score: number; why: string | null };

type Hit = { score: number; field: Field; kind: MatchKind; form: string; label: string };

const DAY = 86_400_000;
const FIELD_ORDER: Field[] = ['title', 'tag', 'folder', 'site', 'body'];

export function hostOf(url: string | null): string | null {
  const m = url?.match(/^[a-z][\w+.-]*:\/\/(?:[^@/]*@)?([^/:?#]+)/i);
  return m ? m[1].toLowerCase().replace(/^www\./, '') : null;
}

function tokenMatch(tokens: readonly string[], v: Variant): MatchKind | null {
  let best: MatchKind | null = null;
  for (const t of tokens) {
    if (t === v.form) return v.kind;
    if (v.prefix && t.startsWith(v.form)) best = v.kind === 'literal' ? 'stem' : v.kind;
  }
  return best;
}

type Prepared = { field: Field; label: string; tokens: string[] }[];

function prepare(doc: SearchDoc): Prepared {
  const host = hostOf(doc.url);
  const out: Prepared = [{ field: 'title', label: doc.title, tokens: words(doc.title) }];
  for (const tag of doc.tags) out.push({ field: 'tag', label: tag, tokens: words(tag) });
  if (doc.folder) out.push({ field: 'folder', label: doc.folder, tokens: words(doc.folder) });
  if (doc.site || host) {
    out.push({ field: 'site', label: doc.site || host!, tokens: words(`${doc.site ?? ''} ${host ?? ''}`) });
  }
  out.push({ field: 'body', label: '', tokens: words(doc.body) });
  return out;
}

/** Best hit per field for one term; fields in FIELD_ORDER so ties keep the title first. */
function termHits(term: QueryTerm, fields: Prepared): Hit[] {
  const factor = term.corrected ? TYPO_FACTOR : 1;
  const byField = new Map<Field, Hit>();
  for (const f of fields) {
    for (const v of term.variants) {
      const kind = tokenMatch(f.tokens, v);
      if (!kind) continue;
      const score = KIND_WEIGHT[kind] * FIELD_WEIGHT[f.field] * factor;
      const prev = byField.get(f.field);
      if (!prev || score > prev.score) byField.set(f.field, { score, field: f.field, kind, form: v.form, label: f.label });
    }
  }
  return FIELD_ORDER.flatMap((f) => (byField.has(f) ? [byField.get(f)!] : []));
}

function whyOf(hit: Hit): string | null {
  switch (hit.field) {
    case 'tag':
      return `tag #${hit.label}`;
    case 'folder':
      return `in ${hit.label}`;
    case 'site':
      return hit.kind === 'synonym' ? `also: ${hit.form}` : `on ${hit.label}`;
    default:
      return hit.kind === 'synonym' ? `also: ${hit.form}` : null;
  }
}

/**
 * Re-ranks FTS candidates: normalized bm25 + per-term match quality (field × kind) + term
 * coverage + small favorite/unread/recency boosts. Rows found only through tags or folders
 * are dropped unless a term really matches them.
 */
export function rankDocs(terms: QueryTerm[], docs: readonly SearchDoc[], now = Date.now()): RankedDoc[] {
  if (!terms.length) return [];
  const bestBm25 = Math.min(0, ...docs.map((d) => d.bm25 ?? 0));
  const out: RankedDoc[] = [];

  for (const doc of docs) {
    const fields = prepare(doc);
    let sum = 0;
    let matched = 0;
    const hints: { hit: Hit; rank: number }[] = [];
    for (const term of terms) {
      const hits = termHits(term, fields);
      if (!hits.length) continue;
      matched++;
      const top = hits.reduce((a, b) => (b.score > a.score ? b : a));
      // The best field counts fully; extra fields (e.g. title and tag) add a smaller boost.
      sum += top.score + 0.25 * hits.reduce((n, h) => n + (h === top ? 0 : h.score), 0);
      hints.push({ hit: top, rank: FIELD_ORDER.indexOf(top.field) });
    }
    if (!matched && doc.bm25 === null) continue;

    const coverage = doc.allTerms ? 1 : matched / terms.length;
    // Rows found only through a tag or folder name get a middling base (no bm25 to go on).
    const base = doc.bm25 === null ? 0.75 : bestBm25 < 0 ? 1.5 * (doc.bm25 / bestBm25) : 0;
    const ageDays = Math.max(0, (now - doc.createdAt) / DAY);
    const score =
      base +
      sum / terms.length +
      2 * coverage * coverage +
      (doc.favorite ? 0.25 : 0) +
      (doc.unread ? 0.15 : 0) +
      0.3 * Math.exp(-ageDays / 45);

    // Explain the most telling reason: a tag or folder beats a synonym beats a site.
    const why =
      hints
        .map((h) => whyOf(h.hit))
        .filter((w): w is string => !!w)
        .sort((a, b) => hintRank(a) - hintRank(b))[0] ?? null;
    out.push({ id: doc.id, score, why });
  }

  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function hintRank(why: string): number {
  if (why.startsWith('tag')) return 0;
  if (why.startsWith('in ')) return 1;
  if (why.startsWith('also')) return 2;
  return 3;
}
