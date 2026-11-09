import {
  AssistChip,
  Column,
  ContainedLoadingIndicator,
  FlowRow,
  InputChip,
  OutlinedTextField,
  Row,
  SplitButtonLayout,
  SplitButtonLeadingButton,
  SplitButtonTrailingButton,
  Surface,
  Text,
  TextButton,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import {
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
  verticalScroll,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TypeBadge } from '@/components/BookmarkItem';
import { Ico } from '@/components/Ico';
import { FolderPickerSheet, TagPickerSheet } from '@/components/sheets';
import { useDbQuery } from '@/db/hooks';
import { folderTree, listTags } from '@/db/repo';
import { type CaptureDraft, hostOf, normalizeShare } from '@/features/capture/normalize';
import { saveDraft } from '@/features/capture/save';
import { fileSize } from '@/lib/format';
import { useCapture } from '@/state/capture';
import { AppHost, useColors } from '@/theme/AppTheme';

function DraftCard({ draft, onChange }: { draft: CaptureDraft; onChange: (d: CaptureDraft) => void }) {
  const colors = useColors();
  const isHighlight = draft.kind === 'highlight';
  const initial = isHighlight ? draft.text : draft.type === 'text' ? (draft.content ?? '') : draft.title;
  const state = useNativeState(initial);

  const subtitle =
    draft.kind === 'highlight'
      ? 'Highlight'
      : draft.type === 'link' && draft.url
        ? hostOf(draft.url)
        : [draft.file?.fileName, fileSize(draft.file?.size)].filter(Boolean).join(' · ') || 'Note';

  return (
    <Surface
      color={isHighlight ? colors.tertiaryContainer : colors.surfaceContainerHigh}
      modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(32))]}>
      <Column modifiers={[padding(20, 20, 20, 20)]} verticalArrangement={{ spacedBy: 12 }}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
          <TypeBadge type={isHighlight ? 'highlight' : draft.type} dim={40} />
          <Text style={{ typography: 'labelLarge' }} color={colors.onSurfaceVariant} maxLines={1} modifiers={[weight(1)]}>
            {subtitle}
          </Text>
        </Row>
        <OutlinedTextField
          value={state}
          minLines={isHighlight || (draft.kind === 'bookmark' && draft.type === 'text') ? 3 : 1}
          maxLines={10}
          onValueChange={(v) => {
            if (draft.kind === 'highlight') onChange({ ...draft, text: v });
            else if (draft.type === 'text') onChange({ ...draft, content: v, title: v.split('\n')[0]?.slice(0, 80) || 'Note' });
            else onChange({ ...draft, title: v });
          }}
          modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label>
            <Text>{isHighlight ? 'Highlighted text' : draft.type === 'text' ? 'Text' : 'Title'}</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>
      </Column>
    </Surface>
  );
}

