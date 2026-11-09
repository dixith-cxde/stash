import {
  AlertDialog,
  Button,
  Column,
  FilterChip,
  FlowRow,
  ListItem,
  ModalBottomSheet,
  type ModalBottomSheetRef,
  OutlinedTextField,
  Row,
  Text,
  TextButton,
  type TextFieldRef,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
  size,
  verticalScroll,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useRef, useState } from 'react';

import { useDbQuery } from '@/db/hooks';
import { allLists, ensureTag, folderTree, listTags } from '@/db/repo';
import { useColors } from '@/theme/AppTheme';
import { PICKABLE_SHAPES } from '@/theme/types';

import { type MaterialShapeName, MorphingShape } from '../../modules/expressive';
import { Ico } from './Ico';

/** Closes the sheet with its exit animation, then reports dismissal. */
function useSheetClose(onDismiss: () => void) {
  const ref = useRef<ModalBottomSheetRef>(null);
  const close = async () => {
    await ref.current?.hide();
    onDismiss();
  };
  return { ref, close };
}

function SheetTitle({ children }: { children: string }) {
  return (
    <Text style={{ typography: 'headlineSmall', fontWeight: '600' }} modifiers={[padding(24, 0, 24, 12)]}>
      {children}
    </Text>
  );
}

/* --------------------------------- Tags ---------------------------------- */

export function TagPickerSheet({
  initial,
  onDismiss,
  onDone,
  title = 'Tags',
}: {
  initial: string[];
  onDismiss: () => void;
  onDone: (tagIds: string[]) => void;
  title?: string;
}) {
  const colors = useColors();
  const { data: tags } = useDbQuery(listTags, [], []);
  const [selected, setSelected] = useState(new Set(initial));
  const [draft, setDraft] = useState('');
  const field = useRef<TextFieldRef>(null);
  const { ref, close } = useSheetClose(onDismiss);

  const addDraft = async () => {
    const name = draft.trim();
    if (!name) return;
    const id = await ensureTag(name);
    setSelected((s) => new Set(s).add(id));
    setDraft('');
    await field.current?.clear();
  };

  return (
    <ModalBottomSheet ref={ref} onDismissRequest={onDismiss} skipPartiallyExpanded>
      <Column modifiers={[padding(0, 0, 0, 24), verticalScroll()]} verticalArrangement={{ spacedBy: 12 }}>
        <SheetTitle>{title}</SheetTitle>
        <Row modifiers={[padding(24, 0, 24, 0)]} verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          <OutlinedTextField
            ref={field}
            singleLine
            onValueChange={setDraft}
            keyboardOptions={{ imeAction: 'done', capitalization: 'none' }}
            keyboardActions={{ onDone: () => void addDraft() }}
            modifiers={[weight(1)]}>
            <OutlinedTextField.Placeholder>
              <Text>New tag</Text>
            </OutlinedTextField.Placeholder>
            <OutlinedTextField.LeadingIcon>
              <Ico name="sell" size={20} />
            </OutlinedTextField.LeadingIcon>
          </OutlinedTextField>
          <Button onClick={() => void addDraft()} enabled={!!draft.trim()}>
            <Text>Add</Text>
          </Button>
        </Row>
        <FlowRow
          modifiers={[padding(24, 0, 24, 0)]}
          horizontalArrangement={{ spacedBy: 8 }}
          verticalArrangement={{ spacedBy: 4 }}>
          {tags.map((t) => {
            const on = selected.has(t.id);
            return (
              <FilterChip
                key={t.id}
                selected={on}
                onClick={() =>
                  setSelected((s) => {
                    const next = new Set(s);
                    if (on) next.delete(t.id);
                    else next.add(t.id);
                    return next;
                  })
                }>
                <FilterChip.Label>
                  <Text>{`#${t.name}`}</Text>
                </FilterChip.Label>
                {on ? (
                  <FilterChip.LeadingIcon>
                    <Ico name="check" size={18} />
                  </FilterChip.LeadingIcon>
                ) : null}
              </FilterChip>
            );
          })}
        </FlowRow>
        {tags.length === 0 ? (
          <Text color={colors.onSurfaceVariant} modifiers={[padding(24, 0, 24, 0)]}>
            No tags yet — type one above.
          </Text>
        ) : null}
        <Row modifiers={[padding(24, 8, 24, 0), fillMaxWidth()]} horizontalArrangement="end">
          <Button
            onClick={async () => {
              onDone([...selected]);
              await close();
            }}>
            <Text>Done</Text>
          </Button>
        </Row>
      </Column>
    </ModalBottomSheet>
  );
}

/* -------------------------------- Folders -------------------------------- */

