/** Pure helpers shared by the Stash screens (no React, unit-testable). */
import type { BookmarkWithTags, HighlightWithTags } from '@/db/repo';
import type { BookmarkType, Folder } from '@/db/schema';
import { hostOf } from '@/features/capture/normalize';
import { fileGlyph, fileLabel, headLines, markdownPlain, textFileKind } from '@/features/files/kinds';
import { linkKind, linkKindLabel } from '@/features/links/linkKind';
import { youtubeId } from '@/features/preview/parseMeta';
import type { MaterialShapeName } from '@/shapes/names';
import type { IconName } from '@/theme/icons';
import { COLLECTION_SEEDS } from '@/theme/palette';

/**
 * How a bookmark is drawn: links to YouTube get the video card, text bookmarks are notes,
 * saved Markdown / text files get the text-file card and open in the in-app viewer.
 */
export type CardKind = 'link' | 'video' | 'pdf' | 'note' | 'image' | 'file' | 'markdown' | 'textfile';

type KindFields = Pick<BookmarkWithTags, 'type' | 'url'> & Partial<Pick<BookmarkWithTags, 'mimeType' | 'filePath' | 'title'>>;

export function cardKind(b: KindFields): CardKind {
  if (b.type === 'link') return b.url && youtubeId(b.url) ? 'video' : 'link';
  // Files: a text file shared by older builds was stored as type "text" with a file.
  if (b.type === 'file' || (b.type === 'text' && b.filePath)) {
    const t = textFileKind(b);
    if (t === 'markdown') return 'markdown';
    if (t === 'text') return 'textfile';
    return b.type === 'text' ? 'note' : 'file';
  }
  if (b.type === 'text') return 'note';
  return b.type;
}

/** True for kinds the in-app file viewer (`/file/[id]`) shows. */
export const isTextFileKind = (k: CardKind) => k === 'markdown' || k === 'textfile';

/** Label for what an item is beyond its type: "App · Play Store", "Repo · a/b", "Markdown", ".csv". */
export function kindLabel(b: KindFields): string | null {
  const k = cardKind(b);
  if (k === 'link') return linkKindLabel(linkKind(b.url));
  if (k === 'markdown' || k === 'textfile' || k === 'file') return fileLabel(b);
  return null;
}

/**
 * The main action on the item page, by what the item is. Saved links are resources (apps,
 * videos, repos, tools, pages), not all articles, so a link only says "Read" when we know it
 * is an article (saved from Feeds, or it has a word count); otherwise it says "Open".
 */
export function openAction(b: KindFields & Partial<Pick<BookmarkWithTags, 'wordCount' | 'sourceApp'>>): { label: string; icon: IconName } {
  // Saved from Feeds: an article, opened in the in-app reader.
  if (b.sourceApp === 'Feeds' && cardKind(b) === 'link') return { label: 'Read', icon: 'menuBook' };
  switch (cardKind(b)) {
    case 'video':
      return { label: 'Watch', icon: 'playArrowFill' };
    case 'pdf':
      return { label: 'Open PDF', icon: 'pictureAsPdf' };
    case 'image':
      return { label: 'View image', icon: 'image' };
    case 'note':
      return { label: 'Open note', icon: 'stickyNote2' };
    case 'markdown':
      return { label: 'Read', icon: 'menuBook' };
    case 'textfile':
    case 'file':
      return { label: 'Open file', icon: 'description' };
    case 'link':
      switch (linkKind(b.url).kind) {
        case 'app':
          return { label: 'Get app', icon: 'apps' };
        case 'repo':
          return { label: 'Open repo', icon: 'code' };
        case 'package':
          return { label: 'Open package', icon: 'category' };
        case 'docs':
          return { label: 'Open docs', icon: 'menuBook' };
        case 'video':
          return { label: 'Watch', icon: 'playArrowFill' };
        default:
          return b.wordCount ? { label: 'Read', icon: 'menuBook' } : { label: 'Open', icon: 'openInNew' };
      }
  }
}

/** Icon matching `kindLabel` (null: none, the card has its own artwork). */
export function kindIcon(b: KindFields): IconName | null {
  const k = cardKind(b);
  if (k === 'link') {
    switch (linkKind(b.url).kind) {
      case 'app':
        return 'apps';
      case 'repo':
        return 'code';
      case 'package':
        return 'category';
      case 'docs':
        return 'menuBook';
      default:
        return null;
    }
  }
  if (k === 'markdown') return 'markdown';
  if (k === 'textfile') {
    const label = fileLabel(b);
    if (label === '.csv' || label === '.tsv') return 'tableChart';
    if (label === 'Text' || label === '.log') return 'textSnippet';
    return 'dataObject';
  }
  if (k === 'file') return 'description';
  return null;
}

