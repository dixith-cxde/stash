/**
 * The end matter of a reader article, lifted out of its Markdown so the reader can show it as
 * UI instead of loose text: "Continue reading" / "Related" link lists (shown as cards), the
 * "Written by" line (an author chip) and "Tags: a, b" lines (tag chips). Pure: no React.
 */

/** A related article; `url` is null when the page listed it without a link (shown, not tappable). */
export type RelatedLink = { title: string; url: string | null; image: string | null; host: string | null; blurb: string | null };
export type ArticleTag = { label: string; url: string | null };
export type ArticleAuthor = { name: string; url: string | null; bio: string | null };
export type EndMatter = {
  body: string;
  related: { title: string; links: RelatedLink[] } | null;
  author: ArticleAuthor | null;
  tags: ArticleTag[];
};

const MAX_RELATED = 12;
const MAX_TAGS = 20;
/** Author and tag lines are looked for only among the last blocks of the body. */
const TAIL_BLOCKS = 10;

const RELATED_TITLE =
  /^(continue reading|keep reading|read (more|next|this next|also)|related( (articles?|posts?|stories|content|reading|links|news|coverage))?|more (from|on|in|about|stories|articles|posts|like this|to read|reading)\b.{0,40}|you (might|may) (also )?(like|enjoy|be interested in)|recommended( (for you|reading|articles|stories|posts))?|further reading|see also|up next|what to read next|popular( (posts|articles|stories|now))?|trending( (now|stories))?|most (read|popular)|other (posts|articles|stories))$/i;
const AUTHOR_HEADING = /^(about the (author|writer)|written by|the author|author)$/i;
const TAGS_HEADING = /^(tags?|topics?|categories|filed under|tagged)$/i;
const AUTHOR_LINE = /^(written by|posted by|published by|words by|story by|article by|by|author)\s*:?\s+(.+)$/i;
const TAGS_LINE = /^(tags?|tagged(?: with| as| in)?|topics?|filed (?:under|in)|categories|category|posted in|labels?)\s*:?\s*(.+)$/i;
const TAG_URL = /\/(tags?|topics?|category|categories|labels?|subjects?)\//i;

const IMAGE_LINK = /\[!\[([^\]]*)\]\(([^)\s]+)[^)]*\)\]\(([^)\s]+)[^)]*\)/g;
const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;
const LINK = /\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g;

