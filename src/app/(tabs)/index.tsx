import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, ConfirmDialog, FolderPickerSheet, TagPickerSheet } from '@/components/sheets';
import { useDbQuery } from '@/db/hooks';
import {
  allLists,
  countsByType,
  countUnread,
  deleteBookmarks,
  deleteHighlight,
  folderTree,
  getBookmark,
  highlightCounts,
  listBookmarks,
  queryBookmarks,
  queryHighlights,
  recentCovers,
  setArchived,
  setBookmarkTags,
  updateBookmark,
} from '@/db/repo';
import type { BookmarkType } from '@/db/schema';
import { coverOf, mergeFeed } from '@/features/native/records';
import { plural } from '@/lib/format';
import { browse, openItem } from '@/lib/nav';
import { AppHost } from '@/theme/AppTheme';
import { nativeIcon } from '@/theme/icons';

import { type CollectionRecord, type OptionRecord, StashHome } from '../../../modules/expressive';

type Filter = 'all' | BookmarkType | 'quotes';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'link', label: 'Links' },
  { key: 'pdf', label: 'PDFs' },
  { key: 'text', label: 'Notes' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'image', label: 'Images' },
  { key: 'file', label: 'Files' },
];

type Collection = CollectionRecord & { open: () => void };

/** Smart views first, then pinned (or, failing that, the biggest) folders and pinned lists. */
async function loadCollections(): Promise<Collection[]> {
  const [folders, lists, unread] = await Promise.all([folderTree(), allLists(), countUnread()]);
  const pinned = folders.filter((f) => f.pinned);
  const shownFolders = (pinned.length ? pinned : [...folders].sort((a, b) => b.itemCount - a.itemCount))
    .filter((f) => f.itemCount > 0)
    .slice(0, 4);
  const result: Collection[] = [];
  if (unread) {
    result.push({
      key: 'unread',
      title: 'Read later',
      subtitle: `${unread} to read`,
      shape: 'sunny',
      icon: nativeIcon('menuBook'),
      tone: 'tertiary',
      covers: await recentCovers({ unread: true }),
      open: () => browse('Read later', { unread: true, types: ['link', 'pdf'] }),
    });
  }
  for (const f of shownFolders) {
    result.push({
      key: `f:${f.id}`,
      title: f.name,
      subtitle: plural(f.itemCount, 'item'),
      shape: f.shape,
      icon: nativeIcon('folder'),
      tone: 'primary',
      covers: await recentCovers({ folderId: f.id }),
      open: () => router.push({ pathname: '/folder/[id]', params: { id: f.id } }),
    });
  }
  for (const l of lists.filter((x) => x.pinned)) {
    result.push({
      key: `l:${l.id}`,
      title: l.name,
      subtitle: plural(l.itemCount, 'item'),
      shape: l.shape,
      icon: nativeIcon(l.kind === 'smart' ? 'tune' : 'list'),
      tone: 'secondary',
      covers: (await listBookmarks(l))
        .map(coverOf)
        .filter((c): c is string => !!c)
        .slice(0, 3),
      open: () => router.push({ pathname: '/list/[id]', params: { id: l.id } }),
    });
  }
  result.push({
    key: 'fav',
    title: 'Favorites',
    subtitle: 'Starred',
    shape: 'heart',
    icon: nativeIcon('starFill'),
    tone: 'secondary',
    covers: await recentCovers({ favorite: true }),
    open: () => browse('Favorites', { favorite: true }),
  });
  result.push({
    key: 'archive',
    title: 'Archive',
    subtitle: 'Out of the way',
    shape: 'cookie4Sided',
    icon: nativeIcon('archive'),
    tone: 'primary',
    covers: [],
    open: () => browse('Archive', { archived: true }),
  });
  return result;
}

async function loadFeed(filter: Filter) {
  const types = filter === 'all' || filter === 'quotes' ? undefined : [filter];
  const [items, highlights] = await Promise.all([
    filter === 'quotes' ? Promise.resolve([]) : queryBookmarks(types ? { types } : {}, 300),
    filter === 'all' || filter === 'quotes' ? queryHighlights() : Promise.resolve([]),
  ]);
  const counts = await highlightCounts(items.filter((b) => b.type === 'pdf').map((b) => b.id));
  return mergeFeed(items, filter === 'all' ? highlights.slice(0, 30) : highlights, counts);
}

