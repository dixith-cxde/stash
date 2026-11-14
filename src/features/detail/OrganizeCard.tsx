import { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useDbQuery } from '@/db/hooks';
import { type BookmarkWithTags, getFolder, moveBookmarks, setBookmarkTags } from '@/db/repo';
import { folderSeed } from '@/features/stash/model';
import { useSuggestions } from '@/features/suggest/useSuggestions';
import { enterRise, exitShrink, reflow } from '@/motion/layout';
import { Shape } from '@/shapes/Shape';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones } from '@/theme/palette';
import { Chip, TagPill } from '@/ui/Chip';
import { Ico } from '@/ui/Ico';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';

import { CollectionPicker, TagPicker } from './Pickers';

/**
 * ORGANIZE card (design: Item detail): the collection as a shaped pill, tag pills, "+ Tag",
 * and one-tap suggested tags. Changes save immediately; pills reflow on springs.
 */
export function OrganizeCard({ b, compact }: { b: BookmarkWithTags; compact?: boolean }) {
  const { colors, dark } = useAppTheme();
  const [picker, setPicker] = useState<'tags' | 'folder' | null>(null);
  const { data: folder } = useDbQuery(() => (b.folderId ? getFolder(b.folderId) : Promise.resolve(undefined)), [b.folderId], undefined);
  const tagIds = b.tags.map((t) => t.id);
  const suggestions = useSuggestions(
    { id: b.id, title: b.title, description: b.description, url: b.url, content: b.content },
    tagIds,
    3,
  );
  const tone = folder ? collectionTones(folderSeed(folder), dark) : null;
  const visibleTags = b.tags.filter((t) => t.name !== 'sample');

  const body = (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: compact ? 0 : 12 }}>
        <PressableSurface
          corner={18}
          pressedScale={0.96}
          onPress={() => setPicker('folder')}
          accessibilityLabel={folder ? `Collection: ${folder.name}. Change` : 'Add to a collection'}
          style={{
            height: 36,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 6,
            paddingRight: 14,
            backgroundColor: tone?.container ?? colors.surfaceContainerHighest,
          }}
        >
          {tone ? (
            <Shape name={(folder?.shape as 'cookie9Sided') ?? 'cookie9Sided'} size={26} color={tone.onContainer} />
          ) : (
            <Ico name="createNewFolder" size={20} color={colors.onSurfaceVariant} />
          )}
          <Text variant="labelMedium" color={tone?.onContainer ?? colors.onSurfaceVariant}>
            {folder?.name ?? 'Add to collection'}
          </Text>
        </PressableSurface>
        {visibleTags.map((t) => (
          <Animated.View key={t.id} layout={reflow} entering={enterRise} exiting={exitShrink}>
            <TagPill label={`#${t.name}`} />
          </Animated.View>
        ))}
        <Animated.View layout={reflow}>
          <Chip label="Tag" icon="add" onPress={() => setPicker('tags')} accessibilityLabel="Edit tags" />
        </Animated.View>
      </View>
      {suggestions.tags.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <Ico name="autoAwesome" size={18} color={colors.primary} />
          <Text variant="bodySmall" color="onSurfaceVariant">
            Suggested:
          </Text>
          {suggestions.tags.map((t) => (
            <PressableSurface
              key={t.id}
              kind="button"
              corner={10}
              onPress={() => void setBookmarkTags(b.id, [...tagIds, t.id])}
              accessibilityLabel={`Add tag ${t.name}`}
              style={{ paddingHorizontal: 4, paddingVertical: 4 }}
            >
              <Text variant="labelMedium" color="primary" style={{ fontWeight: '700' }}>
                {`#${t.name}`}
              </Text>
            </PressableSurface>
          ))}
        </View>
      )}
    </>
  );

  return (
    <>
      {compact ? (
        body
      ) : (
        <View style={{ marginHorizontal: 16, marginTop: 24, padding: 18, borderRadius: 28, backgroundColor: colors.surfaceContainer }}>
          <Text variant="overline" color="primary">
            Organize
          </Text>
          {body}
        </View>
      )}
      {picker === 'folder' && (
        <CollectionPicker current={b.folderId} onPick={(id) => void moveBookmarks([b.id], id)} onDismiss={() => setPicker(null)} />
      )}
      {picker === 'tags' && (
        <TagPicker selected={tagIds} onChange={(ids) => void setBookmarkTags(b.id, ids)} onDismiss={() => setPicker(null)} />
      )}
    </>
  );
}
