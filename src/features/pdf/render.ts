import { Directory, Paths } from 'expo-file-system';
import { devWarn } from '@/lib/log';

/**
 * Page bitmaps from the old native-render reader lived in cache/pdf/<id>. The reader now
 * draws with pdf.js (src/app/pdf/[id].tsx), but deleting an item still clears that folder.
 */
export function clearPdfCache(id: string) {
  try {
    const dir = new Directory(Paths.cache, 'pdf', id);
    if (dir.exists) dir.delete();
  } catch (e) {
    devWarn('[pdf cache]', e);
  }
}