/** Quick-save screen for anything shared into the app or selected via "Save to Stash". */
export default function CaptureScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { drafts: incoming, external, clear } = useCapture();
  const [drafts, setDrafts] = useState<CaptureDraft[]>(incoming);
  // Drafts can arrive after this screen mounted (share deep link routes here first).
  const [seen, setSeen] = useState(incoming);
  if (incoming !== seen) {
    setSeen(incoming);
    if (incoming.length) setDrafts(incoming);
  }
  const [blank, setBlank] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [sheet, setSheet] = useState<'folder' | 'tags' | null>(null);
  const [saving, setSaving] = useState(false);
  const [openAfter, setOpenAfter] = useState(false);
  const { data: folders } = useDbQuery(folderTree, [], []);
  const { data: tags } = useDbQuery(listTags, [], []);

  const effective = drafts.length ? drafts : blank.trim() ? normalizeShare({ text: blank }) : [];
  const onlyHighlights = effective.every((d) => d.kind === 'highlight');
  const folderName = folders.find((f) => f.id === folderId)?.name;

  const done = (openId?: string) => {
    clear();
    if (openId) {
      router.replace({ pathname: '/item/[id]', params: { id: openId } });
    } else if (external) {
      // Return to the app the user shared from.
      BackHandler.exitApp();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const save = async (open: boolean) => {
    if (!effective.length || saving) return;
    setSaving(true);
    try {
      let firstId: string | undefined;
      for (const d of effective) {
        const r = await saveDraft(d, { folderId: d.kind === 'bookmark' ? folderId : undefined, tagIds, note: note.trim() || undefined });
        if (r.kind === 'bookmark') firstId ??= r.id;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      done(open ? firstId : undefined);
    } finally {
      setSaving(false);
    }
  };

  const blankState = useNativeState('');

  return (
    <AppHost style={{ flex: 1 }}>
      <Column modifiers={[fillMaxSize(), padding(0, insets.top, 0, insets.bottom)]}>
        <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(24, 16, 12, 8)]}>
          <Column modifiers={[weight(1)]}>
            <Text style={{ typography: 'headlineMedium', fontWeight: '700' }}>
              {onlyHighlights && effective.length ? 'Save highlight' : 'Save to Stash'}
            </Text>
            {effective.length > 1 ? (
              <Text color={colors.onSurfaceVariant} style={{ typography: 'titleSmall' }}>{`${effective.length} items`}</Text>
            ) : null}
          </Column>
          <TextButton onClick={() => done()}>
            <Text>Cancel</Text>
          </TextButton>
        </Row>

        <Column modifiers={[weight(1), verticalScroll(), padding(16, 8, 16, 16)]} verticalArrangement={{ spacedBy: 12 }}>
          {drafts.length ? (
            drafts.map((d, i) => (
              <DraftCard key={i} draft={d} onChange={(next) => setDrafts((all) => all.map((x, j) => (j === i ? next : x)))} />
            ))
          ) : (
            <OutlinedTextField value={blankState} autoFocus minLines={4} onValueChange={setBlank} modifiers={[fillMaxWidth()]}>
              <OutlinedTextField.Label>
                <Text>Paste a link or write a note</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>
          )}

          <OutlinedTextField onValueChange={setNote} modifiers={[fillMaxWidth()]}>
            <OutlinedTextField.Label>
              <Text>Add a note</Text>
            </OutlinedTextField.Label>
            <OutlinedTextField.LeadingIcon>
              <Ico name="stickyNote2" size={20} />
            </OutlinedTextField.LeadingIcon>
          </OutlinedTextField>

          <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 4 }}>
            {onlyHighlights ? null : (
              <AssistChip onClick={() => setSheet('folder')}>
                <AssistChip.LeadingIcon>
                  <Ico name="folder" size={18} />
                </AssistChip.LeadingIcon>
                <AssistChip.Label>
                  <Text>{folderName ?? 'Folder'}</Text>
                </AssistChip.Label>
              </AssistChip>
            )}
            {tags
              .filter((t) => tagIds.includes(t.id))
              .map((t) => (
                <InputChip key={t.id} selected onClick={() => setTagIds(tagIds.filter((x) => x !== t.id))}>
                  <InputChip.Label>
                    <Text>{`#${t.name}`}</Text>
                  </InputChip.Label>
                  <InputChip.TrailingIcon>
                    <Ico name="close" size={16} />
                  </InputChip.TrailingIcon>
                </InputChip>
              ))}
            <AssistChip onClick={() => setSheet('tags')}>
              <AssistChip.LeadingIcon>
                <Ico name="newLabel" size={18} />
              </AssistChip.LeadingIcon>
              <AssistChip.Label>
                <Text>{tagIds.length ? 'Edit tags' : 'Add tags'}</Text>
              </AssistChip.Label>
            </AssistChip>
          </FlowRow>
        </Column>

        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), padding(16, 8, 16, 16)]}>
          {saving ? <ContainedLoadingIndicator /> : null}
          <Column modifiers={[weight(1)]} />
          <SplitButtonLayout>
            <SplitButtonLayout.LeadingButton>
              <SplitButtonLeadingButton enabled={!!effective.length && !saving} onClick={() => void save(openAfter)}>
                <Ico name={openAfter ? 'openInNew' : 'bookmarkAdd'} size={20} />
                <Text modifiers={[padding(8, 0, 0, 0)]}>{openAfter ? 'Save & open' : 'Save'}</Text>
              </SplitButtonLeadingButton>
            </SplitButtonLayout.LeadingButton>
            <SplitButtonLayout.TrailingButton>
              <SplitButtonTrailingButton checked={openAfter} onCheckedChange={setOpenAfter} enabled={!onlyHighlights}>
                <Ico name="openInNew" size={20} label="Open after saving" />
              </SplitButtonTrailingButton>
            </SplitButtonLayout.TrailingButton>
          </SplitButtonLayout>
        </Row>
      </Column>

      {sheet === 'folder' ? (
        <FolderPickerSheet current={folderId} title="Save into folder" onDismiss={() => setSheet(null)} onPick={setFolderId} />
      ) : null}
      {sheet === 'tags' ? <TagPickerSheet initial={tagIds} onDismiss={() => setSheet(null)} onDone={setTagIds} /> : null}
    </AppHost>
  );
}
