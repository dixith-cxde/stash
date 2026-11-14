/**
 * Reader-mode extractor (Readability-lite). Pure TypeScript, no DOM: a small lenient HTML
 * tokenizer builds a tree, junk is pruned, an article root is chosen (semantic tags first, then
 * Readability-style scoring) and rendered to Markdown.
 */
import { decodeEntities, resolveUrl } from './parse';

export type Extracted = {
  /** Readable article body as Markdown: paragraphs, ## / ### headings, - and 1. lists, > quotes, **bold**, *italic*, [links](abs-url), fenced ``` code for <pre>, images as ![alt](abs-url) on their own line. */
  markdown: string;
  /** Plain-text length of the body (for read time). */
  chars: number;
  title: string | null; // og:title / <title> / first h1
  byline: string | null; // meta author / [rel=author] / .byline text
  imageUrl: string | null; // og:image / twitter:image, absolute
  siteName: string | null; // og:site_name
};

const MIN_CHARS = 150;
const MAX_MARKDOWN = 60_000;

// ---------------------------------------------------------------------------------------------
// Tree

type El = { tag: string; attrs: Record<string, string>; children: Node[]; parent: El | null };
type Node = El | string;

const isEl = (n: Node): n is El => typeof n !== 'string';

const words = (s: string) => new Set(s.split(' '));
const VOID = words('area base br col embed hr img input link meta param source track wbr keygen');
const RAW = words('script style textarea title xmp noscript iframe noembed noframes');
const RCDATA = words('textarea title');
const CLOSES_P = words(
  'address article aside blockquote details dialog div dl fieldset figcaption figure footer form ' +
    'h1 h2 h3 h4 h5 h6 header hgroup hr main menu nav ol p pre section table ul li dd dt',
);
const INLINE = words(
  'a abbr b bdi bdo big cite code data dfn em font i kbd label mark q s samp small span strike ' +
    'strong sub sup time tt u var del ins br img wbr picture',
);
const HEADINGS = words('h1 h2 h3 h4 h5 h6');
const MAX_DEPTH = 256;

