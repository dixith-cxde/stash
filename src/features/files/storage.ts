import { Directory, File, Paths } from 'expo-file-system';

import { ExpressiveModule } from '../../../modules/expressive';
import { extForMime } from './kinds';
import { EXCERPT_MAX_BYTES, readTextHead } from './read';
import { devWarn } from '@/lib/log';

const filesDir = () => {
  const dir = new Directory(Paths.document, 'files');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

const thumbsDir = () => {
  const dir = new Directory(Paths.document, 'thumbs');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

/**
 * True for a file:// URI inside Stash's own files/ or thumbs/ folders. Paths come from the
 * database, which a backup import can fill; deleting or sharing must never reach anything
 * else in app storage (the SQLite database, settings).
 */
export function isOwnFile(uri: string | null | undefined): uri is string {
  if (!uri?.startsWith('file://')) return false;
  let path: string;
  try {
    path = decodeURI(new URL(uri).pathname);
  } catch {
    return false;
  }
  if (path.split('/').some((seg) => seg === '..' || seg === '.')) return false;
  return [filesDir(), thumbsDir()].some((dir) => {
    const root = decodeURI(new URL(dir.uri).pathname).replace(/\/?$/, '/');
    return path.startsWith(root);
  });
}

function extensionFor(name: string | null | undefined, mime: string | null | undefined) {
  const fromName = name?.match(/\.([a-z0-9]{1,8})$/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  return extForMime(mime) ?? 'bin';
}

/**
 * Copies a shared/picked file into app storage. Must run right away: read grants on
 * content:// URIs from other apps are temporary.
 */
export function importFile(source: string, id: string, name?: string | null, mime?: string | null) {
  const dest = new File(filesDir(), `${id}.${extensionFor(name, mime)}`);
  const src = new File(source);
  src.copy(dest);
  return { uri: dest.uri, size: fileSizeOf(dest.uri) };
}

/**
 * Bytes on disk, or null. Reads a fresh File: a File object keeps the info it saw when it was
 * created, so `dest.size` right after a copy into it is still 0 (every file used to save as 0 B).
 */
export function fileSizeOf(uri: string | null | undefined): number | null {
  if (!uri?.startsWith('file://')) return null;
  try {
    const f = new File(uri);
    return f.exists && f.size ? f.size : null;
  } catch {
    return null;
  }
}

/** First-page thumbnail for a PDF; null when the native renderer is unavailable or fails. */
export async function makePdfThumbnail(fileUri: string, id: string) {
  if (!ExpressiveModule) return null;
  try {
    const out = new File(thumbsDir(), `${id}.jpg`);
    return await ExpressiveModule.renderPdfPage(fileUri, out.uri, 480, 0);
  } catch (e) {
    devWarn('[pdf thumb]', e);
    return null;
  }
}

/**
 * The start of a saved text file (16 KB, decoded off the hot path) for the bookmark's
 * `content`: cards, the item page preview and search use it. Null for binary or unreadable files.
 */
export async function readTextExcerpt(fileUri: string): Promise<string | null> {
  try {
    const head = await readTextHead(fileUri, EXCERPT_MAX_BYTES);
    return head.binary ? null : head.text;
  } catch (e) {
    devWarn('[files] excerpt failed', e);
    return null;
  }
}

export function deleteLocalFiles(...uris: (string | null | undefined)[]) {
  for (const uri of uris) {
    if (!isOwnFile(uri)) continue;
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch (e) {
      devWarn('[files] delete failed', uri, e);
    }
  }
}
