import { newId } from '@/db/client';
import {
  createBookmark,
  createHighlight,
  findDuplicate,
  updateBookmark,
} from '@/db/repo';
import { importFile, makePdfThumbnail } from '@/features/files/storage';
import { processPreviewQueue } from '@/features/preview/fetchPreview';

import type { CaptureDraft } from './normalize';

export type SaveOptions = { folderId?: string | null; tagIds?: string[]; note?: string };
export type SaveResult = { kind: 'bookmark' | 'highlight'; id: string; duplicate?: boolean };

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
      return { kind: 'bookmark', id: existing.id, duplicate: true };
    }
  }

  const id = newId();
  let filePath: string | undefined;
  let fileSize: number | undefined;
  let thumbPath: string | undefined;

  if (draft.file) {
    const copied = importFile(draft.file.path, id, draft.file.fileName, draft.file.mimeType);
    filePath = copied.uri;
    fileSize = copied.size ?? draft.file.size ?? undefined;
    if (draft.type === 'pdf') thumbPath = (await makePdfThumbnail(copied.uri, id))?.uri;
    if (draft.type === 'image') thumbPath = copied.uri;
  }

  // createBookmark generates its own id; keep ours so file names match the row.
  await createBookmark({
    type: draft.type,
    title: draft.title,
    url: draft.url,
    content: draft.content,
    note: opts.note,
    filePath,
    fileSize,
    thumbPath,
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
