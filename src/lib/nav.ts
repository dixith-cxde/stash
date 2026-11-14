import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';

import { type BookmarkWithTags, updateBookmark } from '@/db/repo';
import { canRenderPdf } from '@/features/pdf/render';
import { cardKind, isTextFileKind } from '@/features/stash/model';

/**
 * Opens an item's content: links in a Custom Tab (app-store links too: Android offers the
 * store app), PDFs in the reader, Markdown / text files in the file viewer, other files via
 * the share sheet.
 */
export async function openItem(item: BookmarkWithTags) {
  if (item.type === 'pdf' && item.filePath && canRenderPdf()) {
    // The reader marks it read and remembers the page itself.
    router.push({ pathname: '/pdf/[id]', params: { id: item.id } });
    return;
  }
  if (item.filePath && isTextFileKind(cardKind(item))) {
    // The viewer marks it read.
    router.push({ pathname: '/file/[id]', params: { id: item.id } });
    return;
  }
  if (item.type === 'link' && item.url) {
    await WebBrowser.openBrowserAsync(item.url, { showTitle: true, enableBarCollapsing: true });
  } else if (item.filePath) {
    await Sharing.shareAsync(item.filePath, { mimeType: item.mimeType ?? undefined, dialogTitle: item.title });
  }
  if (!item.readAt) await updateBookmark(item.id, { readAt: new Date() });
}
