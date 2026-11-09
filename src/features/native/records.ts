import type { BookmarkWithTags, HighlightWithTags } from '@/db/repo';
import { hostOf } from '@/features/capture/normalize';
import { fileSize, plural, relativeTime } from '@/lib/format';

import type { CardKind, CardRecord, HighlightRecord } from '../../../modules/expressive';

/** Display-ready rows for the native Compose screens (modules/expressive/.../stash). */

const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv|dailymotion\.com)$/;

export function shortTime(date: Date, now = Date.now()): string {
  return relativeTime(date, now).replace(/ ago$/, '');
}

function excerpt(text: string | null | undefined, max = 240): string {
  if (!text) return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function cardKind(item: Pick<BookmarkWithTags, 'type' | 'url'>): CardKind {
  if (item.type === 'link' && item.url && VIDEO_HOSTS.test(hostOf(item.url))) return 'video';
  return item.type;
}

export function coverOf(item: Pick<BookmarkWithTags, 'type' | 'imageUrl' | 'thumbPath' | 'filePath'>): string | null {
  if (item.type === 'image') return item.thumbPath ?? item.filePath;
  if (item.type === 'pdf') return item.thumbPath;
  return item.imageUrl;
}

export function bookmarkCard(item: BookmarkWithTags, highlightCount = 0, now = Date.now()): CardRecord {
  const host = item.url ? hostOf(item.url) : '';
  const kind = cardKind(item);
  const time = shortTime(item.createdAt, now);
  const size = fileSize(item.fileSize);
  let meta = time;
  if (item.type === 'pdf') {
    meta = [item.readAt ? null : 'Unread', highlightCount ? plural(highlightCount, 'highlight') : null, time]
      .filter(Boolean)
      .join(' · ');
  }
  return {
    id: item.id,
    kind,
    title: item.title,
    body: excerpt(item.type === 'text' ? item.content : item.description),
    site: item.siteName ?? host,
    seed: host || item.title,
    meta,
    cover: coverOf(item),
    favicon: item.favicon,
    badge: item.type === 'pdf' ? ['PDF', size].filter(Boolean).join(' · ') : item.type === 'file' ? size : null,
    tags: item.tags.map((t) => t.name),
    unread: !item.readAt && (item.type === 'link' || item.type === 'pdf'),
    favorite: item.isFavorite,
  };
}

export function highlightCard(h: HighlightWithTags): CardRecord {
  const source = h.bookmarkTitle ?? h.sourceTitle ?? (h.sourceUrl ? hostOf(h.sourceUrl) : (h.sourceApp ?? ''));
  return {
    id: h.id,
    kind: 'highlight',
    title: '',
    body: h.text,
    site: source,
    seed: source,
    color: h.color,
    tags: h.tags.map((t) => t.name),
  };
}

export function highlightRecord(h: HighlightWithTags): HighlightRecord {
  return {
    id: h.id,
    text: h.text,
    note: h.note,
    color: h.color,
    meta: [h.page != null ? `Page ${h.page + 1}` : null, shortTime(h.createdAt)].filter(Boolean).join(' · '),
  };
}

/** Bookmarks and highlights interleaved newest-first, as one feed. */
export function mergeFeed(
  items: BookmarkWithTags[],
  highlights: HighlightWithTags[],
  counts: Map<string, number> = new Map(),
  now = Date.now(),
): CardRecord[] {
  const rows: { at: number; card: CardRecord }[] = [
    ...items.map((b) => ({ at: b.createdAt.getTime(), card: bookmarkCard(b, counts.get(b.id) ?? 0, now) })),
    ...highlights.map((h) => ({ at: h.createdAt.getTime(), card: highlightCard(h) })),
  ];
  return rows.sort((a, b) => b.at - a.at).map((r) => r.card);
}
