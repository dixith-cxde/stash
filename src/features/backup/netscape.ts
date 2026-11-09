import { decodeEntities } from '@/features/preview/parseMeta';

export type ImportedBookmark = {
  url: string;
  title: string;
  addedAt?: Date;
  tags: string[];
  /** Folder path from the root, e.g. ["Work", "Research"]. */
  folderPath: string[];
  description?: string;
};

/**
 * Parses the Netscape bookmark file format exported by Chrome, Firefox, Safari, Raindrop,
 * Pocket, Pinboard, Omnivore and most read-later apps.
 */
export function parseNetscapeBookmarks(html: string): ImportedBookmark[] {
  const out: ImportedBookmark[] = [];
  const folderStack: string[] = [];
  let pendingFolder: string | null = null;
  let last: ImportedBookmark | null = null;

  const token = /<h3\b[^>]*>([\s\S]*?)<\/h3>|<dl\b[^>]*>|<\/dl>|<a\b([^>]*)>([\s\S]*?)<\/a>|<dd>([^<]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = token.exec(html))) {
    const [whole, folderName, attrs, linkText, dd] = m;
    const tag = whole.slice(0, 4).toLowerCase();
    if (folderName !== undefined) {
      pendingFolder = decodeEntities(folderName.replace(/<[^>]+>/g, '').trim());
    } else if (tag.startsWith('<dl')) {
      if (pendingFolder !== null) folderStack.push(pendingFolder);
      else folderStack.push(''); // root <DL>
      pendingFolder = null;
    } else if (tag === '</dl') {
      folderStack.pop();
    } else if (attrs !== undefined) {
      const attr = (name: string) => attrs.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1];
      const href = attr('href');
      if (!href || !/^https?:/i.test(href)) {
        last = null;
        continue;
      }
      const added = Number(attr('add_date'));
      last = {
        url: decodeEntities(href),
        title: decodeEntities(linkText.replace(/<[^>]+>/g, '').trim()) || href,
        addedAt: Number.isFinite(added) && added > 0 ? new Date(added * (added > 1e11 ? 1 : 1000)) : undefined,
        tags: (attr('tags') ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        folderPath: folderStack.filter(Boolean),
      };
      out.push(last);
    } else if (dd !== undefined && last) {
      const text = decodeEntities(dd.trim());
      if (text) last.description = text;
    }
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toNetscapeHtml(
  items: { url: string; title: string; createdAt: Date; tags: string[]; folder?: string | null; description?: string | null }[],
): string {
  const byFolder = new Map<string, typeof items>();
  for (const i of items) {
    const key = i.folder ?? '';
    byFolder.set(key, [...(byFolder.get(key) ?? []), i]);
  }
  const link = (i: (typeof items)[number]) =>
    `<DT><A HREF="${esc(i.url)}" ADD_DATE="${Math.floor(i.createdAt.getTime() / 1000)}"${
      i.tags.length ? ` TAGS="${esc(i.tags.join(','))}"` : ''
    }>${esc(i.title)}</A>${i.description ? `\n<DD>${esc(i.description)}` : ''}`;
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Stash bookmarks</TITLE>',
    '<H1>Stash bookmarks</H1>',
    '<DL><p>',
  ];
  for (const [folder, list] of byFolder) {
    if (folder) lines.push(`<DT><H3>${esc(folder)}</H3>`, '<DL><p>', ...list.map(link), '</DL><p>');
    else lines.push(...list.map(link));
  }
  lines.push('</DL><p>');
  return lines.join('\n');
}
