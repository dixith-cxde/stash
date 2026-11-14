import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatCommentTime } from '@/features/feeds/format';
import { MarkdownView } from '@/features/notes/MarkdownView';
import { seedFor } from '@/features/stash/model';
import { plural } from '@/lib/format';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones } from '@/theme/palette';
import { Button } from '@/ui/Button';
import { Ico } from '@/ui/Ico';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';

import type { AggregatorInfo, Discussion, ReaderComment } from './discussion';

/** Comments shown before "Show all": keeps the first render light on slow phones. */
const FIRST_PAGE = 6;

type Props = {
  /** The page's own comment thread (extracted with the article). */
  discussion: Discussion | null;
  /** A link-aggregator thread (Hacker News "Comments URL"). */
  aggregator: AggregatorInfo | null;
  /** Host of the article page, for "On techpowerup.com". */
  host: string | null;
  baseUrl: string | null;
  onOpen: (url: string) => void;
};

/**
 * Discussion under an article, on its own tonal band: a header with the total count, a card
 * that opens the link-aggregator thread, and the page's comments as cards (replies indented).
 */
export const DiscussionSection = memo(function DiscussionSection({ discussion, aggregator, host, baseUrl, onOpen }: Props) {
  const { colors } = useAppTheme();
  const [all, setAll] = useState(false);
  if (!discussion && !aggregator) return null;
  const comments = discussion?.comments ?? [];
  const shown = all ? comments : comments.slice(0, FIRST_PAGE);
  const pageCount = discussion ? Math.max(discussion.count ?? 0, comments.length) : 0;
  const total = pageCount + (aggregator?.comments ?? 0);
  const threadUrl = discussion?.url ?? null;

  return (
    <View style={[styles.band, { backgroundColor: colors.surfaceContainerLow }]}>
      <View style={styles.header} accessibilityRole="header">
        <View style={[styles.headerIcon, { backgroundColor: colors.secondaryContainer }]}>
          <Ico name="forum" size={22} color={colors.onSecondaryContainer} />
        </View>
        <Text variant="titleLargeEmphasized" style={{ flex: 1 }}>
          Discussion
        </Text>
        {total > 0 && (
          <View style={[styles.count, { backgroundColor: colors.secondaryContainer }]}>
            <Text variant="labelLargeEmphasized" color="onSecondaryContainer">
              {total.toLocaleString()}
            </Text>
          </View>
        )}
      </View>

      {aggregator && (
        <PressableSurface
          kind="card"
          corner={24}
          onPress={() => onOpen(aggregator.commentsUrl)}
          accessibilityLabel={`Open the ${aggregator.site} discussion${aggregator.comments != null ? `, ${plural(aggregator.comments, 'comment')}` : ''}`}
          style={[styles.aggregator, { backgroundColor: colors.secondaryContainer }]}
        >
          <View style={{ flex: 1 }}>
            <Text variant="titleMediumEmphasized" color="onSecondaryContainer">
              {`Discuss on ${aggregator.site}`}
            </Text>
            <View style={styles.stats}>
              {aggregator.comments != null && <Stat icon="forum" label={plural(aggregator.comments, 'comment')} />}
              {aggregator.points != null && <Stat icon="arrowUpward" label={plural(aggregator.points, 'point')} />}
            </View>
          </View>
          <View style={[styles.open, { backgroundColor: colors.onSecondaryContainer }]}>
            <Ico name="openInNew" size={20} color={colors.secondaryContainer} />
          </View>
        </PressableSurface>
      )}

      {comments.length > 0 && (
        <>
          <View style={styles.sub}>
            <Text variant="labelLargeEmphasized" color="onSurfaceVariant" style={{ flex: 1 }} numberOfLines={1}>
              {host ? `Comments on ${host}` : (discussion?.title ?? 'Comments')}
            </Text>
            <Text variant="labelLarge" color="onSurfaceVariant">
              {pageCount > comments.length ? `${comments.length} of ${pageCount}` : plural(comments.length, 'comment')}
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            {shown.map((c, i) => (
              <CommentCard key={i} c={c} index={i} baseUrl={baseUrl} onOpen={onOpen} />
            ))}
          </View>
          <View style={styles.actions}>
            {comments.length > shown.length && (
              <Button
                label={`Show all ${comments.length} comments`}
                icon="expandMore"
                variant="tonal"
                height={44}
                onPress={() => setAll(true)}
              />
            )}
            {threadUrl && (
              <Button label="Open the thread" icon="openInNew" variant="text" height={44} onPress={() => onOpen(threadUrl)} />
            )}
          </View>
        </>
      )}
    </View>
  );
});

function Stat({ icon, label }: { icon: 'forum' | 'arrowUpward'; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.stat}>
      <Ico name={icon} size={16} color={colors.onSecondaryContainer} />
      <Text variant="labelLarge" color="onSecondaryContainer">
        {label}
      </Text>
    </View>
  );
}

const MAX_INDENT = 4;

const CommentCard = memo(function CommentCard({
  c,
  index,
  baseUrl,
  onOpen,
}: {
  c: ReaderComment;
  index: number;
  baseUrl: string | null;
  onOpen: (url: string) => void;
}) {
  const { colors, dark } = useAppTheme();
  const tone = c.author ? collectionTones(seedFor(c.author), dark) : null;
  const time = formatCommentTime(c.time);
  const depth = Math.min(c.depth, MAX_INDENT);
  return (
    <View style={styles.commentRow}>
      {Array.from({ length: depth }, (_, k) => (
        <View key={k} style={styles.rail}>
          <View style={[styles.railLine, { backgroundColor: colors.outlineVariant }]} />
        </View>
      ))}
      <View style={[styles.comment, { backgroundColor: colors.surface }]}>
        <View style={styles.commentHead}>
          <View style={[styles.commentAvatar, { backgroundColor: tone?.container ?? colors.surfaceContainerHighest }]}>
            {c.author ? (
              <Text variant="labelLargeEmphasized" color={tone!.onContainer}>
                {c.author.trim()[0]?.toUpperCase() ?? '?'}
              </Text>
            ) : (
              <Ico name="person" size={16} color={colors.onSurfaceVariant} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="labelLargeEmphasized" numberOfLines={1}>
              {c.author ?? `Comment ${index + 1}`}
            </Text>
            {time ? (
              <Text variant="labelMedium" color="onSurfaceVariant" numberOfLines={1}>
                {c.depth > 0 ? `Reply · ${time}` : time}
              </Text>
            ) : c.depth > 0 ? (
              <Text variant="labelMedium" color="onSurfaceVariant">
                Reply
              </Text>
            ) : null}
          </View>
        </View>
        <MarkdownView markdown={c.markdown} compact baseUrl={baseUrl} onOpenLink={onOpen} />
        {c.permalink && (
          <Text
            variant="labelLarge"
            color="primary"
            onPress={() => onOpen(c.permalink!)}
            accessibilityRole="link"
            style={{ marginTop: 10, alignSelf: 'flex-start' }}
          >
            View on site
          </Text>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  band: { marginTop: 32, marginHorizontal: 8, borderRadius: 32, paddingHorizontal: 12, paddingTop: 20, paddingBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, marginBottom: 16 },
  headerIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 32, height: 32, borderRadius: 16, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  aggregator: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingRight: 14 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  open: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, marginTop: 20, marginBottom: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  commentRow: { flexDirection: 'row' },
  rail: { width: 14, alignItems: 'center' },
  railLine: { width: 2, flex: 1, borderRadius: 1 },
  comment: { flex: 1, borderRadius: 20, padding: 14 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
