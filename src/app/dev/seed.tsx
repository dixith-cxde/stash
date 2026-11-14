import { inArray } from 'drizzle-orm';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { db } from '@/db/client';
import { invalidateQueries } from '@/db/hooks';
import { createBookmark, createFolder, createHighlight, ensureTag, setBookmarkTags } from '@/db/repo';
import { bookmarks, bookmarkTags, folders, highlights, tags } from '@/db/schema';
import { useColors } from '@/theme/AppTheme';
import { Text } from '@/ui/Text';

const NOTE = `Notes for the **M3 Expressive** talk on _Friday_.

## Opening
> Expressive design is about making people feel something, while staying usable.

## Points to cover
- [x] Shape library: 35 forms
- [x] Spring motion vs easing curves
- [ ] Type scale changes
- [ ] Demo from [[Inside Google’s Material 3 Expressive redesign]]

## Snippet
\`\`\`css
.press:active { border-radius: 14px; }
\`\`\`
`;

const SAMPLE_FOLDERS = [
  { name: 'Research', color: '#6750A4', icon: 'menuBook' },
  { name: 'Read later', color: '#7D5260', icon: 'bookmark' },
  { name: 'Design refs', color: '#2E5E8C', icon: 'layers' },
  { name: 'Recipes', color: '#776500', icon: 'restaurant' },
  { name: 'Tokyo trip', color: '#2F6A51', icon: 'locationOn' },
  { name: 'Watch list', color: '#8B4A33', icon: 'playArrowFill' },
];

const MIN = 60_000;

async function seed() {
  const sample = await ensureTag('sample');
  const design = await ensureTag('design');
  const android = await ensureTag('android');
  const talks = await ensureTag('talks');
  const ids: Record<string, string> = {};
  for (const f of SAMPLE_FOLDERS) ids[f.name] = await createFolder(f);
  const now = Date.now();
  const at = (minAgo: number) => new Date(now - minAgo * MIN);

  const verge = await createBookmark({
    type: 'link',
    title: 'Inside Google’s Material 3 Expressive redesign',
    description: 'Springier motion, a new shape library and bolder type: how Google rebuilt Android’s look from research with 18,000 people.',
    url: 'https://www.theverge.com/news/m3-expressive-redesign',
    siteName: 'The Verge',
    wordCount: 1600,
    folderId: ids.Research,
    fetchStatus: 'done',
    note: 'Compare with the Pixel 10 launch keynote.',
    createdAt: at(120),
    tagIds: [sample, design, android],
  });
  await createBookmark({
    type: 'pdf',
    title: 'Attention Is All You Need',
    pageCount: 15,
    lastPage: 6,
    readAt: at(600),
    folderId: ids.Research,
    fetchStatus: 'done',
    createdAt: at(300),
    tagIds: [sample],
  });
  const note = await createBookmark({
    type: 'text',
    title: 'Design talk outline',
    content: NOTE,
    folderId: ids.Research,
    fetchStatus: 'done',
    createdAt: at(5),
    tagIds: [sample, talks],
  });
  await createBookmark({
    type: 'link',
    title: 'Springs, not curves: motion in M3',
    url: 'https://www.youtube.com/watch?v=sample-m3-motion',
    siteName: 'YouTube',
    durationSec: 1122,
    folderId: ids['Watch list'],
    fetchStatus: 'done',
    createdAt: at(1440),
    tagIds: [sample],
  });
  await createBookmark({
    type: 'pdf',
    title: 'Laws of UX',
    pageCount: 24,
    folderId: ids['Read later'],
    fetchStatus: 'done',
    createdAt: at(2000),
    tagIds: [sample],
  });
  await createBookmark({
    type: 'link',
    title: 'Shape – Material Design 3',
    url: 'https://m3.material.io/styles/shape/overview',
    siteName: 'Material Design',
    folderId: ids['Design refs'],
    fetchStatus: 'done',
    createdAt: at(4300),
    tagIds: [sample, design],
  });
  await createHighlight({
    text: 'Design is not just what it looks like. Design is how it works.',
    sourceTitle: 'nytimes.com',
    sourceUrl: 'https://www.nytimes.com',
  });
  await createHighlight({
    text: 'Expressive design is about making people feel something, while staying usable.',
    bookmarkId: verge,
    note: 'use for talk intro',
    color: 'yellow',
    page: 4,
  });
  await createHighlight({ text: 'Shapes can morph between 35 forms, from cookies to clovers.', bookmarkId: verge, color: 'blue', page: 9 });
  await setBookmarkTags(note, [sample, talks]);
}

/** Removes everything tagged #sample, the sample collections and their highlights. */
async function clear() {
  const sample = await db.query.tags.findFirst({ where: inArray(tags.name, ['sample']) });
  if (sample) {
    const rows = await db.select({ id: bookmarkTags.bookmarkId }).from(bookmarkTags).where(inArray(bookmarkTags.tagId, [sample.id]));
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      await db.delete(highlights).where(inArray(highlights.bookmarkId, ids));
      await db.delete(bookmarks).where(inArray(bookmarks.id, ids));
    }
  }
  await db.delete(highlights).where(inArray(highlights.sourceTitle, ['nytimes.com']));
  await db.delete(folders).where(inArray(folders.name, SAMPLE_FOLDERS.map((f) => f.name)));
  invalidateQueries();
}

/** Dev-only: stash://dev/seed adds the design's sample content; ?clear=1 removes it. */
export default function Seed() {
  const colors = useColors();
  const { clear: wipe } = useLocalSearchParams<{ clear?: string }>();
  const [status, setStatus] = useState('Working…');
  useEffect(() => {
    (wipe ? clear() : clear().then(seed))
      .then(() => {
        setStatus(wipe ? 'Sample data removed' : 'Sample data added');
        setTimeout(() => router.replace('/'), 600);
      })
      .catch((e: Error) => setStatus(`Failed: ${e.message}`));
  }, [wipe]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
      <Text variant="titleLargeEmphasized">{status}</Text>
    </View>
  );
}
