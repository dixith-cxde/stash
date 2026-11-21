import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';

import { type BookmarkWithTags, feedItemIdForBookmark, updateBookmark } from '@/db/repo';
import { isOwnFile } from '@/features/files/storage';
import { cardKind, isTextFileKind } from '@/features/stash/model';
import { showSnackbar } from '@/ui/Snackbar';

import { ExpressiveModule } from '../../modules/expressive';

type FileFields = { filePath: string | null; mimeType: string | null; title: string };

/** The share sheet with the file itself (Share buttons). */
export async function shareFile(item: FileFields) {
  if (isOwnFile(item.filePath)) await Sharing.shareAsync(item.filePath, { mimeType: item.mimeType ?? undefined, dialogTitle: item.title });
}

/**
 * Opens a saved file in the phone's default app for its type ("Open in another app", files
 * Stash can't show). Android asks which app when no default is set. When no app can open the
 * type, says so and offers the share sheet instead.
 */
export async function openFileExternally(item: FileFields) {
  if (!item.filePath) return;
  // iOS / web, or an installed build older than openFile: the share sheet is the "open in" menu.
  if (typeof ExpressiveModule?.openFile !== 'function') return shareFile(item);
  if (ExpressiveModule.openFile(item.filePath, item.mimeType)) return;
  showSnackbar('No app on this phone opens this file', { label: 'Share', onPress: () => void shareFile(item) });
}

/**
 * Opens an item's content: articles saved from Feeds in the reader, other links in a Custom Tab (app-store links too: Android offers the
 * store app), PDFs in the reader, images in the image viewer, Markdown / text files in the file viewer, other files in
 * the phone's default app for their type.
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
    await openFileExternally(item);
  }
  if (!item.readAt) await updateBookmark(item.id, { readAt: new Date() });
}
