import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Share } from 'react-native';

import {
  addTagToBookmarks,
  type BookmarkWithTags,
  deleteBookmarks,
  deleteHighlights,
  type HighlightWithTags,
  moveBookmarks,
  setArchived,
  setFavorite,
  setBookmarkTags,
  setRead,
} from '@/db/repo';
import { itemHref } from '@/features/collections/ItemViews';
import { EditItemSheet } from '@/features/detail/EditItemSheet';
import { CollectionPicker, TagPicker } from '@/features/detail/Pickers';
import { useCollections } from '@/features/stash/queries';
import { plural } from '@/lib/format';
import { shareFile } from '@/lib/nav';
import { haptic } from '@/motion/haptics';
import { showSnackbar } from '@/ui/Snackbar';

import { ConfirmSheet } from './ConfirmSheet';
import { type SelectionAction, SelectionBar } from './SelectionBar';
import { selection, type SelectionStore, useSelectedKeys } from './store';

/** Selection keys for feed items (the same keys `FeedItem.key` uses). */
export const bookmarkKey = (id: string) => `b:${id}`;
export const highlightKey = (id: string) => `h:${id}`;

type Target = { bs: BookmarkWithTags[]; hs: HighlightWithTags[] };
type SheetKind = 'move' | 'tags' | 'edit' | 'delete';

/**
 * The selection bar for saved items and highlights, with every bulk action and the sheets
 * they open. One item: edit, open, copy, favorite, read state, tags, archive, move, delete.
 * Several: share, move, tag, read state, favorite, archive, delete all. Inside a collection
 * (`folderId`) it can also take items out of it.
 */
