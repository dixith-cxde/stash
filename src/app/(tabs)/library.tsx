import { AssistChip, Box, FlowRow, LazyColumn, ListItem, Text } from '@expo/ui/jetpack-compose';
import {
  align,
  clip,
  combinedClickable,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
  size,
} from '@expo/ui/jetpack-compose/modifiers';
import { router } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyView } from '@/components/BookmarkCollection';
import { Ico } from '@/components/Ico';
import { ActionSheet, ConfirmDialog, NameShapeSheet } from '@/components/sheets';
import { SmartFilterSheet } from '@/components/SmartFilterSheet';
import { useDbQuery } from '@/db/hooks';
import {
  allLists,
  createFolder,
  createList,
  deleteFolder,
  deleteList,
  type FolderNode,
  folderTree,
  type ListWithCount,
  listTags,
  updateFolder,
  updateList,
} from '@/db/repo';
import { plural } from '@/lib/format';
import { AppHost, useColors } from '@/theme/AppTheme';

import { ConnectedButtonGroup, FabMenu, type MaterialShapeName, MorphingShape } from '../../../modules/expressive';

type Section = 'folders' | 'lists' | 'tags';
type Sheet =
  | { kind: 'newFolder' | 'newList' | 'newSmart' }
  | { kind: 'folderMenu' | 'folderEdit' | 'folderDelete'; folder: FolderNode }
  | { kind: 'listMenu' | 'listEdit' | 'listDelete'; list: ListWithCount }
  | null;

function FolderRow({ folder, onLongPress }: { folder: FolderNode; onLongPress: () => void }) {
  const colors = useColors();
  return (
    <ListItem
      colors={{ containerColor: colors.surfaceContainerLow }}
      modifiers={[
        padding(16 + folder.depth * 24, 3, 16, 3),
        clip(Shapes.RoundedCorner(folder.depth ? 20 : 28)),
        combinedClickable({
          onClick: () => router.push({ pathname: '/folder/[id]', params: { id: folder.id } }),
          onLongClick: onLongPress,
        }),
      ]}>
      <ListItem.LeadingContent>
        <MorphingShape
          shape={folder.shape as MaterialShapeName}
          color={folder.depth ? colors.secondaryContainer : colors.primaryContainer}
          modifiers={[size(44, 44)]}>
          <Ico name="folder" size={22} tint={folder.depth ? colors.onSecondaryContainer : colors.onPrimaryContainer} />
        </MorphingShape>
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <Text style={{ typography: 'titleMedium', fontWeight: '600' }}>{folder.name}</Text>
      </ListItem.HeadlineContent>
      <ListItem.SupportingContent>
        <Text color={colors.onSurfaceVariant}>{plural(folder.itemCount, 'item')}</Text>
      </ListItem.SupportingContent>
      <ListItem.TrailingContent>
        {folder.pinned ? <Ico name="starFill" size={18} tint={colors.tertiary} /> : <Ico name="chevronRight" tint={colors.onSurfaceVariant} />}
      </ListItem.TrailingContent>
    </ListItem>
  );
}

