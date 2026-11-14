import { newId } from '@/db/client';
import {
  createBookmark,
  createHighlight,
  findDuplicate,
  updateBookmark,
} from '@/db/repo';
import { importFile, makePdfThumbnail, readTextExcerpt } from '@/features/files/storage';
import { processPreviewQueue } from '@/features/preview/fetchPreview';

import { type CaptureDraft, textKindForFile } from './normalize';

export type SaveOptions = { folderId?: string | null; tagIds?: string[]; note?: string };
/** `duplicate`: the link was already saved (`savedAt`); that item was reused, nothing new was created. */
export type SaveResult = { kind: 'bookmark' | 'highlight'; id: string; duplicate?: boolean; savedAt?: Date };

/** Persist one capture draft (copying files and kicking off preview fetching). */
export async function saveDraft(draft: CaptureDraft, opts: SaveOptions = {}): Promise<SaveResult> {
  if (draft.kind === 'highlight') {
    const id = await createHighlight({
      text: draft.text,
      sourceApp: draft.sourceApp,
      sourceUrl: draft.sourceUrl,
      note: opts.note,
      tagIds: opts.tagIds,
    });
    return { kind: 'highlight', id };
  }

  if (draft.type === 'link' && draft.url) {
    const existing = await findDuplicate(draft.url);
    if (existing) {
      await updateBookmark(existing.id, {
        isArchived: false,
        ...(opts.folderId !== undefined ? { folderId: opts.folderId } : {}),
      });
      return { kind: 'bookmark', id: existing.id, duplicate: true, savedAt: existing.createdAt };
    }
  }

  const id = newId();
  let filePath: string | undefined;
  let fileSize: number | undefined;
  let thumbPath: string | undefined;
  let pageCount: number | undefined;
  let content = draft.content;

  if (draft.file) {
    const copied = importFile(draft.file.path, id, draft.file.fileName, draft.file.mimeType);
    filePath = copied.uri;
    fileSize = copied.size ?? draft.file.size ?? undefined;
    if (draft.type === 'pdf') {
      const thumb = await makePdfThumbnail(copied.uri, id);
      thumbPath = thumb?.uri;
      pageCount = thumb?.pageCount;
    }
    if (draft.type === 'image') thumbPath = copied.uri;
    // Markdown / text files: keep the opening as an excerpt for cards, previews and search.
    if (!content && textKindForFile(draft.file)) content = (await readTextExcerpt(copied.uri)) ?? undefined;
  }

  // createBookmark generates its own id; keep ours so file names match the row.
  await createBookmark({
    type: draft.type,
    title: draft.title,
    url: draft.url,
    content,
    note: opts.note,
    filePath,
    fileSize,
    thumbPath,
    pageCount,
    mimeType: draft.file?.mimeType ?? undefined,
    sourceApp: draft.sourceApp,
    folderId: opts.folderId ?? null,
    fetchStatus: draft.type === 'link' ? 'pending' : 'done',
    tagIds: opts.tagIds,
    idOverride: id,
  });

  if (draft.type === 'link') void processPreviewQueue();
  return { kind: 'bookmark', id };
}
