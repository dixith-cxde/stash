import {
  Box,
  Button,
  Column,
  FilledTonalIconButton,
  FlowRow,
  ModalBottomSheet,
  type ModalBottomSheetRef,
  OutlinedTextField,
  Row,
  Text,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import {
  background,
  clickable,
  clip,
  combinedClickable,
  fillMaxWidth,
  padding,
  Shapes,
  size,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Share } from 'react-native';

import {
  deleteHighlight,
  type HighlightWithTags,
  setHighlightTags,
  updateHighlight,
} from '@/db/repo';
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/db/schema';
import { relativeTime } from '@/lib/format';
import { useAppTheme } from '@/theme/AppTheme';
import { HIGHLIGHT_SWATCH } from '@/theme/types';

import { MorphingShape } from '../../modules/expressive';
import { Ico } from './Ico';
import { ConfirmDialog, TagPickerSheet } from './sheets';

function useSwatch(color: string) {
  const { dark } = useAppTheme();
  const s = HIGHLIGHT_SWATCH[color] ?? HIGHLIGHT_SWATCH.yellow;
  return dark ? s.dark : s.light;
}

function sourceLine(h: HighlightWithTags) {
  return [h.bookmarkTitle ?? h.sourceTitle, h.page != null ? `p. ${h.page + 1}` : null, h.sourceApp, relativeTime(h.createdAt)]
    .filter(Boolean)
    .join(' · ');
}

/** Quote-style highlight card tinted with its highlight color. Tap to edit. */
export function HighlightCard({ highlight: h }: { highlight: HighlightWithTags }) {
  const { colors } = useAppTheme();
  const swatch = useSwatch(h.color);
  const [editing, setEditing] = useState(false);

  return (
    <>
      <Box
        modifiers={[
          padding(16, 6, 16, 6),
          fillMaxWidth(),
          clip(Shapes.RoundedCorner(28)),
          background(swatch),
          combinedClickable({
            onClick: () => setEditing(true),
            onLongClick: () => void Clipboard.setStringAsync(h.text),
          }),
        ]}>
        <Column modifiers={[padding(20, 18, 20, 18)]} verticalArrangement={{ spacedBy: 10 }}>
          <Ico name="formatQuote" size={28} tint={colors.onSurface} />
          <Text style={{ typography: 'bodyLarge', fontSize: 17, lineHeight: 26 }} color={colors.onSurface}>
            {h.text}
          </Text>
          {h.note ? (
            <Text style={{ typography: 'bodyMedium', fontStyle: 'italic' }} color={colors.onSurfaceVariant}>
              {h.note}
            </Text>
          ) : null}
          <Text style={{ typography: 'labelMedium' }} color={colors.onSurfaceVariant} maxLines={1}>
            {sourceLine(h)}
          </Text>
          {h.tags.length ? (
            <FlowRow horizontalArrangement={{ spacedBy: 6 }}>
              {h.tags.map((t) => (
                <Text key={t.id} style={{ typography: 'labelMedium', fontWeight: '600' }} color={colors.onSurface}>
                  {`#${t.name}`}
                </Text>
              ))}
            </FlowRow>
          ) : null}
        </Column>
      </Box>
      {editing ? <HighlightSheet highlight={h} onDismiss={() => setEditing(false)} /> : null}
    </>
  );
}

function HighlightSheet({ highlight: h, onDismiss }: { highlight: HighlightWithTags; onDismiss: () => void }) {
  const { colors, dark } = useAppTheme();
  const ref = useRef<ModalBottomSheetRef>(null);
  const noteState = useNativeState(h.note ?? '');
  const [note, setNote] = useState(h.note ?? '');
  const [color, setColor] = useState<HighlightColor>(h.color);
  const [sub, setSub] = useState<'tags' | 'delete' | null>(null);

  const close = async () => {
    await ref.current?.hide();
    onDismiss();
  };
  const save = async () => {
    await updateHighlight(h.id, { note: note.trim() || null, color });
    await close();
  };

  return (
    <>
      <ModalBottomSheet ref={ref} onDismissRequest={() => void save()} skipPartiallyExpanded>
        <Column modifiers={[padding(24, 0, 24, 24)]} verticalArrangement={{ spacedBy: 16 }}>
          <Text style={{ typography: 'headlineSmall', fontWeight: '600' }}>Highlight</Text>
          <Text style={{ typography: 'bodyLarge' }} maxLines={8}>
            {h.text}
          </Text>
          <Row horizontalArrangement={{ spacedBy: 12 }}>
            {HIGHLIGHT_COLORS.map((c) => {
              const sw = HIGHLIGHT_SWATCH[c][dark ? 'dark' : 'light'];
              return (
                <MorphingShape
                  key={c}
                  shape="cookie12Sided"
                  morphTo="sunny"
                  morphed={c === color}
                  rotation={30}
                  color={sw}
                  modifiers={[size(44, 44), clickable(() => setColor(c), { indication: false })]}>
                  {c === color ? <Ico name="check" size={20} tint={colors.onSurface} /> : null}
                </MorphingShape>
              );
            })}
          </Row>
          <OutlinedTextField value={noteState} onValueChange={setNote} minLines={2} maxLines={6} modifiers={[fillMaxWidth()]}>
            <OutlinedTextField.Label>
              <Text>Note</Text>
            </OutlinedTextField.Label>
          </OutlinedTextField>
          <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <FilledTonalIconButton onClick={() => setSub('tags')}>
              <Ico name="sell" label="Tags" />
            </FilledTonalIconButton>
            <FilledTonalIconButton onClick={() => void Clipboard.setStringAsync(h.text)}>
              <Ico name="contentPaste" label="Copy" />
            </FilledTonalIconButton>
            <FilledTonalIconButton
              onClick={() => void Share.share({ message: `“${h.text}”${h.sourceUrl ? `\n${h.sourceUrl}` : ''}` })}>
              <Ico name="share" label="Share" />
            </FilledTonalIconButton>
            {h.bookmarkId ? (
              <FilledTonalIconButton
                onClick={() => {
                  void close();
                  router.push({ pathname: '/item/[id]', params: { id: h.bookmarkId! } });
                }}>
                <Ico name="openInNew" label="Open source" />
              </FilledTonalIconButton>
            ) : null}
            <FilledTonalIconButton onClick={() => setSub('delete')}>
              <Ico name="delete" label="Delete" tint={colors.error} />
            </FilledTonalIconButton>
            <Box modifiers={[weight(1)]} />
            <Button onClick={() => void save()}>
              <Text>Done</Text>
            </Button>
          </Row>
        </Column>
      </ModalBottomSheet>
      {sub === 'tags' ? (
        <TagPickerSheet
          initial={h.tags.map((t) => t.id)}
          onDismiss={() => setSub(null)}
          onDone={(ids) => void setHighlightTags(h.id, ids)}
        />
      ) : null}
      {sub === 'delete' ? (
        <ConfirmDialog
          title="Delete highlight?"
          message="This can't be undone."
          onDismiss={() => setSub(null)}
          onConfirm={() => void deleteHighlight(h.id).then(close)}
        />
      ) : null}
    </>
  );
}
