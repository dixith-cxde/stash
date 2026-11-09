import {
  AnimatedVisibility,
  AssistChip,
  Column,
  ContainedLoadingIndicator,
  FlowRow,
  IconButton,
  IconToggleButton,
  Image,
  InputChip,
  OutlinedTextField,
  Row,
  SplitButtonLayout,
  SplitButtonLeadingButton,
  SplitButtonTrailingButton,
  Text,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  size,
  verticalScroll,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Linking, Share } from 'react-native';

import { TypeBadge } from '@/components/BookmarkItem';
import { HighlightCard } from '@/components/HighlightCard';
import { Ico } from '@/components/Ico';
import { ActionSheet, ConfirmDialog, FolderPickerSheet, ListPickerSheet, NameShapeSheet, TagPickerSheet } from '@/components/sheets';
import { TopBar } from '@/components/TopBar';
import { useDbQuery } from '@/db/hooks';
import {
  addToList,
  allLists,
  type BookmarkWithTags,
  deleteBookmarks,
  getBookmark,
  getFolder,
  listsContaining,
  queryHighlights,
  removeFromList,
  setArchived,
  setBookmarkTags,
  updateBookmark,
} from '@/db/repo';
import { hostOf } from '@/features/capture/normalize';
import { refreshPreview } from '@/features/preview/fetchPreview';
import { fileSize, relativeTime } from '@/lib/format';
import { openItem } from '@/lib/nav';
import { AppHost, useColors } from '@/theme/AppTheme';
import { TYPE_META } from '@/theme/types';

type Sheet = 'menu' | 'tags' | 'folder' | 'list' | 'title' | 'delete' | null;

/** Saves a text field after the user pauses typing, and flushes on unmount. */
function useAutosave(value: string, initial: string, save: (v: string) => void) {
  const pending = useRef<string | null>(null);
  const persist = useEffectEvent((v: string) => save(v));
  useEffect(() => {
    if (value === initial) return;
    pending.current = value;
    const t = setTimeout(() => {
      persist(value);
      pending.current = null;
    }, 600);
    return () => clearTimeout(t);
  }, [value, initial]);
  useEffect(
    () => () => {
      if (pending.current !== null) persist(pending.current);
    },
    [],
  );
}

