import { Card, Column, FlowRow, Image, ListItem, Row, Text } from '@expo/ui/jetpack-compose';
import {
  clip,
  combinedClickable,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  Shapes,
  size,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import type { BookmarkWithTags } from '@/db/repo';
import { hostOf } from '@/features/capture/normalize';
import { fileSize, relativeTime } from '@/lib/format';
import { useColors } from '@/theme/AppTheme';
import { roleColors, TYPE_META } from '@/theme/types';

import { MorphingShape } from '../../modules/expressive';
import { Ico } from './Ico';

type ItemProps = {
  item: BookmarkWithTags;
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

export function subtitleFor(item: BookmarkWithTags): string {
  const parts: string[] = [];
  if (item.type === 'link') parts.push(item.siteName ?? (item.url ? hostOf(item.url) : ''));
  else if (item.type === 'text') parts.push(item.content?.replace(/\s+/g, ' ').slice(0, 120) ?? '');
  else {
    const size = fileSize(item.fileSize);
    parts.push(TYPE_META[item.type].label + (size ? ` · ${size}` : ''));
  }
  parts.push(relativeTime(item.createdAt));
  return parts.filter(Boolean).join(' · ');
}

/**
 * Leading badge: the content type's Expressive shape with its icon. When selected the
 * shape morphs into a 12-sided cookie and swaps to a check mark (spring motion).
 */
export function TypeBadge({ type, selected, dim = 44 }: { type: BookmarkWithTags['type'] | 'highlight'; selected?: boolean; dim?: number }) {
  const colors = useColors();
  const meta = TYPE_META[type];
  const role = roleColors(colors, meta.role);
  return (
    <MorphingShape
      shape={meta.shape}
      morphTo="cookie12Sided"
      morphed={!!selected}
      rotation={60}
      color={selected ? colors.primary : role.container}
      modifiers={[size(dim, dim)]}>
      <Ico
        name={selected ? 'check' : meta.icon}
        size={Math.round(dim * 0.5)}
        tint={selected ? colors.onPrimary : role.content}
      />
    </MorphingShape>
  );
}

function TagPills({ item }: { item: BookmarkWithTags }) {
  const colors = useColors();
  if (!item.tags.length) return null;
  return (
    <FlowRow horizontalArrangement={{ spacedBy: 6 }} verticalArrangement={{ spacedBy: 6 }}>
      {item.tags.slice(0, 6).map((t) => (
        <Text
          key={t.id}
          color={colors.onSecondaryContainer}
          style={{ typography: 'labelMedium', background: colors.secondaryContainer }}
          modifiers={[clip(Shapes.RoundedCorner(8)), padding(8, 3, 8, 3)]}>
          {`#${t.name}`}
        </Text>
      ))}
    </FlowRow>
  );
}

export function BookmarkRow({ item, selected, onPress, onLongPress }: ItemProps) {
  const colors = useColors();
  return (
    <ListItem
      colors={{ containerColor: selected ? colors.secondaryContainer : colors.surface }}
      modifiers={[
        padding(8, 2, 8, 2),
        clip(Shapes.RoundedCorner(selected ? 28 : 16)),
        combinedClickable({ onClick: onPress, onLongClick: onLongPress }),
      ]}>
      <ListItem.LeadingContent>
        {item.thumbPath && !selected ? (
          <Image
            source={{ uri: item.thumbPath }}
            contentScale="crop"
            modifiers={[size(44, 44), clip(Shapes.Material.Cookie9Sided)]}
          />
        ) : (
          <TypeBadge type={item.type} selected={selected} />
        )}
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <Text maxLines={2} overflow="ellipsis" style={{ typography: 'titleMedium' }}>
          {item.title || 'Untitled'}
        </Text>
      </ListItem.HeadlineContent>
      <ListItem.SupportingContent>
        <Text maxLines={1} overflow="ellipsis" color={colors.onSurfaceVariant}>
          {subtitleFor(item)}
        </Text>
      </ListItem.SupportingContent>
      {item.isFavorite ? (
        <ListItem.TrailingContent>
          <Ico name="starFill" size={20} tint={colors.tertiary} />
        </ListItem.TrailingContent>
      ) : null}
    </ListItem>
  );
}

export function BookmarkCard({ item, selected, onPress, onLongPress }: ItemProps) {
  const colors = useColors();
  const hero = item.type === 'image' || item.type === 'pdf' ? item.thumbPath : item.imageUrl;
  const meta = TYPE_META[item.type];
  return (
    <Card
      colors={{ containerColor: selected ? colors.secondaryContainer : colors.surfaceContainerLow }}
      modifiers={[
        padding(16, 6, 16, 6),
        fillMaxWidth(),
        clip(Shapes.RoundedCorner(selected ? 40 : 28)),
        combinedClickable({ onClick: onPress, onLongClick: onLongPress }),
      ]}>
      {hero ? (
        <Image
          source={{ uri: hero }}
          contentScale="crop"
          alignment={item.type === 'pdf' ? 'topCenter' : 'center'}
          modifiers={[fillMaxWidth(), height(item.type === 'pdf' ? 220 : 172)]}
        />
      ) : null}
      <Column modifiers={[paddingAll(16)]} verticalArrangement={{ spacedBy: 8 }}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 10 }}>
          {item.favicon && item.type === 'link' ? (
            <Image source={{ uri: item.favicon }} modifiers={[size(20, 20), clip(Shapes.RoundedCorner(6))]} />
          ) : (
            <TypeBadge type={item.type} selected={selected} dim={28} />
          )}
          <Text
            maxLines={1}
            overflow="ellipsis"
            color={colors.onSurfaceVariant}
            style={{ typography: 'labelLarge' }}
            modifiers={[weight(1)]}>
            {item.type === 'link' ? subtitleFor(item) : `${meta.label} · ${relativeTime(item.createdAt)}`}
          </Text>
          {item.isFavorite ? <Ico name="starFill" size={18} tint={colors.tertiary} /> : null}
          {selected && item.favicon ? <Ico name="check" size={20} tint={colors.primary} /> : null}
        </Row>
        <Text maxLines={3} overflow="ellipsis" style={{ typography: 'titleLarge', fontWeight: '600' }}>
          {item.title || 'Untitled'}
        </Text>
        {item.description || (item.type === 'text' && item.content) ? (
          <Text maxLines={3} overflow="ellipsis" color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>
            {item.description ?? item.content ?? ''}
          </Text>
        ) : null}
        <TagPills item={item} />
      </Column>
    </Card>
  );
}