function ListRow({ list, onLongPress }: { list: ListWithCount; onLongPress: () => void }) {
  const colors = useColors();
  const smart = list.kind === 'smart';
  return (
    <ListItem
      colors={{ containerColor: colors.surfaceContainerLow }}
      modifiers={[
        padding(16, 3, 16, 3),
        clip(Shapes.RoundedCorner(28)),
        combinedClickable({
          onClick: () => router.push({ pathname: '/list/[id]', params: { id: list.id } }),
          onLongClick: onLongPress,
        }),
      ]}>
      <ListItem.LeadingContent>
        <MorphingShape shape={list.shape as MaterialShapeName} color={colors.tertiaryContainer} modifiers={[size(44, 44)]}>
          <Ico name={smart ? 'tune' : 'list'} size={22} tint={colors.onTertiaryContainer} />
        </MorphingShape>
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <Text style={{ typography: 'titleMedium', fontWeight: '600' }}>{list.name}</Text>
      </ListItem.HeadlineContent>
      <ListItem.SupportingContent>
        <Text color={colors.onSurfaceVariant}>{`${smart ? 'Smart · ' : ''}${plural(list.itemCount, 'item')}`}</Text>
      </ListItem.SupportingContent>
      <ListItem.TrailingContent>
        {list.pinned ? <Ico name="starFill" size={18} tint={colors.tertiary} /> : <Ico name="chevronRight" tint={colors.onSurfaceVariant} />}
      </ListItem.TrailingContent>
    </ListItem>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>('folders');
  const [sheet, setSheet] = useState<Sheet>(null);
  const { data: folders } = useDbQuery(folderTree, [], []);
  const { data: lists } = useDbQuery(allLists, [], []);
  const { data: tags } = useDbQuery(listTags, [], []);
  const close = () => setSheet(null);

  return (
    <AppHost style={{ flex: 1 }}>
      <Box modifiers={[fillMaxSize()]}>
        <LazyColumn
          modifiers={[fillMaxSize()]}
          contentPadding={{ top: insets.top, bottom: 120 }}
          verticalArrangement={{ spacedBy: 2 }}>
          <Text style={{ typography: 'displaySmall', fontWeight: '700', letterSpacing: -0.5 }} modifiers={[padding(24, 20, 24, 16)]}>
            Library
          </Text>
          <Box modifiers={[padding(16, 0, 16, 16)]}>
            <ConnectedButtonGroup
              options={[
                { key: 'folders', label: 'Folders', icon: <Ico name="folder" size={18} /> },
                { key: 'lists', label: 'Lists', icon: <Ico name="list" size={18} /> },
                { key: 'tags', label: 'Tags', icon: <Ico name="sell" size={18} /> },
              ]}
              selected={[section]}
              onSelectionChange={([k]) => k && setSection(k as Section)}
            />
          </Box>

          {section === 'folders' && !folders.length ? (
            <EmptyView icon="folder" shape="cookie9Sided" title="No folders yet" body="Folders can nest. Tap + to create your first one." />
          ) : null}
          {section === 'lists' && !lists.length ? (
            <EmptyView
              icon="list"
              shape="clover4Leaf"
              title="No lists yet"
              body="Lists are hand-picked reading queues. Smart lists fill themselves from a filter."
            />
          ) : null}
          {section === 'tags' && !tags.length ? (
            <EmptyView icon="sell" shape="sunny" title="No tags yet" body="Add tags when saving, or long-press items to tag several at once." />
          ) : null}

          {section === 'folders'
            ? folders.map((f) => <FolderRow key={f.id} folder={f} onLongPress={() => setSheet({ kind: 'folderMenu', folder: f })} />)
            : null}
          {section === 'lists'
            ? lists.map((l) => <ListRow key={l.id} list={l} onLongPress={() => setSheet({ kind: 'listMenu', list: l })} />)
            : null}
          {section === 'tags' && tags.length ? (
            <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth(), padding(16, 0, 16, 0)]}>
              {tags.map((t) => (
                <AssistChip key={t.id} onClick={() => router.push({ pathname: '/tag/[id]', params: { id: t.id } })}>
                  <AssistChip.Label>
                    <Text>{`#${t.name}  ${t.count}`}</Text>
                  </AssistChip.Label>
                </AssistChip>
              ))}
            </FlowRow>
          ) : null}
        </LazyColumn>

        {section !== 'tags' ? (
          <FabMenu
            modifiers={[align('bottomEnd'), padding(0, 0, 16, 16)]}
            icon={<Ico name="add" />}
            items={[
              { key: 'folder', label: 'New folder', icon: <Ico name="createNewFolder" /> },
              { key: 'list', label: 'New list', icon: <Ico name="playlistAdd" /> },
              { key: 'smart', label: 'New smart list', icon: <Ico name="tune" /> },
            ]}
            onItemPress={(k) =>
              setSheet({ kind: k === 'folder' ? 'newFolder' : k === 'list' ? 'newList' : 'newSmart' })
            }
          />
        ) : null}
      </Box>

      {sheet?.kind === 'newFolder' ? (
        <NameShapeSheet
          title="New folder"
          onDismiss={close}
          onSubmit={(name, shape) => {
            setSection('folders');
            void createFolder({ name, shape });
          }}
        />
      ) : null}
      {sheet?.kind === 'newList' ? (
        <NameShapeSheet
          title="New list"
          initialShape="clover4Leaf"
          onDismiss={close}
          onSubmit={(name, shape) => {
            setSection('lists');
            void createList({ name, shape });
          }}
        />
      ) : null}
      {sheet?.kind === 'newSmart' ? (
        <SmartFilterSheet
          title="New smart list"
          onDismiss={close}
          onSubmit={(name, filter) => {
            setSection('lists');
            void createList({ name, kind: 'smart', filter, shape: 'pentagon' });
          }}
        />
      ) : null}

      {sheet?.kind === 'folderMenu' ? (
        <ActionSheet
          title={sheet.folder.name}
          onDismiss={close}
          actions={[
            { icon: 'edit', label: 'Rename & shape', run: () => setSheet({ kind: 'folderEdit', folder: sheet.folder }) },
            {
              icon: 'star',
              label: sheet.folder.pinned ? 'Unpin from Home' : 'Pin to Home',
              run: () => void updateFolder(sheet.folder.id, { pinned: !sheet.folder.pinned }),
            },
            { icon: 'delete', label: 'Delete', destructive: true, run: () => setSheet({ kind: 'folderDelete', folder: sheet.folder }) },
          ]}
        />
      ) : null}
      {sheet?.kind === 'folderEdit' ? (
        <NameShapeSheet
          title="Edit folder"
          confirmLabel="Save"
          initialName={sheet.folder.name}
          initialShape={sheet.folder.shape as MaterialShapeName}
          onDismiss={close}
          onSubmit={(name, shape) => void updateFolder(sheet.folder.id, { name, shape })}
        />
      ) : null}
      {sheet?.kind === 'folderDelete' ? (
        <ConfirmDialog
          title={`Delete “${sheet.folder.name}”?`}
          message="Subfolders are deleted too. Items inside are kept."
          onDismiss={close}
          onConfirm={() => void deleteFolder(sheet.folder.id)}
        />
      ) : null}

      {sheet?.kind === 'listMenu' ? (
        <ActionSheet
          title={sheet.list.name}
          onDismiss={close}
          actions={[
            { icon: 'edit', label: 'Rename & shape', run: () => setSheet({ kind: 'listEdit', list: sheet.list }) },
            {
              icon: 'star',
              label: sheet.list.pinned ? 'Unpin from Home' : 'Pin to Home',
              run: () => void updateList(sheet.list.id, { pinned: !sheet.list.pinned }),
            },
            { icon: 'delete', label: 'Delete', destructive: true, run: () => setSheet({ kind: 'listDelete', list: sheet.list }) },
          ]}
        />
      ) : null}
      {sheet?.kind === 'listEdit' ? (
        <NameShapeSheet
          title="Edit list"
          confirmLabel="Save"
          initialName={sheet.list.name}
          initialShape={sheet.list.shape as MaterialShapeName}
          onDismiss={close}
          onSubmit={(name, shape) => void updateList(sheet.list.id, { name, shape })}
        />
      ) : null}
      {sheet?.kind === 'listDelete' ? (
        <ConfirmDialog
          title={`Delete “${sheet.list.name}”?`}
          message="The list is removed; its items are kept."
          onDismiss={close}
          onConfirm={() => void deleteList(sheet.list.id)}
        />
      ) : null}
    </AppHost>
  );
}
