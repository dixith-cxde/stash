import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { useDbQuery } from '@/db/hooks';
import { createFolder, getFolder, updateFolder } from '@/db/repo';
import { COLLECTION_ICONS, folderIcon } from '@/features/stash/model';
import { haptic } from '@/motion/haptics';
import { useSelection } from '@/motion/useSelection';
import { Shape } from '@/shapes/Shape';
import { useAppTheme } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { COLLECTION_SEEDS, collectionTones } from '@/theme/palette';
import { FONT_FAMILY, Type } from '@/theme/type';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { PressableSurface } from '@/ui/PressableSurface';
import { Sheet, SheetScrollView } from '@/ui/Sheet';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';

/**
 * New collection (or edit one, with `?id=`): a live preview card in the chosen tone, then
 * name, color and icon. Created collections open right away.
 */
export default function NewCollection() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: folder, loading } = useDbQuery(() => (id ? getFolder(id) : Promise.resolve(undefined)), [id], undefined);
  if (id && loading) return null;
  return <Editor key={folder?.id ?? 'new'} folder={folder ?? null} />;
}

function Editor({ folder }: { folder: { id: string; name: string; color: string | null; icon: string | null } | null }) {
  const { colors, dark } = useAppTheme();
  const [name, setName] = useState(folder?.name ?? '');
  // A new collection starts on a random palette color.
  const [seed, setSeed] = useState(() => folder?.color ?? COLLECTION_SEEDS[Math.floor(Math.random() * COLLECTION_SEEDS.length)]);
  const [icon, setIcon] = useState<IconName>(folder ? folderIcon(folder) : 'folder');
  const tone = collectionTones(seed, dark);
  const editing = !!folder;

  // Set once a new collection is created; the sheet opens it after it has fully closed.
  const created = useRef<string | null>(null);
  const saving = useRef(false);

  const save = async (close: () => void) => {
    const n = name.trim();
    if (!n || saving.current) return;
    saving.current = true;
    // Put the keyboard away first, so the sheet slides fully off screen instead of stopping
    // behind it.
    Keyboard.dismiss();
    if (folder) {
      await updateFolder(folder.id, { name: n, color: seed, icon });
      haptic.save();
      showSnackbar('Collection updated');
      close();
      return;
    }
    created.current = await createFolder({ name: n, color: seed, icon });
    haptic.save();
    close();
  };

  // Runs once the sheet has animated away. Pop this route first, then open the new
  // collection: pushing while the sheet was still up stacked the page on top of the sheet,
  // which then stayed open (with its old name and color) underneath.
  const onDismiss = () => {
    Keyboard.dismiss();
    router.back();
    const newId = created.current;
    if (newId) setTimeout(() => router.push({ pathname: '/collection/[id]', params: { id: newId } }), 0);
  };

  return (
    <Sheet accessibilityLabel={editing ? 'Edit collection' : 'New collection'} onDismiss={onDismiss}>
      {(close) => (
        <View style={{ gap: 16, flexShrink: 1 }}>
          <Text variant="headlineSmallEmphasized" style={{ paddingHorizontal: 8 }}>
            {editing ? 'Edit collection' : 'New collection'}
          </Text>

          <View style={[styles.field, { backgroundColor: colors.surfaceContainerHighest }]}>
            <TextInput
              value={name}
              onChangeText={setName}
              autoFocus={!editing}
              placeholder="Name"
              placeholderTextColor={colors.onSurfaceVariant}
              // Enter only puts the keyboard away; the collection is made with the button.
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              maxLength={60}
              accessibilityLabel="Collection name"
              style={{ flex: 1, color: colors.onSurface, fontFamily: FONT_FAMILY, ...Type.bodyLarge, paddingVertical: 0 }}
            />
          </View>

          <SheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
          <View style={[styles.preview, { backgroundColor: tone.container }]}>
            <View style={styles.previewDecor} pointerEvents="none">
              <Shape name="cookie9Sided" size={180} color={tone.accent} />
            </View>
            <View style={[styles.previewIcon, { backgroundColor: tone.onContainer }]}>
              <Ico name={icon} size={24} color={tone.container} />
            </View>
            <Text variant="headlineSmallEmphasized" color={tone.onContainer} numberOfLines={1} style={{ fontWeight: '700', marginTop: 12 }}>
              {name.trim() || 'Untitled'}
            </Text>
          </View>

          <Text variant="titleSmallEmphasized" color="primary" style={{ paddingHorizontal: 8 }}>
            Color
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0, flexShrink: 0 }}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 4, paddingVertical: 2 }}
          >
            {COLLECTION_SEEDS.map((s) => (
              <Swatch key={s} color={collectionTones(s, dark).container} selected={s === seed} onPress={() => setSeed(s)} />
            ))}
          </ScrollView>

          <Text variant="titleSmallEmphasized" color="primary" style={{ paddingHorizontal: 8 }}>
            Icon
          </Text>
          <View style={styles.icons}>
            {COLLECTION_ICONS.map((i) => (
              <IconChoice key={i} icon={i} selected={i === icon} tone={tone} onPress={() => setIcon(i)} />
            ))}
          </View>
          </SheetScrollView>

          <Button label={editing ? 'Save' : 'Create collection'} icon={editing ? 'check' : 'add'} disabled={!name.trim()} onPress={() => void save(close)} />
        </View>
      )}
    </Sheet>
  );
}

/** A color choice: circle at rest, rounded square with a check when chosen (fastSpatial). */
function Swatch({ color, selected, onPress }: { color: string; selected: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const sel = useSelection(selected);
  const shape = useAnimatedStyle(() => ({ borderRadius: 22 - 8 * sel.shape.get() }));
  return (
    <PressableSurface corner={0} pressedScale={0.9} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel="Color" style={{ backgroundColor: 'transparent', overflow: 'visible' }}>
      <Animated.View style={[styles.swatch, { backgroundColor: color, borderColor: selected ? colors.onSurface : 'transparent' }, shape]}>
        {selected && <Ico name="check" size={20} color={colors.onSurface} />}
      </Animated.View>
    </PressableSurface>
  );
}

function IconChoice({ icon, selected, tone, onPress }: { icon: IconName; selected: boolean; tone: { container: string; onContainer: string }; onPress: () => void }) {
  const { colors } = useAppTheme();
  const sel = useSelection(selected);
  const style = useAnimatedStyle(() => ({
    borderRadius: 26 - 12 * sel.shape.get(),
    backgroundColor: interpolateColor(sel.color.get(), [0, 1], [colors.surfaceContainerHigh, tone.container]),
  }));
  return (
    <PressableSurface corner={0} pressedScale={0.9} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={icon} style={{ backgroundColor: 'transparent', overflow: 'visible' }}>
      <Animated.View style={[styles.iconChoice, style]}>
        <Ico name={icon} size={22} color={selected ? tone.onContainer : colors.onSurfaceVariant} />
      </Animated.View>
    </PressableSurface>
  );
}

const styles = StyleSheet.create({
  preview: { height: 132, borderRadius: 28, padding: 18, justifyContent: 'flex-end', overflow: 'hidden' },
  previewDecor: { position: 'absolute', right: -50, top: -60 },
  previewIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  field: { height: 56, borderRadius: 28, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  swatch: { width: 44, height: 44, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4 },
  iconChoice: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
});