function Detail({ item }: { item: BookmarkWithTags }) {
  const colors = useColors();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { data: folder } = useDbQuery(() => (item.folderId ? getFolder(item.folderId) : Promise.resolve(undefined)), [item.folderId], undefined);
  const { data: listIds } = useDbQuery(() => listsContaining(item.id), [item.id], []);
  const { data: lists } = useDbQuery(allLists, [], []);
  const { data: highlights } = useDbQuery(() => queryHighlights({ bookmarkId: item.id }), [item.id], []);

  const noteState = useNativeState(item.note ?? '');
  const [note, setNote] = useState(item.note ?? '');
  useAutosave(note, item.note ?? '', (v) => void updateBookmark(item.id, { note: v || null }));

  const contentState = useNativeState(item.content ?? '');
  const [content, setContent] = useState(item.content ?? '');
  useAutosave(content, item.content ?? '', (v) => void updateBookmark(item.id, { content: v }));

  const hero = item.type === 'image' ? item.filePath : item.type === 'pdf' ? item.thumbPath : item.imageUrl;
  const meta = TYPE_META[item.type];
  const memberLists = lists.filter((l) => listIds.includes(l.id));
  const source = item.type === 'link' && item.url ? (item.siteName ?? hostOf(item.url)) : meta.label;
  const shareText = item.url ?? item.content ?? item.title;

  return (
    <Column modifiers={[fillMaxSize()]}>
      <TopBar
        actions={
          <>
            <IconToggleButton
              checked={item.isFavorite}
              onCheckedChange={(v) => void updateBookmark(item.id, { isFavorite: v })}>
              <Ico name={item.isFavorite ? 'starFill' : 'star'} label="Favorite" />
            </IconToggleButton>
            <IconButton
              onClick={() =>
                item.filePath && !item.url
                  ? void Sharing.shareAsync(item.filePath, { mimeType: item.mimeType ?? undefined })
                  : void Share.share({ message: shareText })
              }>
              <Ico name="share" label="Share" />
            </IconButton>
            <IconButton onClick={() => setSheet('menu')}>
              <Ico name="moreVert" label="More" />
            </IconButton>
          </>
        }
      />
      <Column modifiers={[weight(1), verticalScroll()]} verticalArrangement={{ spacedBy: 16 }}>
        {hero ? (
          <Image
            source={{ uri: hero }}
            contentScale={item.type === 'image' ? 'fit' : 'crop'}
            alignment="topCenter"
            modifiers={[
              padding(16, 0, 16, 0),
              fillMaxWidth(),
              height(item.type === 'image' ? 360 : 220),
              clip(Shapes.RoundedCorner(32)),
              clickable(() => void openItem(item)),
            ]}
          />
        ) : null}

        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 10 }} modifiers={[padding(24, 0, 24, 0)]}>
          {item.favicon && item.type === 'link' ? (
            <Image source={{ uri: item.favicon }} modifiers={[size(24, 24), clip(Shapes.RoundedCorner(6))]} />
          ) : (
            <TypeBadge type={item.type} dim={32} />
          )}
          <Text color={colors.onSurfaceVariant} style={{ typography: 'labelLarge' }} maxLines={1} modifiers={[weight(1)]}>
            {[source, relativeTime(item.createdAt), fileSize(item.fileSize)].filter(Boolean).join(' · ')}
          </Text>
          {item.fetchStatus === 'pending' || refreshing ? <ContainedLoadingIndicator modifiers={[size(36, 36)]} /> : null}
        </Row>

        <Text
          style={{ typography: 'headlineMedium', fontWeight: '700' }}
          modifiers={[padding(24, 0, 24, 0), clickable(() => setSheet('title'), { indication: false })]}>
          {item.title || 'Untitled'}
        </Text>
        {item.description ? (
          <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge' }} modifiers={[padding(24, 0, 24, 0)]}>
            {item.description}
          </Text>
        ) : null}

        {item.type !== 'text' ? (
          <Column modifiers={[padding(24, 0, 24, 0)]} verticalArrangement={{ spacedBy: 8 }}>
            <SplitButtonLayout>
              <SplitButtonLayout.LeadingButton>
                <SplitButtonLeadingButton onClick={() => void openItem(item)}>
                  <Ico name="openInNew" size={20} />
                  <Text modifiers={[padding(8, 0, 0, 0)]}>{item.type === 'pdf' ? 'Read PDF' : item.type === 'link' ? 'Open' : 'Open with…'}</Text>
                </SplitButtonLeadingButton>
              </SplitButtonLayout.LeadingButton>
              <SplitButtonLayout.TrailingButton>
                <SplitButtonTrailingButton checked={moreOpen} onCheckedChange={setMoreOpen}>
                  <Ico name="moreVert" size={20} label="More open options" />
                </SplitButtonTrailingButton>
              </SplitButtonLayout.TrailingButton>
            </SplitButtonLayout>
            <AnimatedVisibility visible={moreOpen}>
              <FlowRow horizontalArrangement={{ spacedBy: 8 }}>
                {item.url ? (
                  <AssistChip onClick={() => void Linking.openURL(item.url!)}>
                    <AssistChip.LeadingIcon>
                      <Ico name="public" size={18} />
                    </AssistChip.LeadingIcon>
                    <AssistChip.Label>
                      <Text>Open in app</Text>
                    </AssistChip.Label>
                  </AssistChip>
                ) : null}
                {item.url ? (
                  <AssistChip onClick={() => void Clipboard.setStringAsync(item.url!)}>
                    <AssistChip.LeadingIcon>
                      <Ico name="contentPaste" size={18} />
                    </AssistChip.LeadingIcon>
                    <AssistChip.Label>
                      <Text>Copy link</Text>
                    </AssistChip.Label>
                  </AssistChip>
                ) : null}
                {item.type === 'link' ? (
                  <AssistChip
                    onClick={async () => {
                      setRefreshing(true);
                      await refreshPreview(item);
                      setRefreshing(false);
                    }}>
                    <AssistChip.LeadingIcon>
                      <Ico name="history" size={18} />
                    </AssistChip.LeadingIcon>
                    <AssistChip.Label>
                      <Text>Refresh preview</Text>
                    </AssistChip.Label>
                  </AssistChip>
                ) : null}
                {item.filePath ? (
                  <AssistChip onClick={() => void Sharing.shareAsync(item.filePath!, { mimeType: item.mimeType ?? undefined })}>
                    <AssistChip.LeadingIcon>
                      <Ico name="download" size={18} />
                    </AssistChip.LeadingIcon>
                    <AssistChip.Label>
                      <Text>Export file</Text>
                    </AssistChip.Label>
                  </AssistChip>
                ) : null}
              </FlowRow>
            </AnimatedVisibility>
          </Column>
        ) : (
          <OutlinedTextField
            value={contentState}
            onValueChange={setContent}
            minLines={6}
            modifiers={[fillMaxWidth(), padding(16, 0, 16, 0)]}>
            <OutlinedTextField.Label>
              <Text>Text</Text>
            </OutlinedTextField.Label>
          </OutlinedTextField>
        )}

        <OutlinedTextField value={noteState} onValueChange={setNote} minLines={2} modifiers={[fillMaxWidth(), padding(16, 0, 16, 0)]}>
          <OutlinedTextField.Label>
            <Text>Your note</Text>
          </OutlinedTextField.Label>
          <OutlinedTextField.LeadingIcon>
            <Ico name="stickyNote2" size={20} />
          </OutlinedTextField.LeadingIcon>
        </OutlinedTextField>

        <Column modifiers={[padding(24, 0, 24, 0)]} verticalArrangement={{ spacedBy: 8 }}>
          <Text style={{ typography: 'titleSmall', fontWeight: '700' }} color={colors.primary}>
            ORGANIZE
          </Text>
          <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 4 }}>
            <AssistChip onClick={() => setSheet('folder')}>
              <AssistChip.LeadingIcon>
                <Ico name="folder" size={18} />
              </AssistChip.LeadingIcon>
              <AssistChip.Label>
                <Text>{folder?.name ?? 'No folder'}</Text>
              </AssistChip.Label>
            </AssistChip>
            {memberLists.map((l) => (
              <InputChip key={l.id} selected onClick={() => void removeFromList(l.id, [item.id])}>
                <InputChip.Label>
                  <Text>{l.name}</Text>
                </InputChip.Label>
                <InputChip.TrailingIcon>
                  <Ico name="close" size={16} />
                </InputChip.TrailingIcon>
              </InputChip>
            ))}
            <AssistChip onClick={() => setSheet('list')}>
              <AssistChip.LeadingIcon>
                <Ico name="playlistAdd" size={18} />
              </AssistChip.LeadingIcon>
              <AssistChip.Label>
                <Text>Add to list</Text>
              </AssistChip.Label>
            </AssistChip>
          </FlowRow>
          <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 4 }}>
            {item.tags.map((t) => (
              <InputChip key={t.id} onClick={() => router.push({ pathname: '/tag/[id]', params: { id: t.id } })}>
                <InputChip.Label>
                  <Text>{`#${t.name}`}</Text>
                </InputChip.Label>
              </InputChip>
            ))}
            <AssistChip onClick={() => setSheet('tags')}>
              <AssistChip.LeadingIcon>
                <Ico name={item.tags.length ? 'edit' : 'newLabel'} size={18} />
              </AssistChip.LeadingIcon>
              <AssistChip.Label>
                <Text>{item.tags.length ? 'Edit tags' : 'Add tags'}</Text>
              </AssistChip.Label>
            </AssistChip>
          </FlowRow>
        </Column>

        {highlights.length ? (
          <Column verticalArrangement={{ spacedBy: 4 }}>
            <Text style={{ typography: 'titleSmall', fontWeight: '700' }} color={colors.primary} modifiers={[padding(24, 8, 24, 4)]}>
              {`HIGHLIGHTS · ${highlights.length}`}
            </Text>
            {highlights.map((h) => (
              <HighlightCard key={h.id} highlight={h} />
            ))}
          </Column>
        ) : null}

        {item.url ? (
          <Text
            color={colors.onSurfaceVariant}
            style={{ typography: 'bodySmall' }}
            maxLines={3}
            modifiers={[padding(24, 8, 24, 32), clickable(() => void Clipboard.setStringAsync(item.url!))]}>
            {item.url}
          </Text>
        ) : null}
      </Column>

      {sheet === 'menu' ? (
        <ActionSheet
          onDismiss={() => setSheet(null)}
          actions={[
            { icon: 'edit', label: 'Rename', run: () => setSheet('title') },
            { icon: 'driveFileMove', label: 'Move to folder', run: () => setSheet('folder') },
            {
              icon: item.readAt ? 'history' : 'doneAll',
              label: item.readAt ? 'Mark as unread' : 'Mark as read',
              run: () => void updateBookmark(item.id, { readAt: item.readAt ? null : new Date() }),
            },
            {
              icon: item.isArchived ? 'unarchive' : 'archive',
              label: item.isArchived ? 'Unarchive' : 'Archive',
              run: () => void setArchived([item.id], !item.isArchived),
            },
            { icon: 'delete', label: 'Delete', destructive: true, run: () => setSheet('delete') },
          ]}
        />
      ) : null}
      {sheet === 'title' ? (
        <NameShapeSheet
          title="Rename"
          showShape={false}
          confirmLabel="Save"
          initialName={item.title}
          onDismiss={() => setSheet(null)}
          onSubmit={(title) => void updateBookmark(item.id, { title })}
        />
      ) : null}
      {sheet === 'tags' ? (
        <TagPickerSheet
          initial={item.tags.map((t) => t.id)}
          onDismiss={() => setSheet(null)}
          onDone={(ids) => void setBookmarkTags(item.id, ids)}
        />
      ) : null}
      {sheet === 'folder' ? (
        <FolderPickerSheet
          current={item.folderId}
          onDismiss={() => setSheet(null)}
          onPick={(folderId) => void updateBookmark(item.id, { folderId })}
        />
      ) : null}
      {sheet === 'list' ? (
        <ListPickerSheet onDismiss={() => setSheet(null)} onPick={(listId) => void addToList(listId, [item.id])} />
      ) : null}
      {sheet === 'delete' ? (
        <ConfirmDialog
          title="Delete this item?"
          message="Its saved file and highlights are removed too."
          onDismiss={() => setSheet(null)}
          onConfirm={() => {
            router.back();
            void deleteBookmarks([item.id]);
          }}
        />
      ) : null}
    </Column>
  );
}

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, loading } = useDbQuery(() => getBookmark(id), [id], null);
  return (
    <AppHost style={{ flex: 1 }}>
      {item ? (
        <Detail key={item.id} item={item} />
      ) : (
        <Column modifiers={[fillMaxSize()]}>
          <TopBar title={loading ? '' : 'Not found'} />
        </Column>
      )}
    </AppHost>
  );
}