/** A few lines of a saved text file's excerpt (Markdown flattened to plain text). */
export function filePreview(b: KindFields & Pick<BookmarkWithTags, 'content'>, lines = 4): string {
  const text = b.content ?? '';
  if (!text) return '';
  return cardKind(b) === 'markdown' ? markdownPlain(text, lines * 60) : headLines(text, lines, 80);
}

export type FeedItem =
  | { kind: 'bookmark'; key: string; at: number; item: BookmarkWithTags; highlightCount: number }
  | { kind: 'highlight'; key: string; at: number; highlight: HighlightWithTags };

/** Newest first, bookmarks and highlights interleaved. */
export function mergeFeed(
  items: BookmarkWithTags[],
  highlights: HighlightWithTags[],
  counts: Map<string, number>,
): FeedItem[] {
  const out: FeedItem[] = [
    ...items.map<FeedItem>((item) => ({
      kind: 'bookmark',
      key: `b:${item.id}`,
      at: item.createdAt.getTime(),
      item,
      highlightCount: counts.get(item.id) ?? 0,
    })),
    ...highlights.map<FeedItem>((highlight) => ({
      kind: 'highlight',
      key: `h:${highlight.id}`,
      at: highlight.createdAt.getTime(),
      highlight,
    })),
  ];
  return out.sort((a, b) => b.at - a.at);
}

/** Home / Collection type filters. */
export type FeedFilter = 'all' | 'links' | 'pdfs' | 'notes' | 'quotes';

export function matchesFilter(f: FeedItem, filter: FeedFilter): boolean {
  if (filter === 'all') return true;
  if (f.kind === 'highlight') return filter === 'quotes';
  const k = cardKind(f.item);
  if (filter === 'links') return k === 'link' || k === 'video';
  if (filter === 'pdfs') return k === 'pdf';
  if (filter === 'notes') return k === 'note';
  return false;
}

/** Rough rendered height of a feed card, used to balance the two masonry columns. */
export function estimateHeight(f: FeedItem): number {
  if (f.kind === 'highlight') return 110 + Math.min(4, Math.ceil(f.highlight.text.length / 32)) * 24;
  switch (cardKind(f.item)) {
    case 'pdf':
      return 176 + 100;
    case 'video':
      return 112 + 84;
    case 'note': {
      const tasks = taskStats(f.item.content ?? '').total;
      return 100 + Math.min(3, tasks) * 24 + 30;
    }
    case 'image':
      return 160 + 70;
    case 'markdown':
    case 'textfile':
      return 74 + 4 * 18 + 40;
    default:
      return 132 + 110 + (kindLabel(f.item) ? 24 : 0);
  }
}

/** Splits items into two columns, each item going to the currently shorter one. */
export function masonry<T>(items: T[], height: (t: T) => number): [T[], T[]] {
  const cols: [T[], T[]] = [[], []];
  const h = [0, 0];
  for (const it of items) {
    const c = h[0] <= h[1] ? 0 : 1;
    cols[c].push(it);
    h[c] += height(it) + 8;
  }
  return cols;
}

// --- Colors ----------------------------------------------------------------------------------

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stable seed from the design palette for anything without its own color. */
export const seedFor = (key: string) => COLLECTION_SEEDS[hash(key) % COLLECTION_SEEDS.length];

export const folderSeed = (f: Pick<Folder, 'id' | 'color'>) => f.color ?? seedFor(f.id);

export const hostSeed = (url: string | null | undefined) => seedFor(url ? hostOf(url) : 'note');

/** Icons offered for collections (design: book, bookmark, layers, fork & knife, pin, play…). */
export const COLLECTION_ICONS: IconName[] = [
  'menuBook', 'bookmark', 'layers', 'restaurant', 'locationOn', 'playArrowFill', 'folder', 'palette',
  'autoAwesome', 'stickyNote2', 'public', 'label',
];

export const folderIcon = (f: Pick<Folder, 'icon'>): IconName =>
  (f.icon && (COLLECTION_ICONS as string[]).includes(f.icon) ? f.icon : 'folder') as IconName;

/** Card decorations alternate between these two shapes, as in the design. */
export const DECOR_SHAPES: MaterialShapeName[] = ['cookie9Sided', 'clover4Leaf'];

// --- Text ------------------------------------------------------------------------------------

/** "theverge.com", "YouTube", "Markdown", ".csv", or the source app for other files. */
export function sourceLabel(b: Pick<BookmarkWithTags, 'url' | 'siteName' | 'type' | 'sourceApp'> & Partial<Pick<BookmarkWithTags, 'mimeType' | 'filePath' | 'title'>>): string {
  if (b.url) return youtubeId(b.url) ? 'YouTube' : hostOf(b.url);
  if (b.type === 'pdf') return 'PDF';
  const k = cardKind(b);
  if (k === 'markdown' || k === 'textfile') return fileLabel(b);
  if (b.type === 'text') return 'Note';
  return b.sourceApp ?? fileLabel(b);
}

