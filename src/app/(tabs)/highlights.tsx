import {
  Box,
  ExtendedFloatingActionButton,
  FilterChip,
  LazyColumn,
  LazyRow,
  Text,
} from '@expo/ui/jetpack-compose';
import { align, fillMaxSize, fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyView } from '@/components/BookmarkCollection';
import { HighlightCard } from '@/components/HighlightCard';
import { Ico } from '@/components/Ico';
import { useDbQuery } from '@/db/hooks';
import { listTags, queryHighlights } from '@/db/repo';
import { plural } from '@/lib/format';
import { useCapture } from '@/state/capture';
import { AppHost, useColors } from '@/theme/AppTheme';

export default function HighlightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tagId, setTagId] = useState<string | null>(null);
  const { data: highlights } = useDbQuery(() => queryHighlights({ tagId: tagId ?? undefined }), [tagId], []);
  const { data: tags } = useDbQuery(listTags, [], []);

  const pasteQuote = async () => {
    const text = (await Clipboard.getStringAsync())?.trim();
    useCapture.getState().setDrafts([{ kind: 'highlight', text: text ?? '' }]);
    router.push('/capture');
  };

  return (
    <AppHost style={{ flex: 1 }}>
      <Box modifiers={[fillMaxSize()]}>
        <LazyColumn modifiers={[fillMaxSize()]} contentPadding={{ top: insets.top, bottom: 120 }}>
          <Text style={{ typography: 'displaySmall', fontWeight: '700', letterSpacing: -0.5 }} modifiers={[padding(24, 20, 24, 0)]}>
            Highlights
          </Text>
          <Text color={colors.onSurfaceVariant} style={{ typography: 'titleSmall' }} modifiers={[padding(24, 0, 24, 12)]}>
            {highlights.length ? plural(highlights.length, 'highlight') : 'Select text in any app → Save to Stash'}
          </Text>
          {tags.length ? (
            <LazyRow horizontalArrangement={{ spacedBy: 8 }} contentPadding={{ start: 16, end: 16 }} modifiers={[fillMaxWidth(), padding(0, 0, 0, 8)]}>
              <FilterChip selected={tagId === null} onClick={() => setTagId(null)}>
                <FilterChip.Label>
                  <Text>All</Text>
                </FilterChip.Label>
              </FilterChip>
              {tags.map((t) => (
                <FilterChip key={t.id} selected={tagId === t.id} onClick={() => setTagId(tagId === t.id ? null : t.id)}>
                  <FilterChip.Label>
                    <Text>{`#${t.name}`}</Text>
                  </FilterChip.Label>
                </FilterChip>
              ))}
            </LazyRow>
          ) : null}
          {!highlights.length ? (
            <EmptyView
              icon="inkHighlighter"
              shape="softBurst"
              title="No highlights yet"
              body="Select text in Chrome, a PDF reader or any app, then choose “Save to Stash” from the menu."
            />
          ) : null}
          <LazyColumn.Items data={highlights} keyExtractor={(h) => h.id} estimatedItemSize={180}>
            {({ item }) => <HighlightCard highlight={item} />}
          </LazyColumn.Items>
        </LazyColumn>
        <ExtendedFloatingActionButton onClick={() => void pasteQuote()} modifiers={[align('bottomEnd'), padding(0, 0, 16, 16)]}>
          <ExtendedFloatingActionButton.Icon>
            <Ico name="formatQuote" />
          </ExtendedFloatingActionButton.Icon>
          <ExtendedFloatingActionButton.Text>
            <Text>New quote</Text>
          </ExtendedFloatingActionButton.Text>
        </ExtendedFloatingActionButton>
      </Box>
    </AppHost>
  );
}
