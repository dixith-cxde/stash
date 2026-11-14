/**
 * Self-contained RSS 2.0 / RSS 1.0 (RDF) / Atom parser for Hermes (no DOM, no dependencies).
 *
 * A lenient single-pass XML scanner builds a small element tree (CDATA, comments, PIs, DOCTYPE,
 * self-closing tags, either attribute quote style, unbalanced end tags). Element and attribute names
 * are lower-cased and keep their namespace prefix (`content:encoded`, `dc:creator`, `media:*`).
 */

export type ParsedItem = {
  /** Stable id: <guid>/<id>, else link, else title+date. */
  guid: string;
  url: string | null;
  title: string;
  summary: string | null;
  content: string | null;
  author: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
};

export type ParsedFeed = {
  title: string;
  siteUrl: string | null;
  description: string | null;
  iconUrl: string | null;
  items: ParsedItem[];
};

const MAX_ITEMS = 100;
const SUMMARY_MAX = 400;

// ---------------------------------------------------------------------------------------------
// Entities

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
};
(() => {
  // HTML 4 Latin-1 names, code points 160..255 in order.
  const latin1 =
    'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 ' +
    'acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde ' +
    'Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc ' +
    'Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml ' +
    'aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc ' +
    'otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml';
  latin1.split(' ').forEach((name, i) => {
    NAMED[name] = String.fromCharCode(160 + i);
  });
  const extra: [string, number][] = [
    ['OElig', 338], ['oelig', 339], ['Scaron', 352], ['scaron', 353], ['Yuml', 376], ['fnof', 402],
    ['circ', 710], ['tilde', 732], ['ensp', 8194], ['emsp', 8195], ['thinsp', 8201], ['zwnj', 8204],
    ['zwj', 8205], ['lrm', 8206], ['rlm', 8207], ['ndash', 8211], ['mdash', 8212], ['horbar', 8213],
    ['lsquo', 8216], ['rsquo', 8217], ['sbquo', 8218], ['ldquo', 8220], ['rdquo', 8221], ['bdquo', 8222],
    ['dagger', 8224], ['Dagger', 8225], ['bull', 8226], ['hellip', 8230], ['permil', 8240], ['prime', 8242],
    ['Prime', 8243], ['lsaquo', 8249], ['rsaquo', 8250], ['euro', 8364], ['trade', 8482], ['larr', 8592],
    ['uarr', 8593], ['rarr', 8594], ['darr', 8595], ['harr', 8596], ['rArr', 8658], ['minus', 8722],
    ['infin', 8734], ['asymp', 8776], ['ne', 8800], ['le', 8804], ['ge', 8805], ['loz', 9674],
    ['hearts', 9829], ['check', 10003], ['alpha', 945], ['beta', 946], ['gamma', 947], ['delta', 948],
    ['epsilon', 949], ['lambda', 955], ['mu', 956], ['pi', 960], ['sigma', 963], ['omega', 969],
    ['Delta', 916], ['Omega', 937],
  ];
  for (const [name, cp] of extra) NAMED[name] = String.fromCharCode(cp);
})();

/** Entities that are commonly written without the trailing ';' in the wild. */
const LOOSE = new Set(['amp', 'lt', 'gt', 'quot', 'nbsp']);

