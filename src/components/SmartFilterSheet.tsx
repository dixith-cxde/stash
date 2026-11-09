import {
  Button,
  Column,
  FilterChip,
  FlowRow,
  ListItem,
  ModalBottomSheet,
  type ModalBottomSheetRef,
  OutlinedTextField,
  Row,
  Switch,
  Text,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, horizontalScroll, padding, verticalScroll } from '@expo/ui/jetpack-compose/modifiers';
import { useRef, useState } from 'react';

import { useDbQuery } from '@/db/hooks';
import { listTags } from '@/db/repo';
import { BOOKMARK_TYPES, type BookmarkType, type SmartFilter } from '@/db/schema';
import { useColors } from '@/theme/AppTheme';
import { TYPE_META } from '@/theme/types';

import { ConnectedButtonGroup } from '../../modules/expressive';
import { Ico } from './Ico';

const WINDOWS = [
  { key: 'any', label: 'Any time' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
];

/** Builds a SmartFilter: types, tags (AND), favorite/unread toggles, recency and keywords. */
export function SmartFilterSheet({
  title,
  initialName,
  initial,
  onDismiss,
  onSubmit,
}: {
  title: string;
  initialName?: string;
  initial?: SmartFilter;
  onDismiss: () => void;
  onSubmit: (name: string, filter: SmartFilter) => void;
}) {
  const colors = useColors();
  const ref = useRef<ModalBottomSheetRef>(null);
  const { data: tags } = useDbQuery(listTags, [], []);
  const [name, setName] = useState(initialName ?? '');
  const nameState = useNativeState(initialName ?? '');
  const queryState = useNativeState(initial?.query ?? '');
  const [f, setF] = useState<SmartFilter>(initial ?? {});

  const toggleTag = (tagId: string) =>
    setF((cur) => {
      const set = new Set(cur.tagIds ?? []);
      if (set.has(tagId)) set.delete(tagId);
      else set.add(tagId);
      return { ...cur, tagIds: [...set] };
    });

  const submit = async () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), { ...f, query: f.query?.trim() || undefined });
    await ref.current?.hide();
    onDismiss();
  };

  return (
    <ModalBottomSheet ref={ref} onDismissRequest={onDismiss} skipPartiallyExpanded>
      <Column modifiers={[padding(24, 0, 24, 24), verticalScroll()]} verticalArrangement={{ spacedBy: 16 }}>
        <Text style={{ typography: 'headlineSmall', fontWeight: '600' }}>{title}</Text>
        <OutlinedTextField singleLine value={nameState} onValueChange={setName} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label>
            <Text>List name</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>

        <Text style={{ typography: 'titleSmall' }} color={colors.onSurfaceVariant}>
          Types
        </Text>
        <Row modifiers={[horizontalScroll()]}>
          <ConnectedButtonGroup
            multiSelect
            fillWidth={false}
            options={BOOKMARK_TYPES.map((t) => ({
              key: t,
              label: TYPE_META[t].plural,
              icon: <Ico name={TYPE_META[t].icon} size={18} />,
            }))}
            selected={f.types ?? []}
            onSelectionChange={(keys) => setF((cur) => ({ ...cur, types: keys as BookmarkType[] }))}
          />
        </Row>

        <Text style={{ typography: 'titleSmall' }} color={colors.onSurfaceVariant}>
          Saved within
        </Text>
        <ConnectedButtonGroup
          options={WINDOWS}
          selected={[f.withinDays ? String(f.withinDays) : 'any']}
          onSelectionChange={([k]) => setF((cur) => ({ ...cur, withinDays: k && k !== 'any' ? Number(k) : undefined }))}
        />

        {tags.length ? (
          <>
            <Text style={{ typography: 'titleSmall' }} color={colors.onSurfaceVariant}>
              Must have all tags
            </Text>
            <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 4 }}>
              {tags.map((t) => (
                <FilterChip key={t.id} selected={!!f.tagIds?.includes(t.id)} onClick={() => toggleTag(t.id)}>
                  <FilterChip.Label>
                    <Text>{`#${t.name}`}</Text>
                  </FilterChip.Label>
                </FilterChip>
              ))}
            </FlowRow>
          </>
        ) : null}

        <OutlinedTextField
          singleLine
          value={queryState}
          onValueChange={(q) => setF((cur) => ({ ...cur, query: q }))}
          modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label>
            <Text>Contains words (optional)</Text>
          </OutlinedTextField.Label>
          <OutlinedTextField.LeadingIcon>
            <Ico name="search" size={20} />
          </OutlinedTextField.LeadingIcon>
        </OutlinedTextField>

        <Column>
          <ListItem colors={{ containerColor: 'transparent' }}>
            <ListItem.HeadlineContent>
              <Text>Favorites only</Text>
            </ListItem.HeadlineContent>
            <ListItem.TrailingContent>
              <Switch value={!!f.favorite} onCheckedChange={(v) => setF((cur) => ({ ...cur, favorite: v || undefined }))} />
            </ListItem.TrailingContent>
          </ListItem>
          <ListItem colors={{ containerColor: 'transparent' }}>
            <ListItem.HeadlineContent>
              <Text>Unread only</Text>
            </ListItem.HeadlineContent>
            <ListItem.TrailingContent>
              <Switch value={!!f.unread} onCheckedChange={(v) => setF((cur) => ({ ...cur, unread: v || undefined }))} />
            </ListItem.TrailingContent>
          </ListItem>
        </Column>

        <Row modifiers={[fillMaxWidth()]} horizontalArrangement="end">
          <Button onClick={() => void submit()} enabled={!!name.trim()}>
            <Text>Save</Text>
          </Button>
        </Row>
      </Column>
    </ModalBottomSheet>
  );
}
