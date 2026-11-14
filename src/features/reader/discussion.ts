/**
 * Discussion data for the article reader. Pure, no React.
 *
 * Reader-mode Markdown (feed_items.article) may end with a discussion block written by the
 * extractor, as HTML comments the Markdown renderer ignores:
 *
 *   <!-- stash:meta {"byline":"Jane Doe","siteName":"Example"} -->
 *   <!-- stash:discussion {"title":"37 Comments","count":37,"url":"https://…#comments"} -->
 *   <!-- stash:comment {"author":"ann","time":"2026-11-14T04:01:00Z","depth":0} -->
 *   comment body (Markdown)
 *
 * Articles cached before that format still carry the page's comment thread inline, as a
 * "37 Comments on …" heading followed by "[#1](permalink)" blocks. `parseReaderMarkdown`
 * understands both and always returns the body without the thread.
 */

export type ReaderComment = {
  author: string | null;
  /** ISO date or the page's own text ("Today, 04:01"). */
  time: string | null;
  /** 0 for top-level comments, 1+ for replies. */
  depth: number;
  markdown: string;
  permalink: string | null;
};

export type Discussion = {
  title: string | null;
  /** The count the page states, else the number of comments found. */
  count: number | null;
  url: string | null;
  comments: ReaderComment[];
};

export type ReaderMeta = { byline: string | null; siteName: string | null };

export type ParsedArticle = { body: string; meta: ReaderMeta | null; discussion: Discussion | null };

/** Caps so a huge thread never bloats the cached row or the screen. */
export const MAX_COMMENTS = 60;
const MAX_COMMENT_CHARS = 3000;
const MAX_DISCUSSION_CHARS = 24_000;

// ---------------------------------------------------------------------------------------------
// Serialized format

const MARKER = /^<!-- stash:(meta|discussion|comment) (\{.*\}) -->$/;

/** JSON that can never close the HTML comment it lives in. */
const json = (v: unknown) => JSON.stringify(v).replace(/-/g, '\\u002d').replace(/>/g, '\\u003e');

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

/** The trailing block the extractor appends to the Markdown. Empty when there is nothing to add. */
export function serializeExtras(meta: ReaderMeta | null, discussion: Discussion | null): string {
  const out: string[] = [];
  if (meta && (meta.byline || meta.siteName)) out.push(`<!-- stash:meta ${json(meta)} -->`);
  if (discussion && discussion.comments.length) {
    out.push(`<!-- stash:discussion ${json({ title: discussion.title, count: discussion.count, url: discussion.url })} -->`);
    let total = 0;
    for (const c of discussion.comments.slice(0, MAX_COMMENTS)) {
      const body = clip(c.markdown.trim(), MAX_COMMENT_CHARS);
      if (!body) continue;
      total += body.length;
      if (total > MAX_DISCUSSION_CHARS) break;
      out.push(`<!-- stash:comment ${json({ author: c.author, time: c.time, depth: c.depth, permalink: c.permalink })} -->\n\n${body}`);
    }
  }
  return out.join('\n\n');
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.lastIndexOf('\n\n', max);
  return `${s.slice(0, cut > max / 2 ? cut : max).trim()} …`;
}

function parseSerialized(md: string): ParsedArticle | null {
  const start = md.search(/^<!-- stash:(meta|discussion|comment) /m);
  if (start === -1) return null;
  const body = md.slice(0, start).trim();
  let meta: ReaderMeta | null = null;
  let discussion: Discussion | null = null;
  let current: ReaderComment | null = null;
  const lines = md.slice(start).split('\n');
  const finish = () => {
    if (current && discussion) {
      current.markdown = current.markdown.trim();
      if (current.markdown) discussion.comments.push(current);
    }
    current = null;
  };
  for (const line of lines) {
    const m = MARKER.exec(line);
    if (!m) {
      if (current) (current as ReaderComment).markdown += `${line}\n`;
      continue;
    }
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(m[2]) as Record<string, unknown>;
    } catch {
      continue;
    }
    finish();
    if (m[1] === 'meta') meta = { byline: str(data.byline), siteName: str(data.siteName) };
    else if (m[1] === 'discussion') discussion = { title: str(data.title), count: num(data.count), url: str(data.url), comments: [] };
    else {
      discussion ??= { title: null, count: null, url: null, comments: [] };
      current = {
        author: str(data.author),
        time: str(data.time),
        depth: Math.min(num(data.depth) ?? 0, 8),
        permalink: str(data.permalink),
        markdown: '',
      };
    }
  }
  finish();
  if (discussion && !(discussion as Discussion).comments.length) discussion = null;
  return { body, meta, discussion };
}