export function FolderPickerSheet({
  current,
  onDismiss,
  onPick,
  excludeId,
  title = 'Move to folder',
}: {
  current?: string | null;
  onDismiss: () => void;
  onPick: (folderId: string | null) => void;
  /** Hide this folder and its descendants (when re-parenting a folder). */
  excludeId?: string;
  title?: string;
}) {
  const colors = useColors();
  const { data: tree } = useDbQuery(folderTree, [], []);
  const { ref, close } = useSheetClose(onDismiss);
  const excludedPath = excludeId ? tree.find((f) => f.id === excludeId)?.path : undefined;
  const options = tree.filter((f) => !excludedPath || (f.path !== excludedPath && !f.path.startsWith(`${excludedPath} / `)));

  const pick = async (id: string | null) => {
    onPick(id);
    await close();
  };

  return (
    <ModalBottomSheet ref={ref} onDismissRequest={onDismiss}>
      <Column modifiers={[padding(0, 0, 0, 24), verticalScroll()]}>
        <SheetTitle>{title}</SheetTitle>
        <ListItem
          colors={{ containerColor: current == null ? colors.secondaryContainer : colors.surfaceContainerLow }}
          modifiers={[padding(12, 2, 12, 2), clip(Shapes.RoundedCorner(20)), clickable(() => void pick(null))]}>
          <ListItem.LeadingContent>
            <Ico name="home" />
          </ListItem.LeadingContent>
          <ListItem.HeadlineContent>
            <Text>No folder</Text>
          </ListItem.HeadlineContent>
        </ListItem>
        {options.map((f) => (
          <ListItem
            key={f.id}
            colors={{ containerColor: current === f.id ? colors.secondaryContainer : colors.surfaceContainerLow }}
            modifiers={[padding(12 + f.depth * 20, 2, 12, 2), clip(Shapes.RoundedCorner(20)), clickable(() => void pick(f.id))]}>
            <ListItem.LeadingContent>
              <MorphingShape shape={f.shape as MaterialShapeName} color={colors.primaryContainer} modifiers={[size(32, 32)]}>
                <Ico name="folder" size={16} tint={colors.onPrimaryContainer} />
              </MorphingShape>
            </ListItem.LeadingContent>
            <ListItem.HeadlineContent>
              <Text>{f.name}</Text>
            </ListItem.HeadlineContent>
          </ListItem>
        ))}
        {options.length === 0 ? (
          <Text color={colors.onSurfaceVariant} modifiers={[padding(24, 12, 24, 0)]}>
            Create folders from the Library tab.
          </Text>
        ) : null}
      </Column>
    </ModalBottomSheet>
  );
}

/* --------------------------------- Lists --------------------------------- */

export function ListPickerSheet({ onDismiss, onPick }: { onDismiss: () => void; onPick: (listId: string) => void }) {
  const colors = useColors();
  const { data: lists } = useDbQuery(allLists, [], []);
  const manual = lists.filter((l) => l.kind === 'manual');
  const { ref, close } = useSheetClose(onDismiss);
  return (
    <ModalBottomSheet ref={ref} onDismissRequest={onDismiss}>
      <Column modifiers={[padding(0, 0, 0, 24), verticalScroll()]}>
        <SheetTitle>Add to list</SheetTitle>
        {manual.map((l) => (
          <ListItem
            key={l.id}
            colors={{ containerColor: colors.surfaceContainerLow }}
            modifiers={[
              padding(12, 2, 12, 2),
              clip(Shapes.RoundedCorner(20)),
              clickable(async () => {
                onPick(l.id);
                await close();
              }),
            ]}>
            <ListItem.LeadingContent>
              <MorphingShape shape={l.shape as MaterialShapeName} color={colors.tertiaryContainer} modifiers={[size(32, 32)]}>
                <Ico name="list" size={16} tint={colors.onTertiaryContainer} />
              </MorphingShape>
            </ListItem.LeadingContent>
            <ListItem.HeadlineContent>
              <Text>{l.name}</Text>
            </ListItem.HeadlineContent>
            <ListItem.SupportingContent>
              <Text>{`${l.itemCount} items`}</Text>
            </ListItem.SupportingContent>
          </ListItem>
        ))}
        {manual.length === 0 ? (
          <Text color={colors.onSurfaceVariant} modifiers={[padding(24, 12, 24, 0)]}>
            No lists yet. Create one from the Library tab.
          </Text>
        ) : null}
      </Column>
    </ModalBottomSheet>
  );
}

/* ----------------------------- Name + shape ------------------------------ */

