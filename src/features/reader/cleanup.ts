/**
 * Tidies a reader article's Markdown before it is shown: drops the byline, dates and "Share"
 * scraps the metadata card already shows, promo images, empty section headings and repeated
 * blocks. Also turns HTML that reached the reader unconverted into Markdown. Pure: no React.
 */
import { feedHtmlToMarkdown } from '@/features/feeds/extract';

import { mdBlocks, plainText } from './endmatter';

/** Headings of page-chrome sections near the top ("Story by:", "Published Date", "Share This:"). */
const META_HEADING =
  /^(story by|written by|posted by|published by|by|byline|authors?|about the author|published( (date|on|at))?|date( published)?|posted( on| at)?|updated( on| at)?|last updated|share( this( (article|story|post|page))?)?|share on|follow us|article content|in this article|listen to (this )?article|reading time|read time)$/i;
/** Headings that are chrome wherever they are (a share bar left as a heading). */
const ANYWHERE_HEADING = /^(share( this( (article|story|post|page))?)?|share on|follow us|article content|advertisement|sponsored)$/i;
const PROMO_ALT = /\b(support|subscribe|donate|donation|newsletter|advert|advertisement|sponsor|sign up|download (our|the) app)\b/i;

const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const DAY = '\\d{1,2}(st|nd|rd|th)?';
const DATE_ONLY = new RegExp(
  `^(((mon|tues|wednes|thurs|fri|satur|sun)day),?\\s+)?((${MONTH}\\s+${DAY},?\\s+\\d{4})|(${DAY}\\s+${MONTH},?\\s+\\d{4})|(\\d{4}-\\d{2}-\\d{2})|(\\d{1,2}[/.]\\d{1,2}[/.]\\d{2,4}))(\\s*(at\\s+)?\\d{1,2}:\\d{2}(\\s*[ap]\\.?m\\.?)?)?(\\s*\\w{2,4})?$`,
  'i',
);
const RELATIVE = /^(updated|published|posted)?:?\s*(\d+|an?)\s+(sec|second|min|minute|hour|hr|day|week|month)s?\s+ago$/i;
/** "By Jane Doe", "By Jane Doe and John Roe" (a byline, not a sentence starting with "By"). */
const BY_NAME = /^[Bb]y\s+(\p{Lu}[\p{L}.'’-]*)(\s+(\p{Lu}[\p{L}.'’-]*|and|&|de|van|von|da|del|le)){0,5}$/u;
const TIME_ONLY = /^(today|yesterday|updated|published|posted)?,?\s*\d{1,2}:\d{2}(\s*[ap]\.?m\.?)?$/i;
/** "Discuss (37 Comments)", "12 comments", "5 min read", "Share". */
const SCRAP = /^((discuss|comments?|join the discussion)\s*\(?\d*\s*(comments?)?\)?|\d+\s+comments?|\d+\s*min(ute)?s?\s+read|share|tweet|email|print|copy link)$/i;

const isHeading = (b: string) => /^#{1,6}\s/.test(b.trim());
const level = (b: string) => /^(#{1,6})\s/.exec(b.trim())?.[1].length ?? 0;
const headingText = (b: string) => plainText(b).replace(/[:：]\s*$/, '').trim();
const imageOnly = (b: string) => /^\s*(!\[[^\]]*\]\([^)]*\)\s*)+$/.test(b);
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** True when a block is only scraps: dates, times, "by", author names, comment counts. */
function isScrap(b: string, names: string[]): boolean {
  if (b.length > 240 || imageOnly(b)) return false;
  const lines = b
    .split('\n')
    .map((l) => l.replace(/^\s*[-*+]\s+/, ''))
    .flatMap((l) => plainText(l).split(/\s+[|·•]\s+|\s{2,}/))
    .map((l) => l.replace(/\s+-\s+\S+@\S+$/, '').trim())
    .filter(Boolean);
  if (!lines.length) return false;
  return lines.every((l) => {
    if (BY_NAME.test(l.replace(/[.,;:]+$/, '').trim())) return true;
    const t = l.replace(/^by:?\s*/i, '').replace(/[.,;:]+$/, '').trim();
    if (!t) return true;
    if (DATE_ONLY.test(t) || TIME_ONLY.test(t) || RELATIVE.test(t) || SCRAP.test(t)) return true;
    // "Today, 04:01 Discuss (37 Comments)": a time followed by a scrap.
    const m = /^((today|yesterday),?\s*)?\d{1,2}:\d{2}(\s*[ap]\.?m\.?)?\s+(.+)$/i.exec(t);
    if (m && SCRAP.test(m[4])) return true;
    const n = norm(t);
    return names.some((name) => n === name);
  });
}