// ---------------------------------------------------------------------------------------------
// Legacy (inline thread) format

/** Heading text that opens a comment thread: "37 Comments on …", "Comments", "Discussion". */
const COMMENTS_HEADING =
  /^(\d[\d,.]*\s+(comments?|responses|replies|thoughts)\b|(reader\s+)?(comments?|discussion|responses|replies)(\s*\(\d[\d,]*\))?$|join the discussion|leave a (reply|comment))/i;

/** A block that is only a post number or its permalink: "#1", "[#12](https://…)". */
const POST_MARKER = /^\[?#(\d+)\]?(?:\((\S*?)\))?$/;

/** "[Discuss (37 Comments)](…#comments)" and similar jump links in the byline. */
const JUMP_LINK = /\[[^\]\n]*\b(comments?|discuss(ion)?|repl(y|ies))\b[^\]\n]*\]\([^)\s]*#(comments?|respond|disqus_thread|discussion|replies)\)/gi;

/** Heading text without Markdown emphasis or link targets. */
export const headingText = (line: string) =>
  line
    .replace(/^#{1,6}\s+/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim();

/** Splits Markdown into blocks at blank lines, keeping fenced code blocks whole. Linear. */
function blocks(md: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let fence: string | null = null;
  for (const line of md.split('\n')) {
    const f = /^(```|~~~)/.exec(line);
    if (f) fence = fence ? (line.startsWith(fence) ? null : fence) : f[1];
    if (!fence && !line.trim()) {
      if (cur.length) out.push(cur.join('\n'));
      cur = [];
    } else cur.push(line);
  }
  if (cur.length) out.push(cur.join('\n'));
  return out;
}

const countIn = (s: string) => {
  const m = /(\d[\d,.]*)\s+(comments?|responses|replies|thoughts)\b/i.exec(s) ?? /\((\d[\d,]*)\)/.exec(s);
  if (!m) return null;
  const n = parseInt(m[1].replace(/[,.]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

/**
 * Finds an inline comment thread (a comments heading, then "#N" post blocks) and lifts it out
 * of the body. Returns null when there is none; a bare trailing "Leave a reply" heading is
 * dropped from the body.
 */
export function splitInlineThread(md: string): { body: string; discussion: Discussion | null } | null {
  const bs = blocks(md);
  let at = -1;
  for (let i = 1; i < bs.length; i++) {
    if (/^#{1,6}\s/.test(bs[i]) && !bs[i].includes('\n') && COMMENTS_HEADING.test(headingText(bs[i]))) {
      at = i;
      break;
    }
  }
  if (at === -1) return null;
  const heading = headingText(bs[at]);
  const tail = bs.slice(at + 1);
  const comments: ReaderComment[] = [];
  let cur: ReaderComment | null = null;
  for (const b of tail) {
    const m = POST_MARKER.exec(b.trim());
    if (m) {
      if (cur?.markdown) comments.push(cur);
      cur = { author: null, time: null, depth: 0, markdown: '', permalink: m[2] && /^https?:\/\//i.test(m[2]) ? m[2] : null };
      continue;
    }
    if (cur) cur.markdown += (cur.markdown ? '\n\n' : '') + b;
  }
  if (cur?.markdown) comments.push(cur);
  const body = bs.slice(0, at).join('\n\n');
  if (!comments.length) {
    // A form heading with nothing readable after it ("Leave a Reply"): drop it.
    const rest = tail.join(' ').replace(/[#*_>\-\s]/g, '');
    return rest.length < 40 ? { body, discussion: null } : null;
  }
  const link = /\]\((https?:\/\/[^)\s]+)\)/.exec(bs[at])?.[1] ?? null;
  return {
    body,
    discussion: { title: heading.replace(/\s+on\s+.*$/i, '') || 'Comments', count: countIn(heading) ?? comments.length, url: link, comments },
  };
}

/** Removes "Discuss (37 Comments)"-style jump links from a body. */
export const dropJumpLinks = (md: string) => md.replace(JUMP_LINK, '').replace(/[ \t]+\n/g, '\n');

const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const DAY = '\\d{1,2}(st|nd|rd|th)?';
/** Byline and dateline scraps the metadata card already shows ("by", "Today, 04:01", a date). */
const CHROME_LINES = [
  /^by:?$/i,
  /^(by\s+)?\[[^\]\n]{1,60}\]\([^)\s]*\/(members?|authors?|people|profiles?|users?|staff|writers?)\/[^)\s]*\)$/i,
  new RegExp(`^(((mon|tues|wednes|thurs|fri|satur|sun)day),?\\s+)?(${MONTH}\\s+${DAY},?|${DAY}\\s+${MONTH})\\s+\\d{4}$`, 'i'),
  /^(today|yesterday),?\s+\d{1,2}:\d{2}(\s*[ap]\.?m\.?)?$/i,
];

/** Drops dateline/byline scraps from the first few blocks of a body (before the first real paragraph). */
export function dropLeadingChrome(md: string): string {
  const bs = md.split(/\n{2,}/);
  let i = 0;
  while (i < bs.length && i < 6) {
    const b = bs[i].trim();
    if (b.length > 80 || !CHROME_LINES.some((re) => re.test(b))) break;
    i++;
  }
  return i ? bs.slice(i).join('\n\n') : md;
}

const tidy = (body: string) => dropLeadingChrome(dropJumpLinks(body));

/**
 * Body, extractor metadata and discussion from reader-mode Markdown, whichever format it is in.
 * Cheap and linear; call it once per article (memoize).
 */
export function parseReaderMarkdown(md: string): ParsedArticle {
  const serialized = parseSerialized(md);
  if (serialized) return { ...serialized, body: tidy(serialized.body) };
  const inline = splitInlineThread(md);
  if (inline) return { body: tidy(inline.body), meta: null, discussion: inline.discussion };
  return { body: tidy(md), meta: null, discussion: null };
}

// ---------------------------------------------------------------------------------------------
// Link-aggregator feeds (Hacker News, hnrss, Lobsters-style "Comments URL" boilerplate)

export type AggregatorInfo = {
  commentsUrl: string;
  comments: number | null;
  points: number | null;
  /** "Hacker News" for news.ycombinator.com, else the thread's host. */
  site: string;
};

const intOf = (s: string | undefined) => {
  if (!s) return null;
  const n = parseInt(s.replace(/[,.]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

/** The discussion thread a link-aggregator item points at ("Comments URL: …"), if any. */
export function aggregatorInfo(...texts: (string | null | undefined)[]): AggregatorInfo | null {
  for (const t of texts) {
    if (!t) continue;
    const url = /Comments URL:\s*(https?:\/\/\S+)/i.exec(t)?.[1];
    if (!url) continue;
    const host = /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(url)?.[1] ?? '';
    return {
      commentsUrl: url,
      comments: intOf(/#\s*Comments:\s*(\d[\d,]*)/i.exec(t)?.[1]),
      points: intOf(/Points:\s*(\d[\d,]*)/i.exec(t)?.[1]),
      site: /(^|\.)ycombinator\.com$/i.test(host) ? 'Hacker News' : /lobste\.rs$/i.test(host) ? 'Lobsters' : host,
    };
  }
  return null;
}