/** Splits Markdown into blocks on blank lines, keeping fenced code blocks whole. */
export function mdBlocks(md: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let fence: string | null = null;
  for (const line of md.split('\n')) {
    const f = /^\s*(```+|~~~+)/.exec(line)?.[1];
    if (fence) {
      cur.push(line);
      if (f && f[0] === fence[0] && f.length >= fence.length) fence = null;
      continue;
    }
    if (f) fence = f;
    if (!line.trim() && !fence) {
      if (cur.length) out.push(cur.join('\n'));
      cur = [];
    } else cur.push(line);
  }
  if (cur.length) out.push(cur.join('\n'));
  return out;
}

/** Markdown to plain text: links keep their text, images go, emphasis and code marks go. */
export function plainText(md: string): string {
  return md
    .replace(IMAGE_LINK, '')
    .replace(IMAGE, '')
    .replace(LINK, '$1')
    .replace(/[*_`~]+/g, '')
    .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/\\([\\|[\]()*_`#])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const isHeading = (b: string) => /^#{1,6}\s/.test(b);
const headingLevel = (b: string) => /^(#{1,6})\s/.exec(b)?.[1].length ?? 0;
const isRule = (b: string) => /^\s*([-*_])(\s*\1){2,}\s*$/.test(b);
const isFence = (b: string) => /^\s*(```|~~~)/.test(b);

/** Heading text of a block that acts as a heading: a real `##` heading or a short bold/colon line. */
function headingOf(b: string): string | null {
  if (b.includes('\n') && !isHeading(b)) return null;
  const t = plainText(b).replace(/[:：]\s*$/, '').trim();
  if (!t || t.length > 60) return null;
  if (isHeading(b) || /^(\*\*|__)[^*_]+(\*\*|__):?$/.test(b.trim()) || /:\s*$/.test(b.trim())) return t;
  return null;
}

export function hostOfUrl(u: string): string | null {
  const m = /^https?:\/\/([^/?#:]+)/i.exec(u);
  return m ? m[1].replace(/^www\./i, '').toLowerCase() : null;
}

const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);

/** One related article from a list item or paragraph: its main link, image and any blurb. */
function relatedOf(md: string, pendingImage: string | null): RelatedLink | null {
  let image: string | null = null;
  const links: { text: string; url: string }[] = [];
  for (const m of md.matchAll(IMAGE_LINK)) {
    image ??= m[2];
    links.push({ text: plainText(m[1]), url: m[3] });
  }
  const rest = md.replace(IMAGE_LINK, ' ');
  for (const m of rest.matchAll(IMAGE)) image ??= m[2];
  for (const m of rest.replace(IMAGE, ' ').matchAll(LINK)) links.push({ text: plainText(m[1]), url: m[2] });
  const web = links.filter((l) => /^https?:\/\//i.test(l.url));
  const main = web.reduce<{ text: string; url: string } | null>((best, l) => (!best || l.text.length > best.text.length ? l : best), null);
  if (!main) return null;
  const title = main.text || hostOfUrl(main.url) || main.url;
  const all = plainText(md);
  const blurb = all.replace(title, '').replace(/^[\s\-–—:|·•]+|[\s\-–—:|·•]+$/g, '').trim();
  return { title: clip(title, 140), url: main.url, image: image ?? pendingImage, host: hostOfUrl(main.url), blurb: blurb.length >= 12 ? clip(blurb, 160) : null };
}

/** Items of a list block (each "- …" / "1. …" with its continuation lines). */
function listItems(b: string): string[] | null {
  if (!/^\s*([-*+]|\d+\.)\s/.test(b)) return null;
  const items: string[] = [];
  for (const line of b.split('\n')) {
    if (/^([-*+]|\d+\.)\s/.test(line)) items.push(line.replace(/^([-*+]|\d+\.)\s+/, ''));
    else if (items.length) items[items.length - 1] += `\n${line.trim()}`;
  }
  return items;
}

/** Emphasis around a whole line's opening word: "**Tags:** …", "*Written by …*". */
const unwrapLead = (b: string) => b.trim().replace(/^(\*\*|__|\*|_)(.+?)\1(?=\s|:|$)/, '$2').replace(/^(\*|_)(.+)\1$/, '$2');

/** An author or tags line, which ends a related-links section rather than joining it. */
const isByOrTags = (b: string) => {
  if (b.includes('\n')) return false;
  const line = unwrapLead(b);
  return TAGS_LINE.test(line) || (AUTHOR_LINE.test(line) && plainText(b).length <= 120) || isTagLinkRow(b);
};

/** Takes a related-links section (a matching heading, then link items) out of `blocks`. */
function takeRelated(blocks: string[]): EndMatter['related'] {
  for (let i = 1; i < blocks.length; i++) {
    const title = headingOf(blocks[i]);
    if (!title || !RELATED_TITLE.test(title)) continue;
    const links: RelatedLink[] = [];
    let pending: string | null = null;
    // Sections whose items are sub-headings ("### [Title](url)" + a category line).
    const sectionLevel = headingLevel(blocks[i]);
    let fromHeading = false;
    let end = i + 1;
    for (; end < blocks.length; end++) {
      const b = blocks[end];
      if (isHeading(b) && sectionLevel > 0 && headingLevel(b) > sectionLevel && !b.includes('\n')) {
        const t = plainText(b);
        const item = relatedOf(b, pending) ?? (t ? { title: clip(t, 140), url: null, image: pending, host: null, blurb: null } : null);
        pending = null;
        if (item) links.push(item);
        fromHeading = !!item;
        continue;
      }
      // The short line under a heading item (its section or date) is that item's blurb.
      if (fromHeading && !b.includes('\n') && plainText(b).length <= 80) {
        const last = links[links.length - 1];
        if (!last.blurb) last.blurb = plainText(b);
        fromHeading = false;
        continue;
      }
      fromHeading = false;
      if (isHeading(b) || isFence(b) || /^\|/.test(b) || isByOrTags(b)) break;
      if (isRule(b)) continue;
      const imageOnly = /^\s*!\[[^\]]*\]\([^)]*\)\s*$/.test(b);
      if (imageOnly) {
        pending = /\(([^)\s]+)/.exec(b)?.[1] ?? null;
        continue;
      }
      const parts = listItems(b) ?? b.split('\n');
      const found = parts.map((p) => relatedOf(p, null)).filter((x): x is RelatedLink => !!x);
      if (!found.length) {
        // A short line (date, source) under the last card is its blurb; prose ends the section.
        const t = plainText(b);
        if (links.length && t.length <= 140 && !links[links.length - 1].blurb) {
          links[links.length - 1].blurb = t;
          continue;
        }
        break;
      }
      // Prose with an inline link is article text, not a list of articles.
      if (!listItems(b) && plainText(b).length > 2.5 * found.reduce((n, l) => n + l.title.length, 0) + 60) break;
      if (pending && !found[0].image) found[0].image = pending;
      pending = null;
      links.push(...found);
    }
    const key = (l: RelatedLink) => l.url ?? l.title;
    const unique = links.filter((l, k) => links.findIndex((x) => key(x) === key(l)) === k).slice(0, MAX_RELATED);
    const nearEnd = i >= blocks.length * 0.6;
    if (unique.length >= 2 || (unique.length === 1 && nearEnd)) {
      blocks.splice(i, end - i);
      return { title, links: unique };
    }
  }
  return null;
}

/** "Jane Doe", "[Jane Doe](url)", "Jane Doe on March 3, 2024", "Jane Doe | Staff writer". */
function authorFrom(rest: string): ArticleAuthor | null {
  const link = /^\s*\[([^\]]+)\]\(([^)\s]+)[^)]*\)/.exec(rest);
  let name = plainText(link ? link[1] : rest)
    .split(/\s+(?:on|at|in|·|\||—|–)\s+|\s*[|·•—–]\s*|,\s*(?=\d)/)[0]
    .replace(/[.,;:]+$/, '')
    .trim();
  if (!name || name.length > 60 || name.split(/\s+/).length > 6 || /[.!?]\s/.test(name)) return null;
  name = name.replace(/^@/, '');
  // "By the way, …" is prose: a name starts with a capital letter (or is a link).
  if (!link && !/^\p{Lu}/u.test(name)) return null;
  return { name, url: link && /^https?:\/\//i.test(link[2]) ? link[2] : null, bio: null };
}