export function ItemSelection({
  store,
  bookmarks,
  highlights = [],
  folderId,
}: {
  store: SelectionStore;
  /** Bookmarks shown on screen (selection and Select all only cover these). */
  bookmarks: BookmarkWithTags[];
  highlights?: HighlightWithTags[];
  folderId?: string;
}) {
  const keys = useSelectedKeys(store);
  const { data: collections } = useCollections();
  // What a sheet acts on, frozen when it opens (the selection may change underneath).
  const [sheet, setSheet] = useState<{ kind: SheetKind; target: Target } | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);

  const bs = bookmarks.filter((b) => keys.has(bookmarkKey(b.id)));
  const hs = highlights.filter((h) => keys.has(highlightKey(h.id)));
  const count = bs.length + hs.length;
  const total = bookmarks.length + highlights.length;
  const done = () => selection.clear(store);
  const open = (kind: SheetKind) => {
    // One item starts from its own tags; several start empty (picked tags are added to all).
    setTagIds(bs.length === 1 ? bs[0].tags.map((t) => t.id) : []);
    setSheet({ kind, target: { bs, hs } });
  };
  const ids = bs.map((b) => b.id);
  const what = (n: number) => (hs.length && !bs.length ? plural(n, 'highlight') : plural(n, 'item'));

  const share = () => {
    if (bs.length === 1 && !hs.length && bs[0].filePath) {
      void shareFile(bs[0]);
      return;
    }
    const message = [
      ...bs.map((b) => (b.url ? `${b.title}\n${b.url}` : b.title)),
      ...hs.map((h) => [`“${h.text}”`, h.sourceTitle ?? h.bookmarkTitle, h.sourceUrl].filter(Boolean).join('\n')),
    ].join('\n\n');
    void Share.share({ message, title: count === 1 ? (bs[0]?.title ?? 'Highlight') : `${count} from Stash` });
  };

  const copy = async () => {
    const links = bs.flatMap((b) => (b.url ? [b.url] : []));
    const text = hs.length ? hs.map((h) => h.text).join('\n\n') : links.join('\n');
    if (!text) return;
    await Clipboard.setStringAsync(hs.length && links.length ? `${text}\n\n${links.join('\n')}` : text);
    showSnackbar(hs.length ? (hs.length === 1 && !bs.length ? 'Highlight copied' : 'Copied') : links.length === 1 ? 'Link copied' : `${links.length} links copied`);
  };

  const archive = () => {
    void setArchived(ids, true).then(() => {
      showSnackbar(`Archived ${what(ids.length)}`, { label: 'Undo', onPress: () => void setArchived(ids, false) });
      done();
    });
  };

  const removeFromCollection = () => {
    if (!folderId) return;
    void moveBookmarks(ids, null).then(() => {
      showSnackbar(`Removed ${what(ids.length)} from this collection`, { label: 'Undo', onPress: () => void moveBookmarks(ids, folderId) });
      done();
    });
  };

  const allRead = bs.every((b) => b.readAt);
  const allFavorite = bs.every((b) => b.isFavorite);
  const hasLinks = bs.some((b) => b.url);
  const one = count === 1 ? bs[0] : undefined;

  const actions: SelectionAction[] = [];
  if (one) actions.push({ label: 'Edit', icon: 'edit', quick: true, onPress: () => open('edit') });
  actions.push({ label: 'Share', icon: 'share', quick: true, onPress: share });
  if (bs.length) actions.push({ label: 'Move', icon: 'driveFileMove', quick: true, onPress: () => open('move') });
  if (bs.length && !one) actions.push({ label: 'Tag', icon: 'newLabel', quick: true, onPress: () => open('tags') });
  actions.push({ label: count > 1 ? 'Delete all' : 'Delete', icon: 'delete', quick: true, destructive: true, onPress: () => open('delete') });

  if (one) actions.push({ label: 'Open', icon: 'openInNew', onPress: () => { done(); router.push(itemHref(one)); } });
  if (hasLinks || hs.length) actions.push({ label: hs.length ? 'Copy text' : bs.length > 1 ? 'Copy links' : 'Copy link', icon: 'contentCopy', onPress: () => void copy() });
  if (count === 1 && hs[0]?.bookmarkId) {
    const h = hs[0];
    actions.push({ label: 'Go to source', icon: 'openInNew', onPress: () => { done(); router.push(`/item/${h.bookmarkId}`); } });
  }
  if (bs.length) {
    actions.push(
      {
        label: allFavorite ? 'Remove from favorites' : 'Add to favorites',
        icon: allFavorite ? 'starFill' : 'star',
        onPress: () => void setFavorite(ids, !allFavorite).then(done),
      },
      {
        label: allRead ? 'Mark as unread' : 'Mark as read',
        icon: allRead ? 'markEmailUnread' : 'doneAll',
        onPress: () => void setRead(ids, !allRead).then(done),
      },
    );
    if (one) actions.push({ label: 'Tags', icon: 'sell', onPress: () => open('tags') });
    actions.push({ label: 'Archive', icon: 'archive', onPress: archive });
    if (folderId && bs.some((b) => b.folderId === folderId)) {
      actions.push({ label: 'Remove from collection', icon: 'folderOpen', onPress: removeFromCollection });
    }
  }

  const target = sheet?.target;
  const tIds = target?.bs.map((b) => b.id) ?? [];
  const tCount = (target?.bs.length ?? 0) + (target?.hs.length ?? 0);
  const tWhat = target && target.hs.length && !target.bs.length ? plural(tCount, 'highlight') : plural(tCount, 'item');

  return (
    <>
      <SelectionBar
        count={count}
        total={total}
        onClose={done}
        onSelectAll={() => selection.set(store, [...bookmarks.map((b) => bookmarkKey(b.id)), ...highlights.map((h) => highlightKey(h.id))])}
        actions={actions}
      />

      {sheet?.kind === 'edit' && target?.bs[0] && (
        <EditItemSheet
          b={target.bs[0]}
          onDismiss={() => {
            setSheet(null);
            done();
          }}
        />
      )}

      {sheet?.kind === 'move' && target && (
        <CollectionPicker
          current={target.bs.length === 1 ? target.bs[0].folderId : null}
          onPick={(to) => {
            const before = target.bs.map((b) => [b.id, b.folderId] as const);
            const name = to ? (collections.find((c) => c.id === to)?.name ?? 'collection') : null;
            void moveBookmarks(tIds, to).then(() => {
              showSnackbar(name ? `Moved ${plural(tIds.length, 'item')} to ${name}` : `Took ${plural(tIds.length, 'item')} out of their collection`, {
                label: 'Undo',
                onPress: () => {
                  const groups = new Map<string | null, string[]>();
                  before.forEach(([id, f]) => groups.set(f, [...(groups.get(f) ?? []), id]));
                  groups.forEach((gIds, f) => void moveBookmarks(gIds, f));
                },
              });
              done();
            });
          }}
          onDismiss={() => setSheet(null)}
        />
      )}

      {sheet?.kind === 'tags' && target && (
        <TagPicker
          selected={tagIds}
          onChange={(next) => setTagIds(next)}
          onDismiss={() => {
            const picked = tagIds;
            setSheet(null);
            const single = target.bs.length === 1 ? target.bs[0] : null;
            const unchanged = single
              ? picked.length === single.tags.length && single.tags.every((t) => picked.includes(t.id))
              : !picked.length;
            if (unchanged) return;
            void (async () => {
              if (single) {
                await setBookmarkTags(single.id, picked);
                showSnackbar('Tags updated');
              } else {
                for (const tagId of picked) await addTagToBookmarks(tIds, tagId);
                showSnackbar(`Tagged ${plural(tIds.length, 'item')}`);
              }
              done();
            })();
          }}
        />
      )}

      {sheet?.kind === 'delete' && target && (
        <ConfirmSheet
          title={tCount === 1 ? 'Delete this?' : `Delete ${tWhat}?`}
          body={
            target.bs.some((b) => b.filePath)
              ? 'Saved files are removed from this phone too. This can’t be undone.'
              : 'This can’t be undone.'
          }
          confirmLabel={tCount === 1 ? 'Delete' : 'Delete all'}
          onDismiss={() => setSheet(null)}
          onConfirm={() => {
            void Promise.all([deleteBookmarks(tIds), deleteHighlights(target.hs.map((h) => h.id))]).then(() => {
              haptic.remove();
              showSnackbar(`Deleted ${tWhat}`);
              done();
            });
          }}
        />
      )}
    </>
  );
}