export function NameShapeSheet({
  title,
  initialName = '',
  initialShape = 'cookie9Sided',
  confirmLabel = 'Create',
  showShape = true,
  onDismiss,
  onSubmit,
}: {
  title: string;
  showShape?: boolean;
  initialName?: string;
  initialShape?: MaterialShapeName;
  confirmLabel?: string;
  onDismiss: () => void;
  onSubmit: (name: string, shape: MaterialShapeName) => void;
}) {
  const colors = useColors();
  const [name, setName] = useState(initialName);
  const nameState = useNativeState(initialName);
  const [shape, setShape] = useState<MaterialShapeName>(initialShape);
  const { ref, close } = useSheetClose(onDismiss);

  const submit = async () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), shape);
    await close();
  };

  return (
    <ModalBottomSheet ref={ref} onDismissRequest={onDismiss} skipPartiallyExpanded>
      <Column modifiers={[padding(24, 0, 24, 24)]} verticalArrangement={{ spacedBy: 16 }}>
        <Text style={{ typography: 'headlineSmall', fontWeight: '600' }}>{title}</Text>
        <OutlinedTextField
          singleLine
          autoFocus
          value={nameState}
          onValueChange={setName}
          keyboardOptions={{ imeAction: 'done', capitalization: 'sentences' }}
          keyboardActions={{ onDone: () => void submit() }}
          modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label>
            <Text>Name</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>
        {showShape ? (
          <Text style={{ typography: 'titleSmall' }} color={colors.onSurfaceVariant}>
            Shape
          </Text>
        ) : null}
        <FlowRow horizontalArrangement={{ spacedBy: 10 }} verticalArrangement={{ spacedBy: 10 }}>
          {(showShape ? PICKABLE_SHAPES : []).map((s) => (
            <MorphingShape
              key={s}
              shape={s}
              morphTo={s}
              morphed={s === shape}
              rotation={45}
              color={s === shape ? colors.primary : colors.surfaceContainerHighest}
              modifiers={[size(48, 48), clickable(() => setShape(s), { indication: false })]}>
              {s === shape ? <Ico name="check" size={20} tint={colors.onPrimary} /> : null}
            </MorphingShape>
          ))}
        </FlowRow>
        <Row modifiers={[fillMaxWidth()]} horizontalArrangement="end">
          <Button onClick={() => void submit()} enabled={!!name.trim()}>
            <Text>{confirmLabel}</Text>
          </Button>
        </Row>
      </Column>
    </ModalBottomSheet>
  );
}

/* ------------------------------- Confirm --------------------------------- */

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onDismiss,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <AlertDialog onDismissRequest={onDismiss}>
      <AlertDialog.Icon>
        <Ico name="delete" />
      </AlertDialog.Icon>
      <AlertDialog.Title>
        <Text>{title}</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <Text>{message}</Text>
      </AlertDialog.Text>
      <AlertDialog.ConfirmButton>
        <TextButton
          onClick={() => {
            onConfirm();
            onDismiss();
          }}>
          <Text>{confirmLabel}</Text>
        </TextButton>
      </AlertDialog.ConfirmButton>
      <AlertDialog.DismissButton>
        <TextButton onClick={onDismiss}>
          <Text>Cancel</Text>
        </TextButton>
      </AlertDialog.DismissButton>
    </AlertDialog>
  );
}

/* ----------------------------- Action sheet ------------------------------ */

export type SheetAction = { icon: import('@/theme/icons').IconName; label: string; run: () => void; destructive?: boolean };

export function ActionSheet({ title, actions, onDismiss }: { title?: string; actions: SheetAction[]; onDismiss: () => void }) {
  const colors = useColors();
  const { ref, close } = useSheetClose(onDismiss);
  return (
    <ModalBottomSheet ref={ref} onDismissRequest={onDismiss}>
      <Column modifiers={[padding(0, 0, 0, 24), verticalScroll()]}>
        {title ? <SheetTitle>{title}</SheetTitle> : null}
        {actions.map((a) => (
          <ListItem
            key={a.label}
            colors={{ containerColor: 'transparent' }}
            modifiers={[
              padding(12, 0, 12, 0),
              clip(Shapes.RoundedCorner(20)),
              clickable(async () => {
                await close();
                a.run();
              }),
            ]}>
            <ListItem.LeadingContent>
              <Ico name={a.icon} tint={a.destructive ? colors.error : colors.onSurfaceVariant} />
            </ListItem.LeadingContent>
            <ListItem.HeadlineContent>
              <Text color={a.destructive ? colors.error : colors.onSurface} style={{ typography: 'bodyLarge' }}>
                {a.label}
              </Text>
            </ListItem.HeadlineContent>
          </ListItem>
        ))}
      </Column>
    </ModalBottomSheet>
  );
}
