import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { db } from '@/db/client';
import {
  createBookmark,
  createFolder,
  ensureTag,
  findBookmarkByUrl,
  folderTree,
  queryBookmarks,
} from '@/db/repo';
import {
  bookmarks,
  bookmarkTags,
  folders,
  highlights,
  highlightTags,
  listItems,
  lists,
  tags,
} from '@/db/schema';
import { processPreviewQueue } from '@/features/preview/fetchPreview';

import { parseNetscapeBookmarks, toNetscapeHtml } from './netscape';

const BACKUP_VERSION = 1;

async function shareTextFile(name: string, mimeType: string, contents: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Full JSON backup of every table (files themselves are not included). */
export async function exportJson() {
  const data = {
    app: 'stash',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    folders: await db.select().from(folders),
    bookmarks: await db.select().from(bookmarks),
    tags: await db.select().from(tags),
    bookmarkTags: await db.select().from(bookmarkTags),
    lists: await db.select().from(lists),
    listItems: await db.select().from(listItems),
    highlights: await db.select().from(highlights),
    highlightTags: await db.select().from(highlightTags),
  };
  await shareTextFile(`stash-backup-${stamp()}.json`, 'application/json', JSON.stringify(data));
}

export async function exportHtml() {
  const tree = await folderTree();
  const names = new Map(tree.map((f) => [f.id, f.path]));
  const items = (await queryBookmarks({}, 100_000)).filter((b) => b.url);
  const html = toNetscapeHtml(
    items.map((b) => ({
      url: b.url!,
      title: b.title,
      createdAt: b.createdAt,
      tags: b.tags.map((t) => t.name),
      folder: b.folderId ? names.get(b.folderId) : null,
      description: b.note ?? b.description,
    })),
  );
  await shareTextFile(`stash-bookmarks-${stamp()}.html`, 'text/html', html);
}

type Revive<T> = { [K in keyof T]: T[K] extends Date | null ? string | number | null : T[K] };
const reviveDates = <T extends Record<string, unknown>>(row: Revive<T>): T => {
  const out: Record<string, unknown> = { ...row };
  for (const k of ['createdAt', 'updatedAt', 'readAt', 'addedAt']) {
    if (out[k] != null) out[k] = new Date(out[k] as string);
  }
  return out as T;
};

async function importJson(text: string) {
  const data = JSON.parse(text);
  if (data?.app !== 'stash') throw new Error('Not a Stash backup');
  let added = 0;
  await db.transaction(async (tx) => {
    const insert = async (table: Parameters<typeof tx.insert>[0], rows: Record<string, unknown>[] | undefined) => {
      if (!rows?.length) return;
      for (let i = 0; i < rows.length; i += 200) {
        await tx
          .insert(table)
          .values(rows.slice(i, i + 200).map((r) => reviveDates(r)) as never)
          .onConflictDoNothing();
      }
    };
    // Parents before children so foreign keys resolve.
    const sortedFolders = [...(data.folders ?? [])].sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0));
    await insert(folders, sortedFolders);
    await insert(tags, data.tags);
    await insert(lists, data.lists);
    await insert(bookmarks, data.bookmarks);
    await insert(bookmarkTags, data.bookmarkTags);
    await insert(listItems, data.listItems);
    await insert(highlights, data.highlights);
    await insert(highlightTags, data.highlightTags);
    added = data.bookmarks?.length ?? 0;
  });
  return added;
}

async function importHtml(text: string) {
  const items = parseNetscapeBookmarks(text);
  const folderIds = new Map<string, string>();
  const folderFor = async (path: string[]) => {
    let parentId: string | null = null;
    for (let i = 0; i < path.length; i++) {
      const key = path.slice(0, i + 1).join('/');
      let id = folderIds.get(key);
      if (!id) {
        id = await createFolder({ name: path[i], parentId });
        folderIds.set(key, id);
      }
      parentId = id;
    }
    return parentId;
  };
  let added = 0;
  for (const it of items) {
    if (await findBookmarkByUrl(it.url)) continue;
    const tagIds = [];
    for (const t of it.tags) tagIds.push(await ensureTag(t));
    await createBookmark({
      type: 'link',
      url: it.url,
      title: it.title,
      description: it.description,
      folderId: it.folderPath.length ? await folderFor(it.folderPath) : null,
      createdAt: it.addedAt,
      fetchStatus: 'pending',
      tagIds,
    });
    added++;
  }
  void processPreviewQueue();
  return added;
}

/** Imports a Stash JSON backup or any Netscape bookmarks HTML file. Returns items added. */
export async function importBackup(): Promise<number | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/html', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const text = await new File(res.assets[0].uri).text();
  return text.trimStart().startsWith('{') ? importJson(text) : importHtml(text);
}
