import { Column, IconButton } from '@expo/ui/jetpack-compose';
import { fillMaxSize, weight } from '@expo/ui/jetpack-compose/modifiers';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { BookmarkCollection } from '@/components/BookmarkCollection';
import { HighlightCard } from '@/components/HighlightCard';
import { Ico } from '@/components/Ico';
import { ActionSheet, ConfirmDialog, NameShapeSheet } from '@/components/sheets';
import { TopBar } from '@/components/TopBar';
import { useDbQuery } from '@/db/hooks';
import { deleteTag, listTags, queryBookmarks, queryHighlights, renameTag } from '@/db/repo';
import { AppHost } from '@/theme/AppTheme';

type Sheet = 'menu' | 'rename' | 'delete' | null;

export default function TagScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sheet, setSheet] = useState<Sheet>(null);
  const { data: tags } = useDbQuery(listTags, [], []);
  const tag = tags.find((t) => t.id === id);
  const { data: items } = useDbQuery(() => queryBookmarks({ tagIds: [id] }), [id], []);
  const { data: hl } = useDbQuery(() => queryHighlights({ tagId: id }), [id], []);

  return (
    <AppHost style={{ flex: 1 }}>
      <Column modifiers={[fillMaxSize()]}>
        <TopBar
          title={tag ? `#${tag.name}` : ''}
          actions={
            <IconButton onClick={() => setSheet('menu')}>
              <Ico name="moreVert" label="More" />
            </IconButton>
          }
        />
        <Column modifiers={[weight(1)]}>
          <BookmarkCollection
            items={items}
            topInset={0}
            header={hl.map((h) => (
              <HighlightCard key={h.id} highlight={h} />
            ))}
            empty={hl.length ? undefined : { icon: 'sell', shape: 'sunny', title: 'Nothing tagged', body: 'Tag bookmarks and highlights to group them here.' }}
          />
        </Column>
      </Column>
      {sheet === 'menu' && tag ? (
        <ActionSheet
          title={`#${tag.name}`}
          onDismiss={() => setSheet(null)}
          actions={[
            { icon: 'edit', label: 'Rename tag', run: () => setSheet('rename') },
            { icon: 'delete', label: 'Delete tag', destructive: true, run: () => setSheet('delete') },
          ]}
        />
      ) : null}
      {sheet === 'rename' && tag ? (
        <NameShapeSheet
          title="Rename tag"
          showShape={false}
          initialName={tag.name}
          confirmLabel="Save"
          onDismiss={() => setSheet(null)}
          onSubmit={(name) => void renameTag(id, name)}
        />
      ) : null}
      {sheet === 'delete' && tag ? (
        <ConfirmDialog
          title={`Delete #${tag.name}?`}
          message="The tag is removed from every item. Items themselves are kept."
          onDismiss={() => setSheet(null)}
          onConfirm={() => void deleteTag(id).then(() => router.back())}
        />
      ) : null}
    </AppHost>
  );
}
