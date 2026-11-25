import { router } from 'expo-router';
import { useState } from 'react';
import { Share } from 'react-native';

import { deleteFolders, mergeFolders, queryBookmarks } from '@/db/repo';
import type { Collection } from '@/features/stash/queries';
import { plural } from '@/lib/format';
import { haptic } from '@/motion/haptics';
import { ActionSheet } from '@/ui/ActionSheet';
import { showSnackbar } from '@/ui/Snackbar';

import { ConfirmSheet } from './ConfirmSheet';
import { type SelectionAction, SelectionBar } from './SelectionBar';
import { selection, type SelectionStore, useSelectedKeys } from './store';

type SheetKind = 'merge' | 'delete';

/**
 * The selection bar for collections (keys are folder ids). One: edit, open, share its links,
 * delete. Several: merge into one of them, share, delete all. Deleting a collection never
 * deletes its items; they stay in the stash.
 */
export function CollectionSelection({ store, collections }: { store: SelectionStore; collections: Collection[] }) {
  const keys = useSelectedKeys(store);
  const [sheet, setSheet] = useState<{ kind: SheetKind; target: Collection[] } | null>(null);
  const picked = collections.filter((c) => keys.has(c.id));
  const count = picked.length;
  const done = () => selection.clear(store);
  const open = (kind: SheetKind) => setSheet({ kind, target: picked });

  const share = async () => {
    const blocks = await Promise.all(
      picked.map(async (c) => {
        const items = await queryBookmarks({ folderId: c.id });
        return [c.name, ...items.map((b) => (b.url ? `${b.title}\n${b.url}` : b.title))].join('\n\n');
      }),
    );
    void Share.share({ message: blocks.join('\n\n———\n\n'), title: count === 1 ? picked[0].name : `${count} collections` });
  };

  const one = count === 1 ? picked[0] : undefined;
  const actions: SelectionAction[] = [];
  if (one) {
    actions.push({
      label: 'Edit',
      icon: 'edit',
      quick: true,
      onPress: () => {
        done();
        router.push({ pathname: '/collection/new', params: { id: one.id } });
      },
    });
  } else {
    actions.push({ label: 'Merge', icon: 'layers', quick: true, onPress: () => open('merge') });
  }
  actions.push(
    { label: 'Share', icon: 'share', quick: true, onPress: () => void share() },
    { label: count > 1 ? 'Delete all' : 'Delete', icon: 'delete', quick: true, destructive: true, onPress: () => open('delete') },
  );
  if (one) {
    actions.push({
      label: 'Open',
      icon: 'openInNew',
      onPress: () => {
        done();
        router.push(`/collection/${one.id}`);
      },
    });
  }

  const target = sheet?.target ?? [];
  const items = target.reduce((n, c) => n + c.itemCount, 0);

  return (
    <>
      <SelectionBar count={count} total={collections.length} onClose={done} onSelectAll={() => selection.set(store, collections.map((c) => c.id))} actions={actions} />

      {sheet?.kind === 'merge' && (
        <ActionSheet
          title="Merge into…"
          onDismiss={() => setSheet(null)}
          actions={target.map((into) => ({
            label: into.name,
            icon: 'folder' as const,
            onPress: () => {
              void mergeFolders(
                into.id,
                target.map((c) => c.id),
              ).then((moved) => {
                haptic.save();
                showSnackbar(`Merged ${plural(target.length, 'collection')} into ${into.name}${moved ? ` · ${plural(moved, 'item')} moved` : ''}`);
                done();
              });
            },
          }))}
        />
      )}

      {sheet?.kind === 'delete' && (
        <ConfirmSheet
          title={target.length === 1 ? `Delete ${target[0].name}?` : `Delete ${plural(target.length, 'collection')}?`}
          body={items ? `The ${plural(items, 'item')} in ${target.length === 1 ? 'it' : 'them'} stay in your stash.` : 'Nothing is in them; your stash is not changed.'}
          confirmLabel={target.length === 1 ? 'Delete' : 'Delete all'}
          onDismiss={() => setSheet(null)}
          onConfirm={() => {
            void deleteFolders(target.map((c) => c.id)).then(() => {
              haptic.remove();
              showSnackbar(target.length === 1 ? `Deleted ${target[0].name}` : `Deleted ${plural(target.length, 'collection')}`);
              done();
            });
          }}
        />
      )}
    </>
  );
}