const ATTR_RE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(s))) {
    const key = m[1].toLowerCase();
    if (!(key in out)) out[key] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

const rawEndRes: Record<string, RegExp> = {};

function parseHtml(src: string): El {
  const n = src.length;
  const doc: El = { tag: '#doc', attrs: {}, children: [], parent: null };
  const stack: El[] = [doc];
  const top = () => stack[stack.length - 1];
  const pushText = (s: string) => {
    if (s) top().children.push(s);
  };
  /** Close the nearest open element in `names`, searching down until a `stop` element. */
  const closeNearest = (names: Set<string>, stop: (t: string) => boolean) => {
    for (let k = stack.length - 1; k >= 1; k--) {
      const t = stack[k].tag;
      if (names.has(t)) {
        stack.length = k;
        return;
      }
      if (stop(t)) return;
    }
  };

  let i = 0;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      pushText(decodeEntities(src.slice(i)));
      break;
    }
    if (lt > i) pushText(decodeEntities(src.slice(i, lt)));
    const c1 = src.charCodeAt(lt + 1);

    if (c1 === 33 /* ! */ || c1 === 63 /* ? */) {
      if (src.startsWith('<!--', lt)) {
        const e = src.indexOf('-->', lt + 4);
        i = e === -1 ? n : e + 3;
      } else if (src.startsWith('<![CDATA[', lt)) {
        const e = src.indexOf(']]>', lt + 9);
        pushText(src.slice(lt + 9, e === -1 ? n : e));
        i = e === -1 ? n : e + 3;
      } else {
        const e = src.indexOf('>', lt);
        i = e === -1 ? n : e + 1;
      }
      continue;
    }
    if (c1 === 47 /* / */) {
      const gt = src.indexOf('>', lt + 2);
      const name = /^[^\s/>]*/.exec(src.slice(lt + 2, gt === -1 ? n : gt))![0].toLowerCase();
      for (let k = stack.length - 1; k >= 1; k--) {
        if (stack[k].tag === name) {
          stack.length = k;
          break;
        }
      }
      i = gt === -1 ? n : gt + 1;
      continue;
    }
    const isNameStart = (c1 >= 65 && c1 <= 90) || (c1 >= 97 && c1 <= 122);
    if (!isNameStart) {
      pushText('<');
      i = lt + 1;
      continue;
    }
    // Find the closing '>' outside quotes.
    let j = lt + 1;
    let q = 0;
    for (; j < n; j++) {
      const c = src.charCodeAt(j);
      if (q) {
        if (c === q) q = 0;
      } else if (c === 34 || c === 39) q = c;
      else if (c === 62) break;
    }
    let body = src.slice(lt + 1, j);
    const selfClosing = body.endsWith('/');
    if (selfClosing) body = body.slice(0, -1);
    let k = 0;
    while (k < body.length && !/[\s/]/.test(body[k])) k++;
    const tag = body.slice(0, k).toLowerCase();
    i = j + 1;

    // Implied end tags (a pragmatic subset of the HTML tree-construction rules).
    if (CLOSES_P.has(tag)) closeNearest(words('p'), (t) => !INLINE.has(t));
    if (tag === 'li') closeNearest(words('li'), (t) => /^(ul|ol|menu|table|td|th|body|blockquote)$/.test(t));
    if (tag === 'dt' || tag === 'dd') closeNearest(words('dt dd'), (t) => t === 'dl' || t === 'table');
    if (tag === 'tr') closeNearest(words('tr'), (t) => /^(table|tbody|thead|tfoot)$/.test(t));
    if (tag === 'td' || tag === 'th') closeNearest(words('td th'), (t) => t === 'tr' || t === 'table');
    if (tag === 'tbody' || tag === 'thead' || tag === 'tfoot')
      closeNearest(words('tbody thead tfoot'), (t) => t === 'table');
    if (HEADINGS.has(tag) && HEADINGS.has(top().tag)) stack.length -= 1;
    if (tag === 'option' && top().tag === 'option') stack.length -= 1;

    const el: El = { tag, attrs: k < body.length ? parseAttrs(body.slice(k)) : {}, children: [], parent: top() };
    top().children.push(el);

    if (RAW.has(tag) && !selfClosing) {
      const re = (rawEndRes[tag] ??= new RegExp(`</${tag}[\\s/>]`, 'gi'));
      re.lastIndex = i;
      const m = re.exec(src);
      const end = m ? m.index : n;
      const text = src.slice(i, end);
      if (text) el.children.push(RCDATA.has(tag) ? decodeEntities(text) : text);
      const gt = m ? src.indexOf('>', end) : -1;
      i = gt === -1 ? n : gt + 1;
      continue;
    }
    if (!selfClosing && !VOID.has(tag) && stack.length < MAX_DEPTH) stack.push(el);
  }
  return doc;
}

function textOf(n: Node): string {
  if (typeof n === 'string') return n;
  let out = '';
  for (const c of n.children) out += textOf(c);
  return out;
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

function forEachEl(root: El, fn: (el: El) => void) {
  const stack: El[] = [root];
  while (stack.length) {
    const el = stack.pop()!;
    fn(el);
    for (let k = el.children.length - 1; k >= 0; k--) {
      const c = el.children[k];
      if (isEl(c)) stack.push(c);
    }
  }
}

function findAll(root: El, pred: (el: El) => boolean): El[] {
  const out: El[] = [];
  forEachEl(root, (el) => {
    if (pred(el)) out.push(el);
  });
  return out;
}

const findFirst = (root: El, pred: (el: El) => boolean): El | null => findAll(root, pred)[0] ?? null;

function remove(el: El) {
  const p = el.parent;
  if (!p) return;
  const idx = p.children.indexOf(el);
  if (idx !== -1) p.children.splice(idx, 1);
  el.parent = null;
}

const hasToken = (v: string | undefined, token: string) =>
  !!v && v.toLowerCase().split(/\s+/).includes(token.toLowerCase());

// ---------------------------------------------------------------------------------------------
// Metadata

type Meta = { title: string | null; byline: string | null; imageUrl: string | null; siteName: string | null };

const httpOnly = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);

