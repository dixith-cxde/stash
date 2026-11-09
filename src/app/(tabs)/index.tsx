import {
  Box,
  Column,
  FilledTonalIconButton,
  HorizontalMultiBrowseCarousel,
  Row,
  Surface,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  align,
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  height,
  horizontalScroll,
  maskClip,
  padding,
  paddingAll,
  Shapes,
  size,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { router } from 'expo-router';
import { useState } from 'react';

import { BookmarkCollection } from '@/components/BookmarkCollection';
import { Ico } from '@/components/Ico';
import { useDbQuery } from '@/db/hooks';
import { allLists, countsByType, folderTree, queryBookmarks } from '@/db/repo';
import type { BookmarkType } from '@/db/schema';
import { captureFromClipboard, pickImages, pickPdfs } from '@/features/capture/quickAdd';
import { plural } from '@/lib/format';
import { browse } from '@/lib/nav';
import { AppHost, useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';
import { TYPE_META } from '@/theme/types';

import { ConnectedButtonGroup, FabMenu, type MaterialShapeName, MorphingShape } from '../../../modules/expressive';

const FILTERS: { key: 'all' | BookmarkType; label: string; icon: IconName }[] = [
  { key: 'all', label: 'All', icon: 'bookmarks' },
  { key: 'link', label: 'Links', icon: 'link' },
  { key: 'pdf', label: 'PDFs', icon: 'pictureAsPdf' },
  { key: 'text', label: 'Notes', icon: 'notes' },
  { key: 'image', label: 'Images', icon: 'image' },
  { key: 'file', label: 'Files', icon: 'attachFile' },
];

type Shortcut = {
  key: string;
  title: string;
  subtitle: string;
  shape: MaterialShapeName;
  icon: IconName;
  tone: 'primary' | 'secondary' | 'tertiary';
  open: () => void;
};

function useShortcuts(): Shortcut[] {
  const { data: folders } = useDbQuery(folderTree, [], []);
  const { data: lists } = useDbQuery(allLists, [], []);
  const pinnedFolders = folders.filter((f) => f.pinned);
  const pinnedLists = lists.filter((l) => l.pinned);
  return [
    {
      key: 'fav',
      title: 'Favorites',
      subtitle: 'Starred',
      shape: 'heart',
      icon: 'starFill',
      tone: 'tertiary',
      open: () => browse('Favorites', { favorite: true }),
    },
    {
      key: 'unread',
      title: 'Unread',
      subtitle: 'Not opened yet',
      shape: 'sunny',
      icon: 'history',
      tone: 'primary',
      open: () => browse('Unread', { unread: true }),
    },
    ...pinnedFolders.map<Shortcut>((f) => ({
      key: `f:${f.id}`,
      title: f.name,
      subtitle: plural(f.itemCount, 'item'),
      shape: f.shape as MaterialShapeName,
      icon: 'folder',
      tone: 'secondary',
      open: () => router.push({ pathname: '/folder/[id]', params: { id: f.id } }),
    })),
    ...pinnedLists.map<Shortcut>((l) => ({
      key: `l:${l.id}`,
      title: l.name,
      subtitle: plural(l.itemCount, 'item'),
      shape: l.shape as MaterialShapeName,
      icon: l.kind === 'smart' ? 'tune' : 'list',
      tone: 'tertiary',
      open: () => router.push({ pathname: '/list/[id]', params: { id: l.id } }),
    })),
    {
      key: 'archive',
      title: 'Archive',
      subtitle: 'Out of the way',
      shape: 'cookie4Sided',
      icon: 'archive',
      tone: 'secondary',
      open: () => browse('Archive', { archived: true }),
    },
  ];
}

function ShortcutCarousel() {
  const colors = useColors();
  const shortcuts = useShortcuts();
  const tone = {
    primary: [colors.primaryContainer, colors.onPrimaryContainer, colors.primary, colors.onPrimary],
    secondary: [colors.secondaryContainer, colors.onSecondaryContainer, colors.secondary, colors.onSecondary],
    tertiary: [colors.tertiaryContainer, colors.onTertiaryContainer, colors.tertiary, colors.onTertiary],
  } as const;
  return (
    <HorizontalMultiBrowseCarousel
      preferredItemWidth={176}
      itemSpacing={8}
      contentPadding={{ start: 16, end: 16 }}
      modifiers={[fillMaxWidth(), height(168)]}>
      {shortcuts.map((s) => {
        const [container, content, accent, onAccent] = tone[s.tone];
        return (
          <Box
            key={s.key}
            modifiers={[
              fillMaxSize(),
              maskClip(Shapes.RoundedCorner(28)),
              background(container),
              clickable(s.open),
            ]}>
            <Column modifiers={[paddingAll(16), fillMaxSize()]} verticalArrangement="spaceBetween">
              <MorphingShape shape={s.shape} color={accent} modifiers={[size(52, 52)]}>
                <Ico name={s.icon} size={26} tint={onAccent} />
              </MorphingShape>
              <Column>
                <Text color={content} maxLines={1} style={{ typography: 'titleMedium', fontWeight: '700' }}>
                  {s.title}
                </Text>
                <Text color={content} maxLines={1} style={{ typography: 'labelMedium' }}>
                  {s.subtitle}
                </Text>
              </Column>
            </Column>
          </Box>
        );
      })}
    </HorizontalMultiBrowseCarousel>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const [filter, setFilter] = useState<'all' | BookmarkType>('all');
  const { data: items } = useDbQuery(
    () => queryBookmarks(filter === 'all' ? {} : { types: [filter] }),
    [filter],
    [],
  );
  const { data: counts } = useDbQuery(countsByType, [], {});
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const visibleFilters = FILTERS.filter((f) => f.key === 'all' || f.key === filter || (counts[f.key] ?? 0) > 0);

  const header = [
    <Row
      key="title"
      verticalAlignment="center"
      modifiers={[fillMaxWidth(), padding(24, 20, 16, 4)]}>
      <Column modifiers={[weight(1)]}>
        <Text style={{ typography: 'displaySmall', fontWeight: '700', letterSpacing: -0.5 }}>Stash</Text>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'titleSmall' }}>
          {total ? `${plural(total, 'thing')} saved` : 'Save anything from any app'}
        </Text>
      </Column>
      <FilledTonalIconButton onClick={() => router.push('/settings')}>
        <Ico name="settings" label="Settings" />
      </FilledTonalIconButton>
    </Row>,
    <Surface
      key="search"
      color={colors.surfaceContainerHigh}
      onClick={() => router.navigate('/search')}
      modifiers={[padding(16, 12, 16, 12), fillMaxWidth(), height(56), clip(Shapes.RoundedCorner(28))]}>
      <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxSize(), padding(20, 0, 20, 0)]}>
        <Ico name="search" tint={colors.onSurfaceVariant} />
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyLarge' }}>
          Search links, PDFs, notes, highlights
        </Text>
      </Row>
    </Surface>,
    <ShortcutCarousel key="carousel" />,
    <Row key="filters" modifiers={[fillMaxWidth(), horizontalScroll(), padding(16, 16, 16, 8)]}>
      <ConnectedButtonGroup
        fillWidth={false}
        options={visibleFilters.map((f) => ({
          key: f.key,
          label: f.label,
          icon: <Ico name={f.icon} size={18} />,
        }))}
        selected={[filter]}
        onSelectionChange={(keys) => setFilter((keys[0] as typeof filter) ?? 'all')}
      />
    </Row>,
  ];

  const fab = (
    <FabMenu
      modifiers={[align('bottomEnd'), padding(0, 0, 16, 16)]}
      icon={<Ico name="add" />}
      items={[
        { key: 'paste', label: 'Paste from clipboard', icon: <Ico name="contentPaste" /> },
        { key: 'note', label: 'New note', icon: <Ico name="noteAdd" /> },
        { key: 'pdf', label: 'Import PDF', icon: <Ico name="uploadFile" /> },
        { key: 'image', label: 'Add images', icon: <Ico name="addPhotoAlternate" /> },
      ]}
      onItemPress={(key) => {
        if (key === 'paste') void captureFromClipboard().then((ok) => !ok && router.push('/capture'));
        if (key === 'note') router.push({ pathname: '/note/[id]', params: { id: 'new' } });
        if (key === 'pdf') void pickPdfs();
        if (key === 'image') void pickImages();
      }}
    />
  );

  return (
    <AppHost style={{ flex: 1 }}>
      <BookmarkCollection
        items={items}
        header={header}
        bottomInset={0}
        overlay={fab}
        empty={
          filter === 'all'
            ? {
                icon: 'bookmarkAdd',
                shape: 'cookie12Sided',
                title: 'Nothing saved yet',
                body: 'Share a link, PDF or image from any app to Stash — or select text anywhere and tap “Save to Stash”.',
              }
            : {
                icon: TYPE_META[filter].icon,
                shape: TYPE_META[filter].shape,
                title: `No ${TYPE_META[filter].plural.toLowerCase()} yet`,
                body: 'Things you save will show up here.',
              }
        }
      />
    </AppHost>
  );
}
