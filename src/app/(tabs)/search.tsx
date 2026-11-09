import { FilterChip, LazyRow, OutlinedTextField, Text, type TextFieldRef } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BookmarkCollection } from '@/components/BookmarkCollection';
import { HighlightCard } from '@/components/HighlightCard';
import { Ico } from '@/components/Ico';
import { useDbQuery } from '@/db/hooks';
import { search, type SearchResults } from '@/db/repo';
import { BOOKMARK_TYPES, type BookmarkType } from '@/db/schema';
import { AppHost, useColors } from '@/theme/AppTheme';
import { TYPE_META } from '@/theme/types';

const EMPTY: SearchResults = { bookmarks: [], highlights: [] };

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function SearchScreen() {
  const colors = useColors();
  const field = useRef<TextFieldRef>(null);
  const [text, setText] = useState('');
  const [types, setTypes] = useState<BookmarkType[]>([]);
  const query = useDebounced(text, 180);
  const { data } = useDbQuery(() => (query.trim() ? search(query, { types }) : Promise.resolve(EMPTY)), [query, types], EMPTY);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => void field.current?.focus(), 250);
      return () => clearTimeout(t);
    }, []),
  );

  const hasQuery = !!query.trim();
  const header = [
    <OutlinedTextField
      key="field"
      ref={field}
      singleLine
      onValueChange={setText}
      keyboardOptions={{ imeAction: 'search', autoCorrectEnabled: false }}
      modifiers={[fillMaxWidth(), padding(16, 16, 16, 8)]}>
      <OutlinedTextField.Placeholder>
        <Text>Search everything</Text>
      </OutlinedTextField.Placeholder>
      <OutlinedTextField.LeadingIcon>
        <Ico name="search" />
      </OutlinedTextField.LeadingIcon>
    </OutlinedTextField>,
    <LazyRow key="types" horizontalArrangement={{ spacedBy: 8 }} contentPadding={{ start: 16, end: 16 }} modifiers={[fillMaxWidth()]}>
      {BOOKMARK_TYPES.map((t) => {
        const on = types.includes(t);
        return (
          <FilterChip key={t} selected={on} onClick={() => setTypes(on ? types.filter((x) => x !== t) : [...types, t])}>
            <FilterChip.LeadingIcon>
              <Ico name={on ? 'check' : TYPE_META[t].icon} size={18} />
            </FilterChip.LeadingIcon>
            <FilterChip.Label>
              <Text>{TYPE_META[t].plural}</Text>
            </FilterChip.Label>
          </FilterChip>
        );
      })}
    </LazyRow>,
    ...(data.highlights.length
      ? [
          <Text key="hl-h" style={{ typography: 'titleSmall', fontWeight: '700' }} color={colors.primary} modifiers={[padding(24, 16, 24, 8)]}>
            {`HIGHLIGHTS · ${data.highlights.length}`}
          </Text>,
          ...data.highlights.slice(0, 20).map((h) => <HighlightCard key={h.id} highlight={h} />),
        ]
      : []),
    ...(data.bookmarks.length
      ? [
          <Text key="bm-h" style={{ typography: 'titleSmall', fontWeight: '700' }} color={colors.primary} modifiers={[padding(24, 16, 24, 8)]}>
            {`SAVED · ${data.bookmarks.length}`}
          </Text>,
        ]
      : []),
  ];

  return (
    <AppHost style={{ flex: 1 }}>
      <BookmarkCollection
        items={data.bookmarks}
        header={header}
        bottomInset={0}
        empty={
          hasQuery && !data.highlights.length
            ? { icon: 'search', shape: 'ghostish', title: 'No results', body: `Nothing matches “${query.trim()}”. Try fewer words.` }
            : hasQuery
              ? undefined
              : { icon: 'search', shape: 'cookie7Sided', title: 'Find anything', body: 'Searches titles, page descriptions, notes, PDF names and highlight text.' }
        }
      />
    </AppHost>
  );
}
