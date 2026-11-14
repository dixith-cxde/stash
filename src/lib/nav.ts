import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';

import { type BookmarkWithTags, feedItemIdForBookmark, updateBookmark } from '@/db/repo';
import { cardKind, isTextFileKind } from '@/features/stash/model';

/**
 * Opens an item's content: articles saved from Feeds in the reader, other links in a Custom Tab (app-store links too: Android offers the
 * store app), PDFs in the reader, images in the image viewer, Markdown / text files in the file viewer, other files via
 * the share sheet.
 */
export async function openItem(item: BookmarkWithTags) {
  if (item.type === 'pdf' && item.filePath) {
    // The reader marks it read and remembers the page itself.
    router.push({ pathname: '/pdf/[id]', params: { id: item.id } });
    return;
  }
  if (item.type === 'image' && (item.filePath || item.thumbPath || item.imageUrl)) {
    // The viewer marks it read.
    router.push({ pathname: '/image/[id]', params: { id: item.id } });
    return;
  }
  if (item.filePath && isTextFileKind(cardKind(item))) {
    // The viewer marks it read.
    router.push({ pathname: '/file/[id]', params: { id: item.id } });
    return;
  }
  if (item.type === 'link' && item.url) {
    // Saved from Feeds: open it in the reader, like in the Feeds tab.
    const feedItemId = await feedItemIdForBookmark(item.id, item.url);
    if (feedItemId) {
      router.push({ pathname: '/article/[id]', params: { id: feedItemId } });
      if (!item.readAt) await updateBookmark(item.id, { readAt: new Date() });
      return;
    }
    await WebBrowser.openBrowserAsync(item.url, { showTitle: true, enableBarCollapsing: true });
  } else if (item.filePath) {
    await Sharing.shareAsync(item.filePath, { mimeType: item.mimeType ?? undefined, dialogTitle: item.title });
  }
  if (!item.readAt) await updateBookmark(item.id, { readAt: new Date() });
}
