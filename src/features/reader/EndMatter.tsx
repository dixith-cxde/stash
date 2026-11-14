import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ArticleAuthor, ArticleTag, RelatedLink } from '@/features/reader/endmatter';
import { hostSeed } from '@/features/stash/model';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones } from '@/theme/palette';
import { Ico } from '@/ui/Ico';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';

type Props = {
  author: ArticleAuthor | null;
  tags: ArticleTag[];
  related: { title: string; links: RelatedLink[] } | null;
  onOpen: (url: string) => void;
};

/** Initials for the author avatar: "Jane Doe" → "JD". */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/**
 * The end of an article: who wrote it (author chip, with a bio when the page had one), its tags
 * as chips, and the "Continue reading" links as a grouped list of wide article cards.
 */
export const EndMatter = memo(function EndMatter({ author, tags, related, onOpen }: Props) {
  if (!author && !tags.length && !related?.links.length) return null;
  return (
    <View style={styles.wrap}>
      {author && <AuthorBlock author={author} onOpen={onOpen} />}
      {tags.length > 0 && <TagBlock tags={tags} onOpen={onOpen} />}
      {related && related.links.length > 0 && <RelatedBlock title={related.title} links={related.links} onOpen={onOpen} />}
    </View>
  );
});

function Label({ children }: { children: string }) {
  return (
    <Text variant="labelLarge" color="onSurfaceVariant" style={styles.label}>
      {children}
    </Text>
  );
}

/** Who wrote it: one quiet card with an initials avatar, the name and the bio. */
function AuthorBlock({ author, onOpen }: { author: ArticleAuthor; onOpen: (url: string) => void }) {
  const { colors, dark } = useAppTheme();
  const tone = collectionTones(hostSeed(author.name), dark);
  const body = (
    <>
      <View style={styles.authorRow}>
        <View style={[styles.avatar, { backgroundColor: tone.container }]}>
          <Text variant="labelLarge" color={tone.onContainer} style={{ fontWeight: '800' }}>
            {initials(author.name)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="labelMedium" color="onSurfaceVariant">
            Written by
          </Text>
          <Text variant="titleMedium" numberOfLines={1}>
            {author.name}
          </Text>
        </View>
        {author.url ? <Ico name="openInNew" size={18} color={colors.onSurfaceVariant} /> : null}
      </View>
      {author.bio ? (
        <Text variant="bodyMedium" color="onSurfaceVariant" style={{ marginTop: 12 }}>
          {author.bio}
        </Text>
      ) : null}
    </>
  );
  return author.url ? (
    <PressableSurface
      kind="card"
      corner={24}
      onPress={() => onOpen(author.url!)}
      accessibilityLabel={`Written by ${author.name}. Open profile`}
      style={[styles.authorCard, { backgroundColor: colors.surfaceContainer }]}
    >
      {body}
    </PressableSurface>
  ) : (
    <View style={[styles.authorCard, { backgroundColor: colors.surfaceContainer, borderRadius: 24 }]} accessible accessibilityLabel={`Written by ${author.name}`}>
      {body}
    </View>
  );
}

function TagBlock({ tags, onOpen }: { tags: ArticleTag[]; onOpen: (url: string) => void }) {
  const { colors } = useAppTheme();
  return (
    <View>
      <Label>Tags</Label>
      <View style={styles.tags}>
        {tags.map((t) => {
          const body = (
            <View style={styles.tagInner}>
              <Ico name="sell" size={16} color={colors.onSurfaceVariant} />
              <Text variant="labelLarge" color="onSurfaceVariant" numberOfLines={1}>
                {t.label}
              </Text>
            </View>
          );
          return t.url ? (
            <PressableSurface
              key={t.label}
              kind="button"
              corner={10}
              onPress={() => onOpen(t.url!)}
              accessibilityLabel={`Tag ${t.label}`}
              style={[styles.tag, { borderColor: colors.outlineVariant }]}
            >
              {body}
            </PressableSurface>
          ) : (
            <View key={t.label} style={[styles.tag, { borderColor: colors.outlineVariant }]} accessible accessibilityLabel={`Tag ${t.label}`}>
              {body}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Related articles: a grouped list of wide cards, top to bottom (M3 Expressive list group). */
function RelatedBlock({ title, links, onOpen }: { title: string; links: RelatedLink[]; onOpen: (url: string) => void }) {
  return (
    <View>
      <Label>{title}</Label>
      <View style={styles.group}>
        {links.map((l) => (
          <RelatedRow key={l.url ?? l.title} link={l} onOpen={onOpen} />
        ))}
      </View>
    </View>
  );
}

function RelatedRow({ link, onOpen }: { link: RelatedLink; onOpen: (url: string) => void }) {
  const { colors, dark } = useAppTheme();
  const tone = collectionTones(hostSeed(link.url ?? link.title), dark);
  const body = (
    <>
      <View style={[styles.thumb, { backgroundColor: tone.container }]}>
        {link.image ? (
          <Image source={link.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <Ico name="article" size={24} color={tone.onContainer} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="titleSmall" numberOfLines={3}>
          {link.title}
        </Text>
        {link.blurb || link.host ? (
          <Text variant="bodySmall" color="onSurfaceVariant" numberOfLines={2} style={{ marginTop: 4 }}>
            {[link.blurb, link.host].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
      {link.url ? <Ico name="chevronRight" size={20} color={colors.onSurfaceVariant} /> : null}
    </>
  );
  return link.url ? (
    <PressableSurface
      kind="card"
      corner={6}
      pressedCorner={20}
      onPress={() => onOpen(link.url!)}
      accessibilityLabel={`${link.title}${link.host ? `, ${link.host}` : ''}`}
      style={[styles.row, { backgroundColor: colors.surfaceContainer }]}
    >
      {body}
    </PressableSurface>
  ) : (
    <View style={[styles.row, { backgroundColor: colors.surfaceContainer, borderRadius: 6 }]} accessible accessibilityLabel={link.title}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 22, paddingTop: 28, gap: 24 },
  label: { marginBottom: 10 },
  authorCard: { padding: 16 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderWidth: 1, borderRadius: 10, height: 36, justifyContent: 'center', maxWidth: '100%' },
  tagInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  group: { borderRadius: 24, overflow: 'hidden', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, paddingRight: 14, minHeight: 80 },
  thumb: { width: 64, height: 64, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
