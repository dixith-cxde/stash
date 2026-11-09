import {
  AnimatedVisibility,
  Box,
  Column,
  HorizontalFloatingToolbar,
  IconButton,
  LazyColumn,
  Text,
} from '@expo/ui/jetpack-compose';
import { align, fillMaxSize, fillMaxWidth, padding, size } from '@expo/ui/jetpack-compose/modifiers';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addTagToBookmarks,
  addToList,
  type BookmarkWithTags,
  deleteBookmarks,
  moveBookmarks,
  removeFromList,
  setArchived,
} from '@/db/repo';
import { useSettings } from '@/state/settings';
import { useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';

import { type MaterialShapeName, MorphingShape } from '../../modules/expressive';
import { BookmarkCard, BookmarkRow } from './BookmarkItem';
import { Ico } from './Ico';
import { ConfirmDialog, FolderPickerSheet, ListPickerSheet, TagPickerSheet } from './sheets';

export function openBookmark(item: BookmarkWithTags) {
  if (item.type === 'pdf') router.push({ pathname: '/pdf/[id]', params: { id: item.id } });
  else router.push({ pathname: '/item/[id]', params: { id: item.id } });
}

type Sheet = 'tag' | 'move' | 'list' | 'delete' | null;

export type EmptyState = { icon: IconName; shape: MaterialShapeName; title: string; body: string };

export function EmptyView({ icon, shape, title, body }: EmptyState) {
  const colors = useColors();
  return (
    <Column
      horizontalAlignment="center"
      verticalArrangement={{ spacedBy: 12 }}
      modifiers={[fillMaxWidth(), padding(32, 48, 32, 48)]}>
      <MorphingShape shape={shape} color={colors.secondaryContainer} modifiers={[size(112, 112)]}>
        <Ico name={icon} size={48} tint={colors.onSecondaryContainer} />
      </MorphingShape>
      <Text style={{ typography: 'titleLarge', fontWeight: '600', textAlign: 'center' }}>{title}</Text>
      <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium', textAlign: 'center' }}>
        {body}
      </Text>
    </Column>
  );
}

/**
 * Bookmark feed used by Home, folders, lists, tags and search. Long-press enters multi-select;
 * a floating toolbar (M3 Expressive) offers bulk actions.
 */
export function BookmarkCollection({
  items,
  header,
  empty,
  listId,
  bottomInset,
  topInset,
  overlay,
  onSelectingChange,
}: {
  items: BookmarkWithTags[];
  /** Compose children rendered as leading lazy items. */
  header?: React.ReactNode;
  empty?: EmptyState;
  /** When inside a manual list, adds a "remove from list" action. */
  listId?: string;
  /** Bottom system inset to clear; tab screens pass 0 because the tab bar already does. */
  bottomInset?: number;
  /** Top padding; screens with their own top app bar pass 0. */
  topInset?: number;
  /** Extra content rendered over the list (e.g. a FAB menu), hidden while selecting. */
  overlay?: React.ReactNode;
  onSelectingChange?: (selecting: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const bottom = bottomInset ?? insets.bottom;
  const layout = useSettings((s) => s.homeLayout);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<Sheet>(null);
  const selecting = selected.size > 0;

  const updateSelection = useCallback(
    (next: Set<string>) => {
      setSelected(next);
      onSelectingChange?.(next.size > 0);
    },
    [onSelectingChange],
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateSelection(next);
  };

  const ids = [...selected];
  const clear = () => updateSelection(new Set());
  const Item = layout === 'cards' ? BookmarkCard : BookmarkRow;

  const actions: { icon: IconName; label: string; run: () => void }[] = [
    { icon: 'sell', label: 'Tag', run: () => setSheet('tag') },
    { icon: 'driveFileMove', label: 'Move', run: () => setSheet('move') },
    { icon: 'playlistAdd', label: 'Add to list', run: () => setSheet('list') },
    ...(listId
      ? [{ icon: 'close' as const, label: 'Remove from list', run: () => void removeFromList(listId, ids).then(clear) }]
      : []),
    { icon: 'archive', label: 'Archive', run: () => void setArchived(ids, true).then(clear) },
    { icon: 'delete', label: 'Delete', run: () => setSheet('delete') },
  ];

  return (
    <Box modifiers={[fillMaxSize()]}>
      <LazyColumn
        modifiers={[fillMaxSize()]}
        contentPadding={{ top: topInset ?? insets.top, bottom: bottom + 112 }}
        verticalArrangement={{ spacedBy: layout === 'cards' ? 4 : 0 }}>
        {header}
        {items.length === 0 && empty ? <EmptyView {...empty} /> : null}
        <LazyColumn.Items data={items} keyExtractor={(b) => b.id} estimatedItemSize={layout === 'cards' ? 260 : 76}>
          {({ item }) => (
            <Item
              item={item}
              selected={selected.has(item.id)}
              onPress={() => (selecting ? toggle(item.id) : openBookmark(item))}
              onLongPress={() => {
                void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press);
                toggle(item.id);
              }}
            />
          )}
        </LazyColumn.Items>
      </LazyColumn>

      {selecting ? null : overlay}

      <AnimatedVisibility
        visible={selecting}
        modifiers={[align('bottomCenter'), padding(16, 0, 16, bottom + 16)]}>
        <HorizontalFloatingToolbar variant="vibrant">
          <IconButton onClick={clear}>
            <Ico name="close" label="Clear selection" />
          </IconButton>
          <Text style={{ typography: 'titleMedium', fontWeight: '600' }} modifiers={[padding(4, 0, 8, 0)]}>
            {String(selected.size)}
          </Text>
          {actions.map((a) => (
            <IconButton key={a.label} onClick={a.run}>
              <Ico name={a.icon} label={a.label} />
            </IconButton>
          ))}
        </HorizontalFloatingToolbar>
      </AnimatedVisibility>

      {sheet === 'tag' ? (
        <TagPickerSheet
          title={`Tag ${selected.size} item${selected.size === 1 ? '' : 's'}`}
          initial={[]}
          onDismiss={() => setSheet(null)}
          onDone={async (tagIds) => {
            for (const t of tagIds) await addTagToBookmarks(ids, t);
            clear();
          }}
        />
      ) : null}
      {sheet === 'move' ? (
        <FolderPickerSheet
          onDismiss={() => setSheet(null)}
          onPick={async (folderId) => {
            await moveBookmarks(ids, folderId);
            clear();
          }}
        />
      ) : null}
      {sheet === 'list' ? (
        <ListPickerSheet
          onDismiss={() => setSheet(null)}
          onPick={async (target) => {
            await addToList(target, ids);
            clear();
          }}
        />
      ) : null}
      {sheet === 'delete' ? (
        <ConfirmDialog
          title={`Delete ${selected.size} item${selected.size === 1 ? '' : 's'}?`}
          message="Saved files and highlights attached to them are removed too. This can't be undone."
          onDismiss={() => setSheet(null)}
          onConfirm={() => void deleteBookmarks(ids).then(clear)}
        />
      ) : null}
    </Box>
  );
}
