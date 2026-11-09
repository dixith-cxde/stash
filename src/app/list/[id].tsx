import { Column, IconButton, Row, Text } from '@expo/ui/jetpack-compose';
import { fillMaxSize, padding, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { BookmarkCollection } from '@/components/BookmarkCollection';
import { Ico } from '@/components/Ico';
import { ActionSheet, ConfirmDialog, NameShapeSheet } from '@/components/sheets';
import { SmartFilterSheet } from '@/components/SmartFilterSheet';
import { TopBar } from '@/components/TopBar';
import { useDbQuery } from '@/db/hooks';
import { deleteList, getList, listBookmarks, updateList } from '@/db/repo';
import { plural } from '@/lib/format';
import { AppHost, useColors } from '@/theme/AppTheme';

import { type MaterialShapeName, MorphingShape } from '../../../modules/expressive';

type Sheet = 'menu' | 'rename' | 'filter' | 'delete' | null;

export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const [sheet, setSheet] = useState<Sheet>(null);
  const { data: list } = useDbQuery(() => getList(id), [id], undefined);
  const { data: items } = useDbQuery(async () => (list ? listBookmarks(list) : []), [list], []);
  const smart = list?.kind === 'smart';

  const header = list
    ? [
        <Row key="hero" verticalAlignment="center" horizontalArrangement={{ spacedBy: 16 }} modifiers={[padding(24, 8, 24, 16)]}>
          <MorphingShape shape={list.shape as MaterialShapeName} color={colors.tertiaryContainer} modifiers={[size(72, 72)]}>
            <Ico name={smart ? 'tune' : 'list'} size={32} tint={colors.onTertiaryContainer} />
          </MorphingShape>
          <Column modifiers={[weight(1)]}>
            <Text maxLines={2} style={{ typography: 'headlineMedium', fontWeight: '700' }}>
              {list.name}
            </Text>
            <Text color={colors.onSurfaceVariant} style={{ typography: 'titleSmall' }}>
              {`${smart ? 'Smart list' : 'List'} · ${plural(items.length, 'item')}`}
            </Text>
          </Column>
        </Row>,
      ]
    : null;

  return (
    <AppHost style={{ flex: 1 }}>
      <Column modifiers={[fillMaxSize()]}>
        <TopBar
          actions={
            <>
              {smart ? (
                <IconButton onClick={() => setSheet('filter')}>
                  <Ico name="tune" label="Edit filter" />
                </IconButton>
              ) : null}
              <IconButton onClick={() => setSheet('menu')}>
                <Ico name="moreVert" label="More" />
              </IconButton>
            </>
          }
        />
        <Column modifiers={[weight(1)]}>
          <BookmarkCollection
            items={items}
            header={header}
            topInset={0}
            listId={smart ? undefined : id}
            empty={
              smart
                ? { icon: 'tune', shape: 'pentagon', title: 'No matches', body: 'Nothing matches this smart list yet. Tweak the filter from the top bar.' }
                : { icon: 'playlistAdd', shape: 'clover4Leaf', title: 'Empty list', body: 'Long-press items anywhere and choose Add to list.' }
            }
          />
        </Column>
      </Column>

      {sheet === 'menu' && list ? (
        <ActionSheet
          title={list.name}
          onDismiss={() => setSheet(null)}
          actions={[
            { icon: 'edit', label: 'Rename & shape', run: () => setSheet('rename') },
            { icon: 'star', label: list.pinned ? 'Unpin from Home' : 'Pin to Home', run: () => void updateList(id, { pinned: !list.pinned }) },
            { icon: 'delete', label: 'Delete list', destructive: true, run: () => setSheet('delete') },
          ]}
        />
      ) : null}
      {sheet === 'rename' && list ? (
        <NameShapeSheet
          title="Edit list"
          initialName={list.name}
          initialShape={list.shape as MaterialShapeName}
          confirmLabel="Save"
          onDismiss={() => setSheet(null)}
          onSubmit={(name, shape) => void updateList(id, { name, shape })}
        />
      ) : null}
      {sheet === 'filter' && list ? (
        <SmartFilterSheet
          title="Edit smart list"
          initialName={list.name}
          initial={list.filter ?? {}}
          onDismiss={() => setSheet(null)}
          onSubmit={(name, filter) => void updateList(id, { name, filter })}
        />
      ) : null}
      {sheet === 'delete' && list ? (
        <ConfirmDialog
          title={`Delete “${list.name}”?`}
          message="The list is removed; the items in it are kept."
          onDismiss={() => setSheet(null)}
          onConfirm={() => void deleteList(id).then(() => router.back())}
        />
      ) : null}
    </AppHost>
  );
}
