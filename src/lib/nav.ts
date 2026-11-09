import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';

import { type BookmarkWithTags, updateBookmark } from '@/db/repo';
import type { SmartFilter } from '@/db/schema';

/** Open the generic filtered feed (Favorites, Unread, Archive, a type…). */
export function browse(title: string, filter: SmartFilter) {
  router.push({ pathname: '/browse', params: { title, filter: JSON.stringify(filter) } });
}

/** Opens an item's content: links in a Custom Tab, PDFs in the reader, files via the share sheet. */
export async function openItem(item: BookmarkWithTags) {
  if (item.type === 'link' && item.url) {
    await WebBrowser.openBrowserAsync(item.url, { showTitle: true, enableBarCollapsing: true });
  } else if (item.type === 'pdf') {
    router.push({ pathname: '/pdf/[id]', params: { id: item.id } });
  } else if (item.filePath) {
    await Sharing.shareAsync(item.filePath, { mimeType: item.mimeType ?? undefined, dialogTitle: item.title });
  }
  if (!item.readAt) await updateBookmark(item.id, { readAt: new Date() });
}
