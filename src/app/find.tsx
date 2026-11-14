import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { search, type SearchResults } from '@/db/repo';
import { ItemRow } from '@/features/collections/ItemViews';
import { HighlightResult } from '@/features/search/HighlightResult';
import { TransitionScreen, useTransitionClose } from '@/motion/transition/TransitionScreen';
import { useAppTheme } from '@/theme/AppTheme';
import { FONT_FAMILY, Type } from '@/theme/type';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

/** Typing pauses this long (ms) before the query runs, so each keystroke doesn't hit SQLite. */
const DEBOUNCE = 120;
const EMPTY: SearchResults = { bookmarks: [], highlights: [] };

/**
 * Keyword search (Home pill): instant FTS5 over titles, text, notes, sites and highlights,
 * ranked by bm25. Not designed on the canvas; built from the kit. The pill grows into it.
 */
export default function FindScreen() {
  const { origin } = useLocalSearchParams<{ origin?: string }>();
  return (
    <TransitionScreen kind="container" origin={origin}>
      <FindBody />
    </TransitionScreen>
  );
}

function FindBody() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const close = useTransitionClose();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), DEBOUNCE);
    return () => clearTimeout(t);
  }, [text]);

  const { data, loading } = useDbQuery(() => (query ? search(query) : Promise.resolve(EMPTY)), [query], EMPTY);
  const count = data.bookmarks.length + data.highlights.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
      <View style={[styles.field, { backgroundColor: colors.surfaceContainerHigh }]}>
        <IconButton icon="arrowBack" accessibilityLabel="Back" onPress={close} size={48} />
        <TextInput
          value={text}
          onChangeText={setText}
          autoFocus
          placeholder="Search your stash"
          placeholderTextColor={colors.onSurfaceVariant}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search your stash"
          style={{ flex: 1, color: colors.onSurface, fontFamily: FONT_FAMILY, ...Type.bodyLarge, paddingVertical: 0 }}
        />
        {text ? <IconButton icon="close" accessibilityLabel="Clear" onPress={() => setText('')} size={48} /> : null}
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 32, gap: 8 }}
      >
        {!query ? (
          <EmptyState shape="cookie9Sided" title="Find it again" body="Search titles, notes, sites, tags and highlights." />
        ) : !loading && count === 0 ? (
          <EmptyState shape="clover4Leaf" title="Nothing found" body={`No matches for “${query}”. Try fewer words, or the Search tab for looser matches.`} />
        ) : (
          <>
            {data.bookmarks.length > 0 && (
              <Text variant="titleSmallEmphasized" color="primary" style={styles.section}>
                {`Items · ${data.bookmarks.length}`}
              </Text>
            )}
            {data.bookmarks.map((b) => (
              <ItemRow key={b.id} b={b} />
            ))}
            {data.highlights.length > 0 && (
              <Text variant="titleSmallEmphasized" color="primary" style={styles.section}>
                {`Highlights · ${data.highlights.length}`}
              </Text>
            )}
            {data.highlights.map((h) => (
              <HighlightResult key={h.id} h={h} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginHorizontal: 16, height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  section: { marginTop: 12, marginBottom: 4, paddingHorizontal: 8 },
});