/** Markup that is HTML rather than Markdown (a feed or page that skipped conversion). */
export function looksLikeHtml(s: string): boolean {
  const tags = s.match(/<\/?(p|div|br|span|a|img|h[1-6]|ul|ol|li|figure|section|article|strong|em|blockquote)\b[^>]*>/gi);
  return !!tags && tags.length >= 4 && tags.length * 40 > s.length / 20;
}

/** HTML is converted to Markdown; Markdown passes through. */
export function asMarkdown(s: string, base: string | null): string {
  if (!looksLikeHtml(s)) return s;
  return feedHtmlToMarkdown(s, base)?.markdown ?? s;
}

/**
 * Cleans an article body. `names` are author names the metadata card already shows; lines
 * that only repeat them (or a date, or "by") near the top are dropped.
 */
export function cleanArticle(md: string, names: (string | null | undefined)[] = []): string {
  return cleanArticleWithByline(md, names).body;
}

const BYLINE_HEADING = /^(story by|written by|posted by|published by|by|byline|authors?)$/i;

/** Like cleanArticle, and also returns the writer named in a dropped "Story by:" section. */
export function cleanArticleWithByline(md: string, names: (string | null | undefined)[] = []): { body: string; byline: string | null } {
  let byline: string | null = null;
  const who = names.filter((n): n is string => !!n && n.trim().length > 1).map(norm);
  let blocks = mdBlocks(md);

  // 1. The top: chrome sections and scraps, until the first real paragraph.
  const out: string[] = [];
  let top = true;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (top) {
      if (isHeading(b) && META_HEADING.test(headingText(b))) {
        // Its content too, when that is short (a name, a date, an empty share bar).
        const next = blocks[i + 1];
        if (next && !isHeading(next) && (next.length <= 240 || isScrap(next, who))) {
          if (!byline && BYLINE_HEADING.test(headingText(b))) {
            const name = plainText(next.split('\n')[0].replace(/^\s*[-*+]\s+/, '')).split(/\s+[-–—|·]\s+|,\s*/)[0].trim();
            if (name && name.length <= 60 && name.split(/\s+/).length <= 6) byline = name;
          }
          i++;
        }
        continue;
      }
      if (isScrap(b, who)) {
        const by = /^by\s+([^|·•\n]+)/i.exec(plainText(b.split('\n')[0]));
        if (!byline && by && BY_NAME.test(`By ${by[1].trim()}`)) byline = by[1].trim();
        continue;
      }
      if (imageOnly(b) && PROMO_ALT.test(b)) continue;
      if (!isHeading(b) && !imageOnly(b) && plainText(b).length >= 160) top = false;
    } else if (imageOnly(b) && PROMO_ALT.test(b)) continue;
    out.push(b);
  }
  blocks = out;

  // 2. Anywhere: share-bar headings, and headings with nothing under them.
  blocks = blocks.filter((b, i) => {
    if (!isHeading(b)) return true;
    if (ANYWHERE_HEADING.test(headingText(b))) return false;
    const next = blocks[i + 1];
    return !!next && (!isHeading(next) || level(next) > level(b));
  });

  // 3. The same block twice in a row (pages that print the byline or a caption twice).
  blocks = blocks.filter((b, i) => {
    if (i === 0) return true;
    const prev = blocks[i - 1];
    if (imageOnly(b) || imageOnly(prev)) return b.trim() !== prev.trim();
    return norm(plainText(b)) !== norm(plainText(prev));
  });

  return { body: blocks.join('\n\n'), byline };
}
