/** Pure helpers shared by the Stash screens (no React, unit-testable). */
import type { BookmarkWithTags, HighlightWithTags } from '@/db/repo';
import type { BookmarkType, Folder } from '@/db/schema';
import { hostOf } from '@/features/capture/normalize';
import { youtubeId } from '@/features/preview/parseMeta';
import type { MaterialShapeName } from '@/shapes/names';
import type { IconName } from '@/theme/icons';
import { COLLECTION_SEEDS } from '@/theme/palette';

/** How a bookmark is drawn: links to YouTube get the video card, text bookmarks are notes. */
export type CardKind = 'link' | 'video' | 'pdf' | 'note' | 'image' | 'file';

export function cardKind(b: Pick<BookmarkWithTags, 'type' | 'url'>): CardKind {
  if (b.type === 'link') return b.url && youtubeId(b.url) ? 'video' : 'link';
  if (b.type === 'text') return 'note';
  return b.type;
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
    default:
      return 132 + 110;
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

/** "theverge.com", "YouTube", or the source app for files. */
export function sourceLabel(b: Pick<BookmarkWithTags, 'url' | 'siteName' | 'type' | 'sourceApp'>): string {
  if (b.url) return youtubeId(b.url) ? 'YouTube' : hostOf(b.url);
  if (b.type === 'pdf') return 'PDF';
  if (b.type === 'text') return 'Note';
  return b.sourceApp ?? 'File';
}

/** Two-letter-ish glyph for an item without artwork ("V" for The Verge, "PDF", "MD"). */
export function glyphFor(b: Pick<BookmarkWithTags, 'url' | 'siteName' | 'type' | 'title'>): string {
  if (b.type === 'pdf') return 'PDF';
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
