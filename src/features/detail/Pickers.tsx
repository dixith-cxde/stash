import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useDbQuery } from '@/db/hooks';
import { ensureTag, listTags, normalizeTagName } from '@/db/repo';
import { folderIcon, folderSeed } from '@/features/stash/model';
import { useCollections } from '@/features/stash/queries';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones } from '@/theme/palette';
import { FONT_FAMILY, Type } from '@/theme/type';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Ico } from '@/ui/Ico';
import { PressableSurface } from '@/ui/PressableSurface';
import { Sheet, SheetScrollView } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

/** Pick (or clear) the collection an item belongs to. */
export function CollectionPicker({
  current,
  onPick,
  onDismiss,
}: {
  current: string | null;
  onPick: (folderId: string | null) => void;
  onDismiss: () => void;
}) {
  const { colors, dark } = useAppTheme();
  const { data: collections } = useCollections();
  return (
    <Sheet accessibilityLabel="Move to collection" onDismiss={onDismiss}>
      {(close) => (
        <View style={{ gap: 4, flexShrink: 1 }}>
          <Text variant="headlineSmall" style={{ paddingHorizontal: 8, paddingBottom: 12 }}>
            Move to
          </Text>
          <SheetScrollView contentContainerStyle={{ gap: 4 }}>
            {[{ id: null, name: 'No collection' }, ...collections].map((c) => {
              const tone = c.id ? collectionTones(folderSeed(c as { id: string; color: string | null }), dark) : null;
              const selected = c.id === current;
              return (
                <PressableSurface
                  key={c.id ?? 'none'}
                  corner={20}
                  pressedScale={0.98}
                  onPress={() => {
                    onPick(c.id);
                    close();
                  }}
                  accessibilityState={{ selected }}
                  style={{
                    height: 60,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 10,
                    backgroundColor: selected ? colors.secondaryContainer : 'transparent',
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: tone?.container ?? colors.surfaceContainerHighest,
                    }}
                  >
                    <Ico
                      name={'icon' in c ? folderIcon(c as { icon: string | null }) : 'folderOpen'}
                      size={20}
                      color={tone?.onContainer ?? colors.onSurfaceVariant}
                    />
                  </View>
                  <Text variant="labelLarge" style={{ flex: 1 }} numberOfLines={1}>
                    {c.name}
                  </Text>
                  {selected && <Ico name="check" size={22} color={colors.primary} />}
                </PressableSurface>
              );
            })}
          </SheetScrollView>
        </View>
      )}
    </Sheet>
  );
}

/** Toggle existing tags or create a new one. */
export function TagPicker({
  selected,
  onChange,
  onDismiss,
}: {
  selected: string[];
  onChange: (tagIds: string[]) => void;
  onDismiss: () => void;
}) {
  const { colors } = useAppTheme();
  const { data: tags } = useDbQuery(listTags, [], []);
  const [draft, setDraft] = useState('');
  const visible = tags.filter((t) => t.name !== 'sample' || selected.includes(t.id));
  const add = async () => {
    const name = normalizeTagName(draft);
    if (!name) return;
    const id = await ensureTag(name);
    setDraft('');
    if (!selected.includes(id)) onChange([...selected, id]);
  };
  return (
    <Sheet accessibilityLabel="Tags" onDismiss={onDismiss}>
      {(close) => (
        <View style={{ gap: 16, flexShrink: 1 }}>
          <Text variant="headlineSmall" style={{ paddingHorizontal: 8 }}>
            Tags
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              height: 56,
              borderRadius: 28,
              paddingLeft: 20,
              paddingRight: 6,
              backgroundColor: colors.surfaceContainerHigh,
            }}
          >
            <Text variant="bodyLarge" color="onSurfaceVariant">
              #
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="New tag"
              placeholderTextColor={colors.onSurfaceVariant}
              onSubmitEditing={() => void add()}
              autoCapitalize="none"
              returnKeyType="done"
              accessibilityLabel="New tag name"
              style={{ flex: 1, color: colors.onSurface, fontFamily: FONT_FAMILY, ...Type.bodyLarge, paddingVertical: 0 }}
            />
            {draft.trim() ? <Button label="Add" size="s" onPress={() => void add()} /> : null}
          </View>
          <SheetScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          >
            {visible.map((t) => {
              const on = selected.includes(t.id);
              return (
                <Chip
                  key={t.id}
                  label={`#${t.name}`}
                  selected={on}
                  onPress={() => onChange(on ? selected.filter((x) => x !== t.id) : [...selected, t.id])}
                />
              );
            })}
          </SheetScrollView>
          <Button label="Done" onPress={close} />
        </View>
      )}
    </Sheet>
  );
}