/** Two-letter-ish glyph for an item without artwork ("V" for The Verge, "PDF", "MD", "CSV"). */
export function glyphFor(b: Pick<BookmarkWithTags, 'url' | 'siteName' | 'type' | 'title'> & Partial<Pick<BookmarkWithTags, 'mimeType' | 'filePath'>>): string {
  if (b.type === 'pdf') return 'PDF';
  const k = cardKind(b);
  if (k === 'markdown' || k === 'textfile' || k === 'file') return fileGlyph(b);
  if (b.type === 'text') return 'MD';
  const name = b.siteName || (b.url ? hostOf(b.url) : b.title) || '?';
  return name.replace(/^the\s+/i, '').charAt(0).toUpperCase();
}

export function readingMinutes(words: number | null | undefined): number | null {
  if (!words) return null;
  return Math.max(1, Math.round(words / 230));
}

export function formatDuration(sec: number | null | undefined): string | null {
  if (!sec) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

// --- Markdown notes --------------------------------------------------------------------------

const TASK_RE = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;

export type Task = { line: number; done: boolean; text: string };

export function tasksIn(md: string): Task[] {
  const out: Task[] = [];
  md.split('\n').forEach((l, line) => {
    const m = TASK_RE.exec(l);
    if (m) out.push({ line, done: m[1] !== ' ', text: m[2].trim() });
  });
  return out;
}

export function taskStats(md: string) {
  const t = tasksIn(md);
  return { total: t.length, done: t.filter((x) => x.done).length };
}

/** Flips the checkbox on one source line, keeping everything else byte-for-byte. */
export function toggleTask(md: string, line: number): string {
  const lines = md.split('\n');
  lines[line] = lines[line].replace(/\[([ xX])\]/, (_, c: string) => (c === ' ' ? '[x]' : '[ ]'));
  return lines.join('\n');
}

export function wordCount(md: string): number {
  const plain = md.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`[\]()-]/g, ' ');
  return plain.split(/\s+/).filter(Boolean).length;
}

/** `[[Saved item title]]` references in a note. */
export function wikiLinks(md: string): string[] {
  return [...md.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim());
}

export const TYPE_COUNT_LABEL: Record<BookmarkType, [string, string]> = {
  link: ['link', 'links'],
  pdf: ['PDF', 'PDFs'],
  text: ['note', 'notes'],
  image: ['image', 'images'],
  file: ['file', 'files'],
};

// --- Reading queue ---------------------------------------------------------------------------

export type QueueEntry = { item: BookmarkWithTags; progress: number | null };

/**
 * Home's "Continue reading" row: PDFs you are part-way through (most recently read first),
 * then unread things meant for reading (PDFs, articles saved from Feeds, Markdown, long
 * links), newest first. Apps, repos, videos and notes are not reading, so they stay out.
 */
export function readingQueue(items: BookmarkWithTags[], max = 8): QueueEntry[] {
  const live = items.filter((b) => !b.isArchived);
  const started = live
    .filter((b) => b.type === 'pdf' && b.pageCount && b.lastPage && b.lastPage > 1 && b.lastPage < b.pageCount)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((b) => ({ item: b, progress: b.lastPage! / b.pageCount! }));
  const seen = new Set(started.map((e) => e.item.id));
  const unread = live
    .filter((b) => !seen.has(b.id) && !b.readAt)
    .filter((b) => {
      const k = cardKind(b);
      if (k === 'pdf' || k === 'markdown') return true;
      if (k !== 'link') return false;
      return b.sourceApp === 'Feeds' || !!b.wordCount || linkKind(b.url).kind === 'docs';
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((b) => ({ item: b, progress: null }));
  return [...started, ...unread].slice(0, max);
}

// --- Highlights export -----------------------------------------------------------------------

/** An item's highlights as Markdown: title, link, then each quote with its page. */
export function highlightsMarkdown(
  b: Pick<BookmarkWithTags, 'title' | 'url' | 'type'>,
  hls: Pick<HighlightWithTags, 'text' | 'page' | 'note'>[],
): string {
  const unit = b.type === 'pdf' ? 'p.' : '¶';
  const out = [`# ${b.title || 'Highlights'}`];
  if (b.url) out.push(b.url);
  for (const h of hls) {
    const quote = h.text
      .trim()
      .split('\n')
      .map((l) => `> ${l}`)
      .join('\n');
    out.push(h.page ? `${quote}\n>\n> — ${unit} ${h.page}` : quote);
    if (h.note) out.push(`Note: ${h.note}`);
  }
  return `${out.join('\n\n')}\n`;
}
