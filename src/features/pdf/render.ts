import { Directory, File, Paths } from 'expo-file-system';

import { ExpressiveModule } from '../../../modules/expressive';

/** Widest page bitmap we render (px). Keeps a page well under 10 MB in memory. */
export const MAX_RENDER_WIDTH = 1600;

export type PdfInfo = { pageCount: number; aspect: number };

const cacheDir = (id: string) => {
  const dir = new Directory(Paths.cache, 'pdf', id);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

const pageFile = (id: string, page: number, width: number) => new File(cacheDir(id), `${page}-${width}.jpg`);

/** Native renderer is Android-only (and missing in Expo Go). */
export const canRenderPdf = () => !!ExpressiveModule;

/**
 * Renders page 0 to learn the page count and the first page's aspect (height / width). Every
 * page is laid out in a box of that aspect, so the list can jump straight to a page.
 */
export async function openPdf(id: string, source: string, width: number): Promise<PdfInfo & { firstUri: string }> {
  if (!ExpressiveModule) throw new Error('PDF rendering is not available on this device');
  const out = pageFile(id, 0, width);
  const r = await ExpressiveModule.renderPdfPage(source, out.uri, width, 0);
  return { pageCount: r.pageCount, aspect: r.height / r.width, firstUri: r.uri };
}

/** A page's JPEG, from the cache when it was rendered before at this width. */
export async function renderPage(id: string, source: string, page: number, width: number): Promise<string> {
  const out = pageFile(id, page, width);
  if (out.exists) return out.uri;
  if (!ExpressiveModule) throw new Error('PDF rendering is not available on this device');
  return (await ExpressiveModule.renderPdfPage(source, out.uri, width, page)).uri;
}

/** Drops a document's rendered pages (on delete). */
export function clearPdfCache(id: string) {
  try {
    const dir = new Directory(Paths.cache, 'pdf', id);
    if (dir.exists) dir.delete();
  } catch (e) {
    console.warn('[pdf cache]', e);
  }
}
