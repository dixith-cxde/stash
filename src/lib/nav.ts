import { type Href, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';

import { type BookmarkWithTags, updateBookmark } from '@/db/repo';

/** Opens an item's content: links in a Custom Tab, PDFs in the reader, files via the share sheet. */
export async function openItem(item: BookmarkWithTags) {
  if (item.type === 'link' && item.url) {
    await WebBrowser.openBrowserAsync(item.url, { showTitle: true, enableBarCollapsing: true });
  } else if (item.type === 'pdf') {
    // The PDF reader route returns in v3 phase 7.
    router.push(`/pdf/${item.id}` as Href);
  } else if (item.filePath) {
    await Sharing.shareAsync(item.filePath, { mimeType: item.mimeType ?? undefined, dialogTitle: item.title });
  }
  if (!item.readAt) await updateBookmark(item.id, { readAt: new Date() });
}