function cleanByline(s: string | undefined | null): string | null {
  if (!s) return null;
  const t = collapse(s).replace(/^by\s+/i, '');
  if (!t || t.length > 100 || /^https?:\/\//i.test(t)) return null;
  return t;
}

function extractMeta(doc: El, base: string): Meta & { docTitle: string | null; ogTitle: string | null } {
  const meta: Record<string, string> = {};
  forEachEl(doc, (el) => {
    if (el.tag !== 'meta') return;
    const key = (el.attrs.property || el.attrs.name || el.attrs.itemprop || '').toLowerCase().trim();
    const content = el.attrs.content?.trim();
    if (key && content && !(key in meta)) meta[key] = content;
  });
  const titleEl = findFirst(doc, (el) => el.tag === 'title');
  const docTitle = titleEl ? collapse(textOf(titleEl)) || null : null;
  const ogTitle = collapse(meta['og:title'] ?? meta['twitter:title'] ?? '') || null;
  const siteName = collapse(meta['og:site_name'] ?? '') || null;

  let title = ogTitle;
  if (!title && docTitle) {
    title = docTitle;
    if (siteName) {
      const parts = docTitle.split(/\s+[|\-–—·»:]\s+/);
      if (parts.length > 1) {
        const rest = parts.filter((p) => p.toLowerCase() !== siteName.toLowerCase());
        if (rest.length < parts.length && rest.length) title = rest.join(' - ');
      }
    }
  }
  if (!title) {
    const h1 = findFirst(doc, (el) => el.tag === 'h1');
    title = h1 ? collapse(textOf(h1)) || null : null;
  }

  let byline = cleanByline(meta.author) ?? cleanByline(meta['article:author']);
  if (!byline) {
    const relAuthor = findFirst(doc, (el) => hasToken(el.attrs.rel, 'author') && el.tag !== 'link');
    byline = cleanByline(relAuthor && textOf(relAuthor));
  }
  if (!byline) {
    const by = findFirst(
      doc,
      (el) => /\bbyline\b/i.test(el.attrs.class ?? '') || hasToken(el.attrs.itemprop, 'author'),
    );
    if (by) {
      const name = findFirst(by, (el) => hasToken(el.attrs.itemprop, 'name'));
      byline = cleanByline(textOf(name ?? by));
    }
  }

  const img =
    meta['og:image'] ?? meta['og:image:url'] ?? meta['og:image:secure_url'] ?? meta['twitter:image'] ??
    meta['twitter:image:src'] ?? null;
  const imageUrl = httpOnly(resolveUrl(img, base));

  return { title, byline, imageUrl, siteName, docTitle, ogTitle };
}

// ---------------------------------------------------------------------------------------------
// Cleaning

const JUNK_TAGS = words(
  'script style noscript svg iframe form button nav header footer aside template object embed ' +
    'select input textarea canvas dialog link meta title head math',
);
const STRONG_NEG = /comment|share|social|related|promo|newsletter|subscribe|cookie|advert|popup|modal/i;
const WEAK_NEG = /sidebar|footer|nav|menu|banner|\bad\b/i;
const POSITIVE = /article|body|content|entry|main|post|story|text|markdown/i;
const CONTENT_CLASS =
  /\b(markdown-body|entry-content|post-content|post-body|article-body|article-content|article__body|story-body|rich-text)\b/i;

const isRootCandidate = (el: El) =>
  el.tag === 'html' ||
  el.tag === 'body' ||
  el.tag === 'article' ||
  el.tag === 'main' ||
  el.attrs.role === 'main' ||
  hasToken(el.attrs.itemprop, 'articleBody') ||
  CONTENT_CLASS.test(el.attrs.class ?? '');

function isHidden(el: El): boolean {
  const a = el.attrs;
  return (
    'hidden' in a ||
    a['aria-hidden'] === 'true' ||
    /display\s*:\s*none|visibility\s*:\s*hidden/i.test(a.style ?? '')
  );
}

function clean(doc: El) {
  // Which elements are (or contain) a possible article root: those survive pattern removal.
  const protectedEls = new Set<El>();
  const mark = (el: El): boolean => {
    let any = isRootCandidate(el);
    for (const c of el.children) if (isEl(c) && mark(c)) any = true;
    if (any) protectedEls.add(el);
    return any;
  };
  mark(doc);

  const doomed: El[] = [];
  const visit = (el: El) => {
    for (const c of el.children) {
      if (!isEl(c)) continue;
      if (isHidden(c)) {
        doomed.push(c);
        continue;
      }
      if (JUNK_TAGS.has(c.tag)) {
        // ASP.NET-style pages wrap the whole document in a <form>.
        if (!(c.tag === 'form' && protectedEls.has(c))) {
          doomed.push(c);
          continue;
        }
      }
      if (!protectedEls.has(c)) {
        const sig = `${c.attrs.class ?? ''} ${c.attrs.id ?? ''}`;
        if (STRONG_NEG.test(sig) || (WEAK_NEG.test(sig) && !POSITIVE.test(sig))) {
          doomed.push(c);
          continue;
        }
      }
      visit(c);
    }
  };
  visit(doc);
  for (const el of doomed) remove(el);
}

// ---------------------------------------------------------------------------------------------
// Root selection

type Stats = { text: number; link: number };

function computeStats(root: El): Map<El, Stats> {
  const stats = new Map<El, Stats>();
  const go = (el: El, inLink: boolean): Stats => {
    const s: Stats = { text: 0, link: 0 };
    const link = inLink || el.tag === 'a';
    for (const c of el.children) {
      if (typeof c === 'string') {
        const len = collapse(c).length;
        s.text += len;
        if (link) s.link += len;
      } else {
        const cs = go(c, link);
        s.text += cs.text;
        s.link += cs.link;
      }
    }
    stats.set(el, s);
    return s;
  };
  go(root, false);
  return stats;
}

const linkDensity = (st: Stats | undefined) => (st && st.text ? st.link / st.text : 0);

const NEG_WEIGHT =
  /hidden|banner|combx|comment|contact|foot|footnote|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|tool|widget|trending|popular/i;
const POS_WEIGHT = /article|body|content|entry|hentry|main|page|post|text|blog|story|markdown/i;

function classWeight(el: El): number {
  let w = 0;
  for (const s of [el.attrs.class, el.attrs.id]) {
    if (!s) continue;
    if (NEG_WEIGHT.test(s)) w -= 25;
    if (POS_WEIGHT.test(s)) w += 25;
  }
  return w;
}

function tagBase(tag: string): number {
  if (tag === 'div' || tag === 'article' || tag === 'section') return 5;
  if (tag === 'pre' || tag === 'td' || tag === 'blockquote') return 3;
  if (/^(address|ol|ul|dl|dd|dt|li|form)$/.test(tag)) return -3;
  if (HEADINGS.has(tag) || tag === 'th') return -5;
  return 0;
}

const isParagraphLike = (el: El) =>
  el.tag === 'p' ||
  el.tag === 'pre' ||
  el.tag === 'td' ||
  ((el.tag === 'div' || el.tag === 'section') && el.children.every((c) => !isEl(c) || INLINE.has(c.tag)));

function scoreRoot(body: El, stats: Map<El, Stats>): El {
  const scores = new Map<El, number>();
  const init = (el: El) => {
    if (!scores.has(el)) scores.set(el, tagBase(el.tag) + classWeight(el));
  };
  forEachEl(body, (el) => {
    if (!isParagraphLike(el)) return;
    const text = collapse(textOf(el));
    if (text.length < 25) return;
    const score = 1 + (text.match(/[,，]/g)?.length ?? 0) + Math.min(Math.floor(text.length / 100), 3);
    let anc = el.parent;
    for (let level = 0; anc && anc.tag !== '#doc' && level < 3; level++, anc = anc.parent) {
      init(anc);
      scores.set(anc, scores.get(anc)! + score / (level === 0 ? 1 : level === 1 ? 2 : level * 3));
    }
  });
  let top: El | null = null;
  let best = -Infinity;
  const final = new Map<El, number>();
  for (const [el, s] of scores) {
    const f = s * (1 - linkDensity(stats.get(el)));
    final.set(el, f);
    if (f > best) {
      best = f;
      top = el;
    }
  }
  if (!top) return body;

  // Pull in siblings that look like part of the same article.
  const parent = top.parent;
  if (!parent || top === body) return top;
  const threshold = Math.max(10, best * 0.2);
  const keep: Node[] = [];
  for (const sib of parent.children) {
    if (!isEl(sib)) continue;
    if (sib === top) {
      keep.push(sib);
      continue;
    }
    let s = final.get(sib) ?? -Infinity;
    if (sib.attrs.class && sib.attrs.class === top.attrs.class) s += best * 0.2;
    const st = stats.get(sib);
    const ld = linkDensity(st);
    const len = st?.text ?? 0;
    if (
      s >= threshold ||
      (sib.tag === 'p' && ((len > 80 && ld < 0.25) || (len > 0 && ld === 0 && /\.( |$)/.test(textOf(sib)))))
    )
      keep.push(sib);
  }
  if (keep.length === 1) return top;
  return { tag: 'div', attrs: {}, children: keep, parent: null };
}

function chooseRoot(body: El, stats: Map<El, Stats>): El {
  const ok = (el: El) => {
    const st = stats.get(el);
    // Lower bar than MIN_CHARS so a short semantic root (e.g. release notes) still beats scoring;
    // the final MIN_CHARS check in extractArticle decides whether anything is returned.
    return !!st && st.text >= 80 && linkDensity(st) < 0.5;
  };
  const largest = (els: El[]) => {
    let best: El | null = null;
    for (const el of els) if (ok(el) && (!best || stats.get(el)!.text > stats.get(best)!.text)) best = el;
    return best;
  };
  return (
    largest(findAll(body, (el) => el.tag === 'article')) ??
    largest(findAll(body, (el) => hasToken(el.attrs.itemprop, 'articleBody'))) ??
    largest(findAll(body, (el) => CONTENT_CLASS.test(el.attrs.class ?? ''))) ??
    largest(findAll(body, (el) => el.tag === 'main' || el.attrs.role === 'main')) ??
    scoreRoot(body, stats)
  );
}

// ---------------------------------------------------------------------------------------------
// Markdown

type Ctx = {
  blocks: string[];
  para: string;
  pending: string[];
  inline: number;
  flushes: number;
  inLink: boolean;
  env: Env;
};
type Env = { base: string; titles: Set<string>; skippedTitle: boolean };

const norm = (s: string) => collapse(s).toLowerCase();

const mdUrl = (u: string) => u.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');

const newCtx = (env: Env): Ctx => ({ blocks: [], para: '', pending: [], inline: 0, flushes: 0, inLink: false, env });

function flush(ctx: Ctx) {
  const text = ctx.para
    .replace(/[ \t\f\v\r ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (text) ctx.blocks.push(text);
  ctx.para = '';
  ctx.blocks.push(...ctx.pending);
  ctx.pending = [];
  ctx.flushes++;
}

const PLACEHOLDER = /^data:|blank\.|placeholder|spacer|1x1|transparent\.|lazy[-_.]|loading\.(gif|svg)|gr[ae]y\.gif/i;
const TRACKER = /(^|[/._-])(pixel|tracking|tracker|beacon)([/._?-]|$)|\/b\.gif|1x1|doubleclick\.net|facebook\.com\/tr/i;

const firstSrcset = (s: string | undefined) => (s ? (s.trim().split(/\s*,\s+/)[0] ?? '').split(/\s+/)[0] : '');

function imageMarkdown(el: El, env: Env): string | null {
  const a = el.attrs;
  let src = a.src?.trim() ?? '';
  if (!src || PLACEHOLDER.test(src)) {
    src =
      a['data-src'] ||
      a['data-lazy-src'] ||
      a['data-original'] ||
      a['data-url'] ||
      a['data-hi-res-src'] ||
      firstSrcset(a['data-srcset']) ||
      firstSrcset(a.srcset) ||
      '';
    if (!src && el.parent?.tag === 'picture') {
      const source = el.parent.children.find((c): c is El => isEl(c) && c.tag === 'source');
      src = firstSrcset(source?.attrs.srcset ?? source?.attrs['data-srcset']);
    }
  }
  if (!src || /^data:/i.test(src)) return null;
  const abs = httpOnly(resolveUrl(src, env.base));
  if (!abs || TRACKER.test(abs)) return null;
  const w = parseInt(a.width ?? '', 10);
  const h = parseInt(a.height ?? '', 10);
  if ((Number.isFinite(w) && w < 80) || (Number.isFinite(h) && h < 80)) return null;
  const alt = collapse(a.alt ?? '').replace(/[[\]]/g, '');
  return `![${alt}](${mdUrl(abs)})`;
}

function inlineText(children: Node[], env: Env): string {
  const ctx = newCtx(env);
  ctx.inline = 1;
  for (const c of children) walk(c, ctx);
  return collapse(ctx.para);
}

function blocksOf(children: Node[], env: Env): string[] {
  const ctx = newCtx(env);
  for (const c of children) walk(c, ctx);
  flush(ctx);
  return ctx.blocks;
}

function wrap(el: El, ctx: Ctx, open: string, close: string) {
  const start = ctx.para.length;
  const flushes = ctx.flushes;
  ctx.inline++;
  for (const c of el.children) walk(c, ctx);
  ctx.inline--;
  if (ctx.flushes !== flushes) return; // a block inside the inline element broke the run
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(ctx.para.slice(start))!;
  if (!m[2]) return;
  ctx.para = ctx.para.slice(0, start) + m[1] + open + m[2] + close + m[3];
}

function preText(n: Node): string {
  if (typeof n === 'string') return n;
  if (n.tag === 'br') return '\n';
  let out = '';
  for (const c of n.children) out += preText(c);
  return out;
}

function renderPre(el: El): string | null {
  const code = el.children.find((c): c is El => isEl(c) && c.tag === 'code');
  const cls = `${code?.attrs.class ?? ''} ${el.attrs.class ?? ''}`;
  const lang = /(?:^|\s)(?:lang(?:uage)?-)([\w+#-]+)/.exec(cls)?.[1] ?? '';
  const text = preText(el).replace(/^\n/, '').replace(/\s+$/, '');
  if (!text.trim()) return null;
  const fence = text.includes('```') ? '~~~~' : '```';
  return `${fence}${lang}\n${text}\n${fence}`;
}

function renderList(el: El, env: Env): string | null {
  const ordered = el.tag === 'ol';
  let num = parseInt(el.attrs.start ?? '1', 10);
  if (!Number.isFinite(num)) num = 1;
  const items: string[] = [];
  for (const c of el.children) {
    if (!isEl(c)) continue;
    const blocks = c.tag === 'li' ? blocksOf(c.children, env) : blocksOf([c], env);
    if (!blocks.length) continue;
    const marker = ordered ? `${num++}. ` : '- ';
    const pad = ' '.repeat(marker.length);
    const lines = blocks.join('\n').split('\n');
    items.push(marker + lines[0] + lines.slice(1).map((l) => `\n${l ? pad + l : ''}`).join(''));
  }
  return items.length ? items.join('\n') : null;
}

const hasBlockContent = (el: El) =>
  findFirst(el, (d) => d !== el && /^(p|div|table|ul|ol|h[1-6]|blockquote|pre)$/.test(d.tag)) !== null;

function renderTable(el: El, env: Env, ctx: Ctx) {
  if (hasBlockContent(el)) {
    // Layout table: treat cells as ordinary block containers.
    for (const c of el.children) walk(c, ctx);
    flush(ctx);
    return;
  }
  const rows: string[] = [];
  forEachEl(el, (r) => {
    if (r.tag !== 'tr') return;
    const cells = r.children
      .filter((c): c is El => isEl(c) && (c.tag === 'td' || c.tag === 'th'))
      .map((c) => inlineText(c.children, env))
      .filter(Boolean);
    if (cells.length) rows.push(cells.join(' | '));
  });
  const caption = el.children.find((c): c is El => isEl(c) && c.tag === 'caption');
  if (caption) {
    const t = inlineText(caption.children, env);
    if (t) ctx.blocks.push(`*${t}*`);
  }
  if (rows.length) ctx.blocks.push(rows.join('\n'));
}

const SKIP = words('video audio source track canvas map area object embed input select textarea option head caption');

function walk(n: Node, ctx: Ctx): void {
  if (typeof n === 'string') {
    ctx.para += n.replace(/\s+/g, ' ');
    return;
  }
  const tag = n.tag;
  const env = ctx.env;
  if (SKIP.has(tag)) return;

  switch (tag) {
    case 'br':
      ctx.para += '\n';
      return;
    case 'hr':
      flush(ctx);
      return;
    case 'img': {
      const md = imageMarkdown(n, env);
      if (!md || ctx.blocks.includes(md) || ctx.pending.includes(md)) return;
      if (ctx.inline > 0) ctx.pending.push(md);
      else {
        flush(ctx);
        ctx.blocks.push(md);
      }
      return;
    }
    case 'strong':
    case 'b':
      wrap(n, ctx, '**', '**');
      return;
    case 'em':
    case 'i':
      wrap(n, ctx, '*', '*');
      return;
    case 'code':
    case 'kbd':
    case 'samp':
    case 'tt': {
      const t = collapse(textOf(n));
      if (!t) return;
      const tick = t.includes('`') ? '``' : '`';
      ctx.para += `${tick}${t}${tick}`;
      return;
    }
    case 'a': {
      const href = httpOnly(resolveUrl(n.attrs.href, env.base));
      if (!href || ctx.inLink) {
        ctx.inline++;
        for (const c of n.children) walk(c, ctx);
        ctx.inline--;
        return;
      }
      ctx.inLink = true;
      wrap(n, ctx, '[', `](${mdUrl(href)})`);
      ctx.inLink = false;
      return;
    }
    case 'ul':
    case 'ol': {
      flush(ctx);
      const md = renderList(n, env);
      if (md) ctx.blocks.push(md);
      return;
    }
    case 'blockquote': {
      flush(ctx);
      const inner = blocksOf(n.children, env).join('\n\n');
      if (inner) ctx.blocks.push(inner.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n'));
      return;
    }
    case 'pre': {
      flush(ctx);
      const md = renderPre(n);
      if (md) ctx.blocks.push(md);
      return;
    }
    case 'figcaption': {
      flush(ctx);
      const t = inlineText(n.children, env);
      if (t) ctx.blocks.push(`*${t}*`);
      return;
    }
    case 'table':
      flush(ctx);
      renderTable(n, env, ctx);
      return;
  }

  if (HEADINGS.has(tag)) {
    flush(ctx);
    const t = inlineText(n.children, env)
      .replace(/^\*\*([\s\S]*)\*\*$/, '$1')
      .trim();
    if (!t) return;
    if (tag === 'h1' && !env.skippedTitle && env.titles.has(norm(t))) {
      env.skippedTitle = true;
      return;
    }
    ctx.blocks.push(`${tag === 'h1' || tag === 'h2' ? '##' : '###'} ${t}`);
    return;
  }

  if (INLINE.has(tag)) {
    ctx.inline++;
    for (const c of n.children) walk(c, ctx);
    ctx.inline--;
    return;
  }

  // Everything else is a block container (p, div, section, figure, li outside a list, ...).
  flush(ctx);
  for (const c of n.children) walk(c, ctx);
  flush(ctx);
}

function toMarkdown(root: El, env: Env): string {
  let md = blocksOf([root], env)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (md.length > MAX_MARKDOWN) {
    const cut = md.lastIndexOf('\n\n', MAX_MARKDOWN);
    md = md.slice(0, cut > MAX_MARKDOWN / 2 ? cut : MAX_MARKDOWN).trim();
  }
  return md;
}

// ---------------------------------------------------------------------------------------------
// Entry point

/** Returns null when no article-like content is found (e.g. a JS-only app shell, a video page, a PDF, a GitHub release page with <200 chars of prose is still fine to return). */
export function extractArticle(html: string, pageUrl: string): Extracted | null {
  if (!html || /^\s*%PDF-/.test(html)) return null;
  const doc = parseHtml(html);

  const baseEl = findFirst(doc, (el) => el.tag === 'base' && !!el.attrs.href);
  const base = (baseEl && resolveUrl(baseEl.attrs.href, pageUrl)) || pageUrl;

  const meta = extractMeta(doc, base);

  clean(doc);
  const body = findFirst(doc, (el) => el.tag === 'body') ?? doc;
  const stats = computeStats(doc);
  const root = chooseRoot(body, stats);

  const plain = collapse(textOf(root));
  if (plain.length < MIN_CHARS) return null;

  const titles = new Set<string>();
  for (const t of [meta.title, meta.ogTitle, meta.docTitle]) if (t) titles.add(norm(t));
  const markdown = toMarkdown(root, { base, titles, skippedTitle: false });
  if (!markdown) return null;

  return {
    markdown,
    chars: plain.length,
    title: meta.title,
    byline: meta.byline,
    imageUrl: meta.imageUrl,
    siteName: meta.siteName,
  };
}