const ENTITY_RE = /&(#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*)(;?)/g;

function decodeEntities(s: string): string {
  if (s.indexOf('&') === -1) return s;
  return s.replace(ENTITY_RE, (m, body: string, semi: string) => {
    if (body.charCodeAt(0) === 35 /* # */) {
      const cp = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '�';
      return String.fromCodePoint(cp);
    }
    const v = NAMED[body];
    if (v === undefined || (!semi && !LOOSE.has(body))) return m;
    return v;
  });
}

// ---------------------------------------------------------------------------------------------
// Lenient XML scanner

type XNode = XEl | string;
type XEl = {
  name: string;
  attrs: Record<string, string>;
  children: XNode[];
  /** Offsets of the raw inner markup in `src`. */
  innerStart: number;
  innerEnd: number;
  src: string;
};

const ATTR_RE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(s))) {
    const key = m[1].toLowerCase();
    if (key in out) continue;
    out[key] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

function parseXml(src: string): XEl {
  const n = src.length;
  const doc: XEl = { name: '#doc', attrs: {}, children: [], innerStart: 0, innerEnd: n, src };
  const stack: XEl[] = [doc];
  let i = 0;

  const pushText = (raw: string) => {
    if (raw) stack[stack.length - 1].children.push(decodeEntities(raw));
  };

  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      pushText(src.slice(i));
      break;
    }
    if (lt > i) pushText(src.slice(i, lt));
    const c1 = src.charCodeAt(lt + 1);

    if (c1 === 33 /* ! */) {
      if (src.startsWith('<!--', lt)) {
        const e = src.indexOf('-->', lt + 4);
        i = e === -1 ? n : e + 3;
      } else if (src.startsWith('<![CDATA[', lt)) {
        const e = src.indexOf(']]>', lt + 9);
        stack[stack.length - 1].children.push(src.slice(lt + 9, e === -1 ? n : e));
        i = e === -1 ? n : e + 3;
      } else {
        // DOCTYPE (possibly with an internal subset)
        const gt = src.indexOf('>', lt);
        const br = src.indexOf('[', lt);
        if (br !== -1 && gt !== -1 && br < gt) {
          const e = src.indexOf(']>', br);
          i = e === -1 ? n : e + 2;
        } else i = gt === -1 ? n : gt + 1;
      }
      continue;
    }
    if (c1 === 63 /* ? */) {
      const e = src.indexOf('?>', lt + 2);
      i = e === -1 ? n : e + 2;
      continue;
    }
    if (c1 === 47 /* / */) {
      const gt = src.indexOf('>', lt + 2);
      const name = src
        .slice(lt + 2, gt === -1 ? n : gt)
        .trim()
        .toLowerCase();
      for (let k = stack.length - 1; k >= 1; k--) {
        if (stack[k].name === name) {
          for (let m = stack.length - 1; m >= k; m--) stack[m].innerEnd = lt;
          stack.length = k;
          break;
        }
      }
      i = gt === -1 ? n : gt + 1;
      continue;
    }
    // Start tag must begin with a name character, otherwise it's a stray '<'.
    const isNameStart =
      (c1 >= 65 && c1 <= 90) || (c1 >= 97 && c1 <= 122) || c1 === 95 || c1 === 58 || c1 > 127;
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
    const name = body.slice(0, k).toLowerCase();
    const el: XEl = {
      name,
      attrs: k < body.length ? parseAttrs(body.slice(k)) : {},
      children: [],
      innerStart: Math.min(j + 1, n),
      innerEnd: Math.min(j + 1, n),
      src,
    };
    stack[stack.length - 1].children.push(el);
    if (!selfClosing) {
      el.innerEnd = n;
      stack.push(el);
    }
    i = j + 1;
  }
  return doc;
}

const isEl = (x: XNode): x is XEl => typeof x !== 'string';

function elements(el: XEl | null | undefined): XEl[] {
  if (!el) return [];
  const out: XEl[] = [];
  for (const c of el.children) if (isEl(c)) out.push(c);
  return out;
}

function child(el: XEl | null | undefined, ...names: string[]): XEl | null {
  if (!el) return null;
  for (const name of names) {
    for (const c of el.children) if (isEl(c) && c.name === name) return c;
  }
  return null;
}

function childrenNamed(el: XEl | null | undefined, name: string): XEl[] {
  return elements(el).filter((c) => c.name === name);
}

function textOf(el: XEl | null | undefined): string {
  if (!el) return '';
  let out = '';
  for (const c of el.children) out += isEl(c) ? textOf(c) : c;
  return out;
}

function hasElementChildren(el: XEl): boolean {
  return el.children.some(isEl);
}