/** Tag chips from a "Tags: …" remainder or a list / paragraph of tag links. */
function tagsFrom(md: string): ArticleTag[] {
  const links = [...md.replace(IMAGE, ' ').matchAll(LINK)].map((m) => ({ label: plainText(m[1]), url: /^https?:\/\//i.test(m[2]) ? m[2] : null }));
  const raw = links.length
    ? links
    : plainText(md)
        .split(/\s*[,;·•|/]\s*|\s{2,}/)
        .map((label) => ({ label, url: null }));
  const seen = new Set<string>();
  return raw
    .map((t) => ({ ...t, label: t.label.replace(/^#/, '').trim() }))
    .filter((t) => t.label && t.label.length <= 40 && !seen.has(t.label.toLowerCase()) && (seen.add(t.label.toLowerCase()), true))
    .slice(0, MAX_TAGS);
}

/** A paragraph that is nothing but 2+ short links into tag/topic pages. */
function isTagLinkRow(b: string): boolean {
  const links = [...b.matchAll(LINK)];
  if (links.length < 2) return false;
  const leftover = b.replace(LINK, '').replace(/[\s,;·•|/#-]+/g, '');
  return !leftover && links.every((m) => TAG_URL.test(m[2]) && plainText(m[1]).split(/\s+/).length <= 4);
}

const sameName = (a: string, b: string) => a.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() === b.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * After the author is lifted out, the page often still has their name as a heading ("## Jane
 * Doe"), an avatar, or a short bio paragraph near the end. Drops the name and avatar; a short
 * paragraph that names them becomes the bio.
 */
function dropAuthorEchoes(blocks: string[], author: ArticleAuthor) {
  const first = author.name.split(/\s+/)[0] ?? author.name;
  const start = Math.max(0, blocks.length - TAIL_BLOCKS);
  for (let i = blocks.length - 1; i >= start; i--) {
    const b = blocks[i];
    const t = plainText(b);
    if ((isHeading(b) || headingOf(b)) && sameName(t.replace(/^(about|by|written by)\s+/i, ''), author.name)) {
      blocks.splice(i, 1);
      // Its avatar and bio usually sit right after it.
      if (/^\s*!\[[^\]]*\]\([^)]*\)\s*$/.test(blocks[i] ?? '')) blocks.splice(i, 1);
      const next = blocks[i];
      if (!author.bio && next && !isHeading(next) && plainText(next).length <= 500 && plainText(next).includes(first)) {
        author.bio = clip(plainText(next), 400);
        blocks.splice(i, 1);
      }
    }
  }
}

/** Splits the end matter off an article's Markdown body. */
export function splitEndMatter(md: string): EndMatter {
  const blocks = mdBlocks(md);
  const related = takeRelated(blocks);
  let author: ArticleAuthor | null = null;
  let tags: ArticleTag[] = [];

  const start = Math.max(1, blocks.length - TAIL_BLOCKS);
  for (let i = blocks.length - 1; i >= start; i--) {
    const b = blocks[i];
    if (isFence(b) || /^\|/.test(b)) continue;
    const heading = headingOf(b);
    if (heading && TAGS_HEADING.test(heading) && i + 1 < blocks.length && !tags.length) {
      const items = listItems(blocks[i + 1]);
      const found = tagsFrom(items ? items.join(', ') : blocks[i + 1]);
      if (found.length) {
        tags = found;
        blocks.splice(i, 2);
        continue;
      }
    }
    if (heading && AUTHOR_HEADING.test(heading) && i + 1 < blocks.length && !author) {
      const next = blocks[i + 1];
      const named = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)/.exec(next);
      const plain = plainText(next);
      const name = named ? plainText(named[1] ?? named[2]) : plain.length <= 60 ? plain : null;
      if (name) {
        const url = named?.[3] && /^https?:\/\//i.test(named[3]) ? named[3] : null;
        author = { name, url, bio: plain.length > name.length + 20 ? clip(plain, 400) : null };
        blocks.splice(i, 2);
        continue;
      }
    }
    if (b.includes('\n\n')) continue;
    const line = unwrapLead(b);
    const tagLine = TAGS_LINE.exec(line);
    if (tagLine && !tags.length) {
      const found = tagsFrom(tagLine[2]);
      if (found.length) {
        tags = found;
        blocks.splice(i, 1);
        continue;
      }
    }
    if (!tags.length && isTagLinkRow(b)) {
      tags = tagsFrom(b);
      blocks.splice(i, 1);
      continue;
    }
    const authorLine = AUTHOR_LINE.exec(line);
    if (authorLine && !author && plainText(b).length <= 120) {
      const found = authorFrom(authorLine[2]);
      if (found) {
        author = found;
        blocks.splice(i, 1);
      }
    }
  }

  if (author) dropAuthorEchoes(blocks, author);
  while (blocks.length && isRule(blocks[blocks.length - 1])) blocks.pop();
  return { body: blocks.join('\n\n'), related, author, tags };
}
