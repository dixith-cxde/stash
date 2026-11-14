import { Directory, File, Paths } from 'expo-file-system';

import { ExpressiveModule } from '../../../modules/expressive';
import { extForMime } from './kinds';
import { EXCERPT_MAX_BYTES, readTextHead } from './read';

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
  return { uri: dest.uri, size: dest.size ?? null };
}

/** First-page thumbnail for a PDF; null when the native renderer is unavailable or fails. */
export async function makePdfThumbnail(fileUri: string, id: string) {
  if (!ExpressiveModule) return null;
  try {
    const out = new File(thumbsDir(), `${id}.jpg`);
    return await ExpressiveModule.renderPdfPage(fileUri, out.uri, 480, 0);
  } catch (e) {
    console.warn('[pdf thumb]', e);
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
    console.warn('[files] excerpt failed', e);
    return null;
  }
}

export function deleteLocalFiles(...uris: (string | null | undefined)[]) {
  for (const uri of uris) {
    if (!uri?.startsWith('file://')) continue;
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch (e) {
      console.warn('[files] delete failed', uri, e);
    }
  }
}
