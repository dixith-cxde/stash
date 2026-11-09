import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxSize, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { BookmarkCollection } from '@/components/BookmarkCollection';
import { TopBar } from '@/components/TopBar';
import { useDbQuery } from '@/db/hooks';
import { queryBookmarks } from '@/db/repo';
import type { SmartFilter } from '@/db/schema';
import { AppHost } from '@/theme/AppTheme';

/** Generic filtered feed: Favorites, Unread, Archive, … */
export default function BrowseScreen() {
  const { title, filter } = useLocalSearchParams<{ title: string; filter: string }>();
  const parsed = useMemo<SmartFilter>(() => {
    try {
      return JSON.parse(filter ?? '{}');
    } catch {
      return {};
    }
  }, [filter]);
  const { data } = useDbQuery(() => queryBookmarks(parsed), [parsed], []);

  return (
    <AppHost style={{ flex: 1 }}>
      <Column modifiers={[fillMaxSize()]}>
        <TopBar title={title} />
        <Column modifiers={[weight(1)]}>
          <BookmarkCollection
            items={data}
            topInset={0}
            empty={{ icon: 'bookmarks', shape: 'ghostish', title: 'Nothing here', body: 'Items matching this view will appear here.' }}
          />
        </Column>
      </Column>
    </AppHost>
  );
}
