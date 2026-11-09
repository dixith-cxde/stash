import { Column, IconButton, InputChip, LazyRow, Row, Text } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, padding, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { BookmarkCollection } from '@/components/BookmarkCollection';
import { Ico } from '@/components/Ico';
import { ActionSheet, ConfirmDialog, FolderPickerSheet, NameShapeSheet } from '@/components/sheets';
import { TopBar } from '@/components/TopBar';
import { useDbQuery } from '@/db/hooks';
import { childFolders, createFolder, deleteFolder, getFolder, queryBookmarks, updateFolder } from '@/db/repo';
import { plural } from '@/lib/format';
import { AppHost, useColors } from '@/theme/AppTheme';

import { type MaterialShapeName, MorphingShape } from '../../../modules/expressive';

type Sheet = 'menu' | 'rename' | 'new' | 'move' | 'delete' | null;

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const [sheet, setSheet] = useState<Sheet>(null);
  const { data: folder } = useDbQuery(() => getFolder(id), [id], undefined);
  const { data: children } = useDbQuery(() => childFolders(id), [id], []);
  const { data: items } = useDbQuery(() => queryBookmarks({ folderId: id }), [id], []);

  const header = folder
    ? [
        <Row key="hero" verticalAlignment="center" horizontalArrangement={{ spacedBy: 16 }} modifiers={[padding(24, 8, 24, 16)]}>
          <MorphingShape shape={folder.shape as MaterialShapeName} color={colors.primaryContainer} modifiers={[size(72, 72)]}>
            <Ico name="folderOpen" size={32} tint={colors.onPrimaryContainer} />
          </MorphingShape>
          <Column modifiers={[weight(1)]}>
            <Text maxLines={2} style={{ typography: 'headlineMedium', fontWeight: '700' }}>
              {folder.name}
            </Text>
            <Text color={colors.onSurfaceVariant} style={{ typography: 'titleSmall' }}>
              {[plural(items.length, 'item'), children.length ? plural(children.length, 'subfolder') : null].filter(Boolean).join(' · ')}
            </Text>
          </Column>
        </Row>,
        children.length ? (
          <LazyRow key="children" horizontalArrangement={{ spacedBy: 8 }} contentPadding={{ start: 16, end: 16 }} modifiers={[fillMaxWidth(), padding(0, 0, 0, 12)]}>
            {children.map((c) => (
              <InputChip key={c.id} onClick={() => router.push({ pathname: '/folder/[id]', params: { id: c.id } })}>
                <InputChip.Avatar>
                  <MorphingShape shape={c.shape as MaterialShapeName} color={colors.secondaryContainer} modifiers={[size(24, 24)]}>
                    <Ico name="folder" size={14} tint={colors.onSecondaryContainer} />
                  </MorphingShape>
                </InputChip.Avatar>
                <InputChip.Label>
                  <Text>{c.name}</Text>
                </InputChip.Label>
              </InputChip>
            ))}
          </LazyRow>
        ) : null,
      ]
    : null;

  return (
    <AppHost style={{ flex: 1 }}>
      <Column modifiers={[fillMaxSize()]}>
        <TopBar
          actions={
            <>
              <IconButton onClick={() => setSheet('new')}>
                <Ico name="createNewFolder" label="New subfolder" />
              </IconButton>
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
            empty={{ icon: 'folderOpen', shape: 'cookie9Sided', title: 'Empty folder', body: 'Long-press items anywhere and choose Move to file them here.' }}
          />
        </Column>
      </Column>

      {sheet === 'menu' && folder ? (
        <ActionSheet
          title={folder.name}
          onDismiss={() => setSheet(null)}
          actions={[
            { icon: 'edit', label: 'Rename & shape', run: () => setSheet('rename') },
            { icon: 'star', label: folder.pinned ? 'Unpin from Home' : 'Pin to Home', run: () => void updateFolder(id, { pinned: !folder.pinned }) },
            { icon: 'driveFileMove', label: 'Move folder', run: () => setSheet('move') },
            { icon: 'delete', label: 'Delete folder', destructive: true, run: () => setSheet('delete') },
          ]}
        />
      ) : null}
      {sheet === 'rename' && folder ? (
        <NameShapeSheet
          title="Edit folder"
          initialName={folder.name}
          initialShape={folder.shape as MaterialShapeName}
          confirmLabel="Save"
          onDismiss={() => setSheet(null)}
          onSubmit={(name, shape) => void updateFolder(id, { name, shape })}
        />
      ) : null}
      {sheet === 'new' ? (
        <NameShapeSheet
          title="New subfolder"
          onDismiss={() => setSheet(null)}
          onSubmit={(name, shape) => void createFolder({ name, shape, parentId: id })}
        />
      ) : null}
      {sheet === 'move' ? (
        <FolderPickerSheet
          title="Move folder into"
          current={folder?.parentId}
          excludeId={id}
          onDismiss={() => setSheet(null)}
          onPick={(parentId) => void updateFolder(id, { parentId })}
        />
      ) : null}
      {sheet === 'delete' && folder ? (
        <ConfirmDialog
          title={`Delete “${folder.name}”?`}
          message="Subfolders are deleted too. Items inside are kept and moved out of the folder."
          onDismiss={() => setSheet(null)}
          onConfirm={() => void deleteFolder(id).then(() => router.back())}
        />
      ) : null}
    </AppHost>
  );
}
