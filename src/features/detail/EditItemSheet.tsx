import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { type BookmarkWithTags, updateBookmark } from '@/db/repo';
import { cardKind } from '@/features/stash/model';
import { haptic } from '@/motion/haptics';
import { useColors } from '@/theme/AppTheme';
import { FONT_FAMILY, Type } from '@/theme/type';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';

/**
 * Edit an item's name (title, image or file name) and, for links, its address. Only Save,
 * Cancel or Back close it, so a stray tap never loses the typing.
 */
export function EditItemSheet({ b, onDismiss }: { b: BookmarkWithTags; onDismiss: () => void }) {
  const colors = useColors();
  const kind = cardKind(b);
  const [title, setTitle] = useState(b.title ?? '');
  const [url, setUrl] = useState(b.url ?? '');
  const nameLabel = kind === 'image' ? 'Image name' : kind === 'pdf' || kind === 'file' || kind === 'textfile' || kind === 'markdown' ? 'File name' : 'Title';

  const save = async (close: () => void) => {
    const t = title.trim();
    const u = url.trim();
    if (b.url && !/^https?:\/\/\S+$/i.test(u)) {
      showSnackbar('That doesn’t look like a link');
      return;
    }
    await updateBookmark(b.id, { title: t || b.title, ...(b.url ? { url: u } : {}) });
    haptic.save();
    showSnackbar('Saved');
    close();
  };

  const field = [styles.input, Type.bodyLarge, { color: colors.onSurface, fontFamily: FONT_FAMILY, backgroundColor: colors.surfaceContainerHigh }];

  return (
    <Sheet accessibilityLabel="Edit item" onDismiss={onDismiss} persistent>
      {(close) => (
        <View style={{ gap: 12 }}>
          <Text variant="titleLargeEmphasized" style={{ paddingHorizontal: 4 }}>
            Edit
          </Text>
          <Text variant="labelLarge" color="primary" style={styles.label}>
            {nameLabel}
          </Text>
          <TextInput value={title} onChangeText={setTitle} autoFocus selectTextOnFocus accessibilityLabel={nameLabel} style={field} />
          {b.url ? (
            <>
              <Text variant="labelLarge" color="primary" style={styles.label}>
                Link
              </Text>
              <TextInput
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="Link"
                style={field}
              />
            </>
          ) : null}
          <View style={styles.actions}>
            <Button
              label="Cancel"
              variant="text"
              onPress={() => {
                haptic.cancel();
                close();
              }}
            />
            <Button label="Save" onPress={() => void save(close)} />
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { paddingHorizontal: 8, marginBottom: -4 },
  input: { height: 56, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 0 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
});
