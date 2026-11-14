import { useFocusEffect } from 'expo-router';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDbQuery } from '@/db/hooks';
import { type SmartHit, type SmartResults, type SmartScope, smartSearch, type TagWithCount, topTags } from '@/db/repo';
import { ItemRow } from '@/features/collections/ItemViews';
import { HighlightResult } from '@/features/search/HighlightResult';
import { useChromeScroll } from '@/motion/ScrollChrome';
import { useSearchHistory } from '@/state/searchHistory';
import { useColors } from '@/theme/AppTheme';
import { Layout } from '@/theme/tokens';
import { FONT_FAMILY, Type } from '@/theme/type';
import { Button } from '@/ui/Button';
import { ButtonGroup } from '@/ui/ButtonGroup';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { Ico } from '@/ui/Ico';
import { IconButton } from '@/ui/IconButton';
import { LIST_GAP, ListGroup, ListItem, type ListPosition, listCorners, listPosition } from '@/ui/List';
import { CollapsedAppBar, ScreenHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';

/** Typing pauses this long (ms) before the query runs. */
const DEBOUNCE = 150;
const EMPTY: SmartResults = { hits: [], corrected: null };
const NO_TAGS: TagWithCount[] = [];

const SCOPES: { key: SmartScope; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'links', label: 'Links' },
  { key: 'pdfs', label: 'PDFs' },
  { key: 'notes', label: 'Notes' },
  { key: 'highlights', label: 'Highlights' },
];

/**
 * Smart local search (Search tab): FTS5 plus stems, prefixes, synonyms and typo correction,
 * re-ranked by tags, collections and sites. No model and no network.
 */