/** Raw inner markup with CDATA wrappers removed (for unescaped HTML / Atom xhtml). */
function rawInner(el: XEl): string {
  return el.src.slice(el.innerStart, el.innerEnd).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

const localName = (name: string) => name.slice(name.indexOf(':') + 1);

// ---------------------------------------------------------------------------------------------
// URLs

const ABS_RE = /^[a-z][a-z0-9+.-]*:/i;
const BASE_RE = /^([a-z][a-z0-9+.-]*:)\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i;

function removeDotSegments(path: string): string {
  const out: string[] = [];
  const segs = path.split('/');
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s === '.') {
      if (i === segs.length - 1) out.push('');
    } else if (s === '..') {
      if (out.length > 1) out.pop();
      if (i === segs.length - 1) out.push('');
    } else out.push(s);
  }
  const joined = out.join('/');
  return joined.startsWith('/') ? joined : '/' + joined;
}

function resolveUrl(href: string | null | undefined, base: string | null | undefined): string | null {
  const h = (href ?? '').trim();
  if (!h) return null;
  if (ABS_RE.test(h)) return /^(javascript|data|vbscript):/i.test(h) ? null : h;
  const b = base ? BASE_RE.exec(base.trim()) : null;
  if (!b) return null;
  const [, scheme, host, rawPath, query = ''] = b;
  const path = rawPath || '/';
  if (h.startsWith('//')) return scheme + h;
  if (h.startsWith('/')) {
    const m = /^([^?#]*)(.*)$/.exec(h)!;
    return `${scheme}//${host}${removeDotSegments(m[1])}${m[2]}`;
  }
  if (h.startsWith('?')) return `${scheme}//${host}${path}${h}`;
  if (h.startsWith('#')) return `${scheme}//${host}${path}${query}${h}`;
  const dir = path.slice(0, path.lastIndexOf('/') + 1);
  const m = /^([^?#]*)(.*)$/.exec(h)!;
  return `${scheme}//${host}${removeDotSegments(dir + m[1])}${m[2]}`;
}

// ---------------------------------------------------------------------------------------------
// Dates

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const ZONES: Record<string, number> = {
  UT: 0, UTC: 0, GMT: 0, Z: 0, EST: -300, EDT: -240, CST: -360, CDT: -300, MST: -420, MDT: -360,
  PST: -480, PDT: -420, CET: 60, CEST: 120, BST: 60, IST: 330, JST: 540, AEST: 600, AEDT: 660,
};

const ISO_RE =
  /^(\d{4})-?(\d{2})-?(\d{2})(?:[T\s]+(\d{2}):?(\d{2})(?::?(\d{2})(?:[.,](\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?$/i;
const RFC_RE =
  /^(?:[a-z]+,?\s*)?(\d{1,2})[\s-]+([a-z]{3,})\.?[\s-]+(\d{2,4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(?:([+-]\d{2}:?\d{2})|([a-z]{1,5}))?/i;

function offsetMinutes(tz: string | undefined): number | null {
  if (!tz) return 0;
  if (/^z$/i.test(tz)) return 0;
  const m = /^([+-])(\d{2}):?(\d{2})?$/.exec(tz);
  if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  const z = ZONES[tz.toUpperCase()];
  return z === undefined ? 0 : z;
}

function utc(y: number, mo: number, d: number, h: number, mi: number, s: number, ms: number, off: number) {
  if (mo < 0 || mo > 11 || d < 1 || d > 31 || h > 24 || mi > 59 || s > 60) return null;
  const t = Date.UTC(y, mo, d, h, mi, s, ms) - off * 60000;
  return Number.isFinite(t) ? new Date(t) : null;
}

function parseDate(raw: string | null | undefined): Date | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  let m = ISO_RE.exec(s);
  if (m) {
    const off = offsetMinutes(m[8]);
    const ms = m[7] ? Math.round(Number('0.' + m[7]) * 1000) : 0;
    return utc(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), ms, off ?? 0);
  }
  m = RFC_RE.exec(s);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo !== undefined) {
      let y = +m[3];
      if (m[3].length <= 2) y += y < 50 ? 2000 : 1900;
      const off = offsetMinutes(m[7] ?? m[8]);
      return utc(y, mo, +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), 0, off ?? 0);
    }
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
}

// ---------------------------------------------------------------------------------------------
// HTML -> text

const P = '\u0001'; // paragraph break marker
const L = '\u0002'; // line break marker

const DROP_RE =
  /<((?:[a-z0-9]+:)?(?:script|style|noscript|template|svg|iframe|head|object|select|button|math))\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const DROP_OPEN_RE = /<(?:[a-z0-9]+:)?(?:script|style)\b[\s\S]*$/i;
const BLOCK_RE =
  /<\/?(?:[a-z0-9]+:)?(?:p|div|h[1-6]|ul|ol|dl|dt|dd|blockquote|pre|section|article|header|footer|aside|nav|main|figure|figcaption|table|thead|tbody|tfoot|tr|hr|address|details|summary|center|fieldset|video|audio|body|html)\b[^>]*>/gi;
const LI_RE = /<(?:[a-z0-9]+:)?li\b[^>]*>/gi;
const BR_RE = /<(?:[a-z0-9]+:)?br\b[^>]*>/gi;
const CELL_RE = /<(?:[a-z0-9]+:)?t[dh]\b[^>]*>/gi;
const TAG_RE = /<\/?[a-z][^>]*>|<![^>]*>|<\?[^>]*>/gi;

/** HTML fragment -> readable plain text: paragraphs separated by '\n\n', list items as '• '. */
export function htmlToText(html: string): string {
  if (!html) return '';
  let s = html
    .replace(/[\u0001\u0002]/g, '')
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(DROP_RE, '')
    .replace(DROP_OPEN_RE, '')
    .replace(BR_RE, L)
    .replace(LI_RE, `${L}• `)
    .replace(BLOCK_RE, P)
    .replace(CELL_RE, ' ')
    .replace(TAG_RE, '');
  s = decodeEntities(s).replace(/[\s\u00a0\u2028\u2029]+/g, ' ');
  s = s.replace(/ *([\u0001\u0002][\u0001\u0002 ]*)/g, (_m, run: string) => (run.indexOf(P) === -1 ? '\n' : '\n\n'));
  return s.trim();
}

const HTML_TAG_RE = /<\/?[a-z][a-z0-9]*(?::[a-z0-9]+)?(?:\s[^>]*)?\/?>/i;
const ESCAPED_TAG_RE = /&lt;\/?[a-z][a-z0-9]*(?:\s|\/?&gt;)/i;

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Plain one-line text (titles, names). Strips markup if present. */
function inline(s: string): string {
  return collapse(HTML_TAG_RE.test(s) ? htmlToText(s) : s);
}

/** HTML body string of an RSS element (CDATA, entity-escaped, double-escaped or raw markup). */
function rssBody(el: XEl | null): string {
  if (!el) return '';
  if (hasElementChildren(el)) return rawInner(el);
  let s = textOf(el);
  if (!HTML_TAG_RE.test(s) && ESCAPED_TAG_RE.test(s)) s = decodeEntities(s);
  return s;
}

/** Atom text construct (type="text|html|xhtml") -> HTML string. */
function atomBody(el: XEl | null): string {
  if (!el || el.attrs.src) return '';
  const type = (el.attrs.type ?? 'text').toLowerCase();
  if (type === 'xhtml' || type.includes('xhtml')) return rawInner(el);
  if (type === 'html' || type.includes('html')) return rssBody(el);
  if (hasElementChildren(el)) return rawInner(el);
  // Plain text: escape so htmlToText keeps it verbatim, preserving line breaks as paragraphs.
  return textOf(el)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\n\s*\n/g, '<p>')
    .replace(/\n/g, '<br>');
}

function clip(s: string, max = SUMMARY_MAX): string {
  if (s.length <= max) return s;
  let cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  if (sp > max * 0.5) cut = cut.slice(0, sp);
  return cut.replace(/[\s,.;:!?\-–—]+$/, '') + '…';
}

const summaryOf = (html: string) => {
  const s = clip(collapse(htmlToText(html)));
  return s || null;
};
const contentOf = (html: string) => htmlToText(html) || null;

// ---------------------------------------------------------------------------------------------
// Images & authors

const IMG_EXT_RE = /\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:[?#]|$)/i;
const IMG_RE = /<img\b[^>]*>/gi;

function firstImgInHtml(html: string, base: string | null): string | null {
  if (!html || html.indexOf('<') === -1) return null;
  IMG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMG_RE.exec(html))) {
    const a = parseAttrs(m[0].slice(4, -1));
    if (a.width === '1' || a.height === '1') continue;
    const src = a.src || a['data-src'];
    if (!src || /^data:/i.test(src)) continue;
    const abs = resolveUrl(src, base);
    if (abs) return abs;
  }
  return null;
}

function mediaImage(el: XEl, base: string | null): string | null {
  const els = elements(el);
  for (const c of els) {
    if (c.name === 'media:content' && c.attrs.url) {
      const medium = (c.attrs.medium ?? '').toLowerCase();
      const type = (c.attrs.type ?? '').toLowerCase();
      if (medium === 'image' || type.startsWith('image/') || (!medium && !type && IMG_EXT_RE.test(c.attrs.url))) {
        return resolveUrl(c.attrs.url, base);
      }
    }
  }
  for (const c of els) {
    if (c.name === 'media:thumbnail' && c.attrs.url) return resolveUrl(c.attrs.url, base);
  }
  for (const c of els) {
    if (c.name === 'media:group') {
      const r = mediaImage(c, base);
      if (r) return r;
    }
  }
  for (const c of els) {
    if (c.name === 'enclosure' && c.attrs.url) {
      const type = (c.attrs.type ?? '').toLowerCase();
      if (type.startsWith('image/') || (!type && IMG_EXT_RE.test(c.attrs.url))) return resolveUrl(c.attrs.url, base);
    }
    if (c.name === 'link' && c.attrs.rel === 'enclosure' && (c.attrs.type ?? '').toLowerCase().startsWith('image/')) {
      return resolveUrl(c.attrs.href, base);
    }
  }
  for (const c of els) {
    if (c.name === 'itunes:image' && c.attrs.href) return resolveUrl(c.attrs.href, base);
  }
  const img = child(el, 'image');
  if (img) {
    const u = (textOf(child(img, 'url')) || textOf(img)).trim();
    if (/^https?:|^\//i.test(u)) return resolveUrl(u, base);
  }
  return null;
}

function cleanAuthor(raw: string): string | null {
  let s = collapse(raw);
  // RSS "email (Name)"
  const m = /^\S+@\S+\s*\((.+)\)$/.exec(s);
  if (m) s = m[1].trim();
  return s || null;
}

function atomAuthor(el: XEl | null): string | null {
  if (!el) return null;
  const a = child(el, 'author');
  if (!a) return null;
  return cleanAuthor(textOf(child(a, 'name')) || textOf(a));
}

// ---------------------------------------------------------------------------------------------
// Links

type LinkPick = { href: string | null; rel: string; type: string };

function atomLinks(el: XEl, names: string[]): LinkPick[] {
  return elements(el)
    .filter((c) => names.includes(c.name) && c.attrs.href !== undefined)
    .map((c) => ({
      href: c.attrs.href,
      rel: (c.attrs.rel || 'alternate').toLowerCase(),
      type: (c.attrs.type ?? '').toLowerCase(),
    }));
}

function alternateHref(links: LinkPick[]): string | null {
  const alts = links.filter((l) => l.rel === 'alternate');
  const html = alts.find((l) => !l.type || l.type.includes('html'));
  return (html ?? alts[0])?.href ?? null;
}

// ---------------------------------------------------------------------------------------------
// Items

function finishItem(p: {
  id: string;
  url: string | null;
  title: string;
  summaryHtml: string;
  bodyHtml: string;
  author: string | null;
  mediaImg: string | null;
  base: string | null;
  dateRaw: string;
}): ParsedItem | null {
  const publishedAt = parseDate(p.dateRaw);
  const content = contentOf(p.bodyHtml || p.summaryHtml);
  const summary = summaryOf(p.summaryHtml) ?? (content ? clip(collapse(content)) : null);
  const imageUrl = p.mediaImg ?? firstImgInHtml(p.bodyHtml, p.base) ?? firstImgInHtml(p.summaryHtml, p.base);
  let guid = p.id.trim() || p.url || '';
  if (!guid) {
    const key = p.title || (summary ? summary.slice(0, 120) : '');
    const date = publishedAt ? publishedAt.toISOString() : p.dateRaw.trim();
    if (!key && !date) return null;
    guid = `${key}|${date}`;
  }
  if (!p.title && !p.url && !summary && !content) return null;
  return {
    guid,
    url: p.url,
    title: p.title,
    summary,
    content,
    author: p.author,
    imageUrl,
    publishedAt,
  };
}

function rssItem(it: XEl, base: string | null): ParsedItem | null {
  const title = inline(textOf(child(it, 'title')));
  const guidEl = child(it, 'guid');
  const guidText = textOf(guidEl).trim();
  let link = textOf(child(it, 'link')).trim();
  if (!link) link = alternateHref(atomLinks(it, ['atom:link', 'link'])) ?? '';
  if (!link && guidText && guidEl?.attrs.ispermalink !== 'false' && /^https?:\/\//i.test(guidText)) link = guidText;
  if (!link && it.attrs['rdf:about']) link = it.attrs['rdf:about'];
  const url = resolveUrl(link, base);
  const descEl = child(it, 'description', 'summary', 'itunes:summary', 'dc:description');
  const bodyEl = child(it, 'content:encoded', 'xhtml:body', 'body', 'content');
  const authorEl = child(it, 'dc:creator', 'author', 'itunes:author', 'dc:contributor');
  const author = cleanAuthor(textOf(child(authorEl, 'name') ?? authorEl));
  return finishItem({
    id: guidText || it.attrs['rdf:about'] || '',
    url,
    title,
    summaryHtml: descEl && descEl.name === 'content' ? atomBody(descEl) : rssBody(descEl),
    bodyHtml: bodyEl && bodyEl.name === 'content' ? atomBody(bodyEl) : rssBody(bodyEl),
    author,
    mediaImg: mediaImage(it, base),
    base,
    dateRaw: textOf(child(it, 'pubdate', 'dc:date', 'published', 'updated', 'dcterms:created', 'dcterms:modified')),
  });
}

function atomEntry(entry: XEl, feedBase: string | null, feedAuthor: string | null): ParsedItem | null {
  const base = resolveUrl(entry.attrs['xml:base'], feedBase) ?? feedBase;
  const titleEl = child(entry, 'title');
  const title = titleEl ? inline(atomBody(titleEl)) : '';
  const url = resolveUrl(alternateHref(atomLinks(entry, ['link', 'atom:link'])), base);
  return finishItem({
    id: textOf(child(entry, 'id', 'guid')).trim(),
    url,
    title,
    summaryHtml: atomBody(child(entry, 'summary', 'media:description')),
    bodyHtml: atomBody(child(entry, 'content')),
    author: atomAuthor(entry) ?? cleanAuthor(textOf(child(entry, 'dc:creator'))) ?? feedAuthor,
    mediaImg: mediaImage(entry, base),
    base,
    dateRaw: textOf(child(entry, 'published', 'issued', 'created', 'updated', 'modified', 'dc:date')),
  });
}

function collect<T>(nodes: XEl[], fn: (n: XEl) => T | null): T[] {
  const out: T[] = [];
  for (const n of nodes) {
    if (out.length >= MAX_ITEMS) break;
    try {
      const r = fn(n);
      if (r) out.push(r);
    } catch {
      // Skip malformed items.
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Feeds

function parseRss(channel: XEl, itemParent: XEl[], rootImage: XEl | null, feedUrl: string): ParsedFeed {
  const linkText = textOf(child(channel, 'link')).trim() || alternateHref(atomLinks(channel, ['atom:link'])) || '';
  const siteUrl = resolveUrl(linkText, feedUrl);
  const base = siteUrl ?? feedUrl;
  const imgEl = child(channel, 'image');
  const iconRaw =
    textOf(child(imgEl, 'url')).trim() ||
    textOf(child(rootImage, 'url')).trim() ||
    imgEl?.attrs['rdf:resource'] ||
    child(channel, 'itunes:image')?.attrs.href ||
    textOf(child(channel, 'atom:icon', 'atom:logo')).trim();
  const descEl = child(channel, 'description', 'itunes:summary', 'subtitle', 'itunes:subtitle');
  const description = descEl ? collapse(htmlToText(rssBody(descEl))) || null : null;

  let items: XEl[] = [];
  for (const p of itemParent) {
    items = childrenNamed(p, 'item');
    if (items.length) break;
  }
  return {
    title: inline(textOf(child(channel, 'title'))),
    siteUrl,
    description,
    iconUrl: resolveUrl(iconRaw, base),
    items: collect(items, (it) => rssItem(it, base)),
  };
}

function parseAtom(feed: XEl, feedUrl: string): ParsedFeed {
  const feedBase = resolveUrl(feed.attrs['xml:base'], feedUrl) ?? feedUrl;
  const siteUrl = resolveUrl(alternateHref(atomLinks(feed, ['link', 'atom:link'])), feedBase);
  const base = feedBase;
  const titleEl = child(feed, 'title');
  const subEl = child(feed, 'subtitle', 'tagline');
  const iconRaw = textOf(child(feed, 'icon')).trim() || textOf(child(feed, 'logo')).trim();
  const feedAuthor = atomAuthor(feed);
  return {
    title: titleEl ? inline(atomBody(titleEl)) : '',
    siteUrl,
    description: subEl ? collapse(htmlToText(atomBody(subEl))) || null : null,
    iconUrl: resolveUrl(iconRaw, base),
    items: collect(childrenNamed(feed, 'entry'), (e) => atomEntry(e, base, feedAuthor)),
  };
}

/** Throws Error('Not a feed') if the document is not RSS 2.0, RSS 1.0 (RDF) or Atom. */
export function parseFeed(xml: string, feedUrl: string): ParsedFeed {
  if (typeof xml !== 'string' || !xml) throw new Error('Not a feed');
  const doc = parseXml(xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml);
  const root = elements(doc)[0];
  if (!root) throw new Error('Not a feed');
  const kind = localName(root.name);
  if (kind === 'rss') {
    const channel = child(root, 'channel');
    if (!channel) throw new Error('Not a feed');
    return parseRss(channel, [channel, root], null, feedUrl);
  }
  if (kind === 'rdf') {
    const channel = child(root, 'channel', 'rss:channel');
    if (!channel) throw new Error('Not a feed');
    return parseRss(channel, [root, channel], child(root, 'image'), feedUrl);
  }
  if (kind === 'feed') return parseAtom(root, feedUrl);
  throw new Error('Not a feed');
}

// ---------------------------------------------------------------------------------------------
// Discovery & sniffing

const FEED_TYPES = new Set(['application/rss+xml', 'application/atom+xml', 'application/rdf+xml']);

/** <link rel="alternate" type="application/rss+xml|atom+xml"> hrefs in an HTML page, absolute, deduped, in page order. */
export function discoverFeeds(html: string, pageUrl: string): string[] {
  if (!html) return [];
  const src = html.replace(/<!--[\s\S]*?-->/g, '');
  let base = pageUrl;
  const b = /<base\b([^>]*)>/i.exec(src);
  if (b) base = resolveUrl(parseAttrs(b[1]).href, pageUrl) ?? pageUrl;
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /<link\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const a = parseAttrs(m[1]);
    const rel = (a.rel ?? '').toLowerCase().split(/\s+/);
    if (!rel.includes('alternate')) continue;
    const type = (a.type ?? '').toLowerCase().split(';')[0].trim();
    if (!FEED_TYPES.has(type)) continue;
    const abs = resolveUrl(a.href, base);
    if (abs && !seen.has(abs)) {
      seen.add(abs);
      out.push(abs);
    }
  }
  return out;
}

/** True if the text looks like an RSS/Atom document (cheap sniff of the prolog + root tag). */
export function looksLikeFeed(text: string): boolean {
  if (!text) return false;
  let s = text.slice(0, 8192);
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  for (;;) {
    s = s.replace(/^\s+/, '');
    let end = -1;
    if (s.startsWith('<?')) end = s.indexOf('?>') + 2;
    else if (s.startsWith('<!--')) end = s.indexOf('-->') + 3;
    else if (/^<!doctype/i.test(s)) end = s.indexOf('>') + 1;
    else break;
    if (end <= 1) return false;
    s = s.slice(end);
  }
  return /^<(?:[a-z_][\w.-]*:)?(?:rss|rdf|feed)[\s>/]/i.test(s.slice(0, 1024));
}