type Sheet = { kind: 'item' | 'highlight' | 'folder' | 'tags' | 'delete'; id: string } | null;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [sheet, setSheet] = useState<Sheet>(null);
  const { data: items } = useDbQuery(() => loadFeed(filter), [filter], []);
  const { data: counts } = useDbQuery(
    async () => ({ ...(await countsByType()), quotes: (await queryHighlights()).length, unread: await countUnread() }),
    [],
    {} as Record<string, number>,
  );
  const { data: collections } = useDbQuery(loadCollections, [], []);
  const { data: target } = useDbQuery(
    () => (sheet && sheet.kind !== 'highlight' ? getBookmark(sheet.id) : Promise.resolve(null)),
    [sheet?.id, sheet?.kind],
    null,
  );

  const total = ['link', 'pdf', 'text', 'image', 'file'].reduce((n, k) => n + (counts[k] ?? 0), 0);
  const filters: OptionRecord[] = FILTERS.filter((f) => f.key === 'all' || f.key === filter || (counts[f.key] ?? 0) > 0);
  const subtitle = total
    ? [plural(total, 'thing') + ' saved', counts.unread ? `${counts.unread} to read` : null].filter(Boolean).join(' · ')
    : 'Save anything from any app';
  const close = () => setSheet(null);

  return (
    <AppHost style={{ flex: 1 }}>
      <StashHome
        title="Stash"
        subtitle={subtitle}
        collections={collections.map(({ open: _open, ...c }) => c)}
        filters={filters}
        selectedFilter={filter}
        items={items}
        emptyTitle={filter === 'all' ? 'Nothing saved yet' : 'Nothing here yet'}
        emptyBody={
          filter === 'all'
            ? 'Share a link, PDF or image from any app to Stash, or select text anywhere and tap “Save to Stash”.'
            : 'Things you save will show up here.'
        }
        topInset={insets.top}
        bottomInset={insets.bottom}
        onAction={({ action, key }) => {
          switch (action) {
            case 'settings':
              return router.push('/settings');
            case 'search':
              return router.navigate('/search');
            case 'seeAll':
              return router.navigate('/library');
            case 'collection':
              return collections.find((c) => c.key === key)?.open();
            case 'filter':
              return setFilter(key as Filter);
            case 'item':
              return router.push({ pathname: '/item/[id]', params: { id: key } });
            case 'itemMenu':
              return setSheet({ kind: 'item', id: key });
            case 'highlight':
            case 'highlightMenu':
              return setSheet({ kind: 'highlight', id: key });
          }
        }}
      />

      {sheet?.kind === 'item' && target ? (
        <ActionSheet
          title={target.title || 'Untitled'}
          onDismiss={close}
          actions={[
            { icon: 'openInNew', label: 'Open', run: () => void openItem(target) },
            {
              icon: target.isFavorite ? 'starFill' : 'star',
              label: target.isFavorite ? 'Remove from favorites' : 'Add to favorites',
              run: () => void updateBookmark(target.id, { isFavorite: !target.isFavorite }),
            },
            {
              icon: target.readAt ? 'history' : 'doneAll',
              label: target.readAt ? 'Mark as unread' : 'Mark as read',
              run: () => void updateBookmark(target.id, { readAt: target.readAt ? null : new Date() }),
            },
            { icon: 'driveFileMove', label: 'Move to folder', run: () => setSheet({ kind: 'folder', id: target.id }) },
            { icon: 'newLabel', label: 'Edit tags', run: () => setSheet({ kind: 'tags', id: target.id }) },
            { icon: 'archive', label: 'Archive', run: () => void setArchived([target.id], true) },
            { icon: 'delete', label: 'Delete', destructive: true, run: () => setSheet({ kind: 'delete', id: target.id }) },
          ]}
        />
      ) : null}
      {sheet?.kind === 'highlight' ? (
        <HighlightMenu id={sheet.id} onDismiss={close} />
      ) : null}
      {sheet?.kind === 'folder' && target ? (
        <FolderPickerSheet current={target.folderId} onDismiss={close} onPick={(folderId) => void updateBookmark(target.id, { folderId })} />
      ) : null}
      {sheet?.kind === 'tags' && target ? (
        <TagPickerSheet initial={target.tags.map((t) => t.id)} onDismiss={close} onDone={(ids) => void setBookmarkTags(target.id, ids)} />
      ) : null}
      {sheet?.kind === 'delete' && target ? (
        <ConfirmDialog
          title="Delete this item?"
          message="Its saved file and highlights are removed too."
          onDismiss={close}
          onConfirm={() => void deleteBookmarks([target.id])}
        />
      ) : null}
    </AppHost>
  );
}

function HighlightMenu({ id, onDismiss }: { id: string; onDismiss: () => void }) {
  const { data: highlight } = useDbQuery(async () => (await queryHighlights()).find((h) => h.id === id) ?? null, [id], null);
  if (!highlight) return null;
  return (
    <ActionSheet
      title="Highlight"
      onDismiss={onDismiss}
      actions={[
        ...(highlight.bookmarkId
          ? [
              {
                icon: 'openInNew' as const,
                label: `Open ${highlight.bookmarkTitle ?? 'source'}`,
                run: () => router.push({ pathname: '/item/[id]', params: { id: highlight.bookmarkId! } }),
              },
            ]
          : []),
        { icon: 'contentCopy', label: 'Copy text', run: () => void Clipboard.setStringAsync(highlight.text) },
        { icon: 'delete', label: 'Delete', destructive: true, run: () => void deleteHighlight(highlight.id) },
      ]}
    />
  );
}