export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useChromeScroll(scrollY);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SmartScope>('all');
  /** Search exactly what was typed (the "search for … instead" link); reset on a new query. */
  const [exact, setExact] = useState(false);
  const recent = useSearchHistory((s) => s.recent);
  const remember = useSearchHistory((s) => s.remember);
  const forget = useSearchHistory((s) => s.forget);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(text.trim());
      setExact(false);
    }, DEBOUNCE);
    return () => clearTimeout(t);
  }, [text]);

  const { data, loading } = useDbQuery(
    () => (query ? smartSearch(query, { scope, correct: !exact }) : Promise.resolve(EMPTY)),
    [query, scope, exact],
    EMPTY,
  );
  const { data: suggestions } = useDbQuery(() => topTags(5), [], NO_TAGS);

  // A search that found something is kept in history when the user leaves the tab (usually
  // by opening a result), so half-typed queries never land there.
  const latest = useRef({ query, found: 0 });
  useEffect(() => {
    latest.current = { query, found: data.hits.length };
  }, [query, data.hits.length]);
  useFocusEffect(
    useCallback(
      () => () => {
        if (latest.current.query && latest.current.found) remember(latest.current.query);
      },
      [remember],
    ),
  );

  const run = (q: string) => {
    setText(q);
    setQuery(q);
    setExact(false);
    remember(q);
    input.current?.blur();
  };

  const count = data.hits.length;
  const header = (
    <>
      <ScreenHeader
        title="Search"
        subtitle={query && !loading ? `${count === 100 ? '100+' : count} result${count === 1 ? '' : 's'}` : 'Find anything you’ve kept'}
      />
      <View style={[styles.field, { backgroundColor: colors.surfaceContainerHigh }]}>
        <Ico name="search" size={24} color={colors.onSurfaceVariant} />
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => text.trim() && run(text.trim())}
          placeholder="Search your stash"
          placeholderTextColor={colors.onSurfaceVariant}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityRole="search"
          accessibilityLabel="Search your stash"
          style={[styles.input, { color: colors.onSurface, fontFamily: FONT_FAMILY }]}
        />
        {text ? <IconButton icon="close" accessibilityLabel="Clear search" onPress={() => setText('')} size={48} /> : null}
      </View>
      <View style={styles.scopes}>
        <ButtonGroup items={SCOPES} value={scope} onChange={setScope} accessibilityLabel="Search in" />
      </View>
      {query && data.corrected ? (
        <View style={styles.corrected}>
          <Text variant="bodyMedium" color="onSurfaceVariant">
            Showing results for{' '}
            <Text variant="bodyMedium" color="primary" style={{ fontWeight: '700' }}>
              {data.corrected}
            </Text>
          </Text>
          <Button variant="text" size="xs" label={`Search for “${query}” instead`} onPress={() => setExact(true)} style={{ alignSelf: 'flex-start', marginLeft: -12 }} />
        </View>
      ) : null}
    </>
  );

  const idle = (
    <View style={styles.idle}>
      {recent.length > 0 && (
        <>
          <Text variant="titleSmallEmphasized" color="primary" style={styles.section}>
            Recent
          </Text>
          <ListGroup>
            {recent.map((r) => (
              <ListItem
                key={r}
                title={r}
                onPress={() => run(r)}
                accessibilityLabel={`Search for ${r}`}
                leading={<Ico name="history" size={22} color={colors.onSurfaceVariant} />}
                trailing={<IconButton icon="close" accessibilityLabel={`Remove ${r} from recent searches`} onPress={() => forget(r)} size={40} />}
              />
            ))}
          </ListGroup>
        </>
      )}
      {suggestions.length > 0 && (
        <>
          <Text variant="titleSmallEmphasized" color="primary" style={[styles.section, { marginTop: recent.length ? 20 : 4 }]}>
            Try
          </Text>
          <View style={styles.chips}>
            {suggestions.map((t) => (
              <Chip key={t.id} label={`#${t.name}`} icon="sell" onPress={() => run(t.name)} accessibilityLabel={`Search for ${t.name}`} />
            ))}
          </View>
        </>
      )}
      {!recent.length && !suggestions.length && (
        <EmptyState
          shape="cookie9Sided"
          title="Search smarter"
          body="Finds close spellings, related words and matches in tags, collections and sites."
        />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Animated.FlatList
        data={query ? data.hits : []}
        keyExtractor={(h) => h.key}
        renderItem={({ item, index }) => <ResultRow hit={item} position={listPosition(index, data.hits.length)} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !query ? (
            idle
          ) : loading ? undefined : (
            <EmptyState
              shape="clover4Leaf"
              title="Nothing found"
              body={`No matches for “${query}”${scope === 'all' ? '' : ' here'}. Try another word${scope === 'all' ? '' : ', or search All'}.`}
            />
          )
        }
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: Layout.navBarClearance + insets.bottom }}
        initialNumToRender={10}
        windowSize={7}
      />
      <CollapsedAppBar title="Search" scrollY={scrollY} />
    </View>
  );
}

function ResultRow({ hit, position }: { hit: SmartHit; position: ListPosition }) {
  return (
    <View style={[styles.result, hit.why && position !== 'last' && position !== 'single' ? { paddingBottom: 6 } : null]}>
      {hit.kind === 'bookmark' ? <ItemRow b={hit.b} corners={listCorners(position)} /> : <HighlightResult h={hit.h} />}
      {hit.why ? (
        <Text variant="labelMedium" color="onSurfaceVariant" numberOfLines={1} style={styles.why}>
          {hit.why}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginHorizontal: Layout.gutter,
    marginTop: 16,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 20,
    paddingRight: 4,
  },
  input: { flex: 1, ...Type.bodyLarge, paddingVertical: 0 },
  scopes: { paddingHorizontal: Layout.gutter, paddingTop: 16, paddingBottom: 8 },
  corrected: { paddingHorizontal: Layout.textInset, paddingTop: 4 },
  idle: { paddingHorizontal: Layout.gutter, paddingTop: 8 },
  section: { marginBottom: 8, paddingHorizontal: 8 },
  recent: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 4, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  result: { paddingHorizontal: Layout.gutter, paddingBottom: LIST_GAP },
  why: { paddingHorizontal: 12, paddingTop: 4 },
});
