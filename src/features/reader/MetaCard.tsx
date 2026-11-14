import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatPublished } from '@/features/feeds/format';
import { relativeTime } from '@/lib/format';
import { useAppTheme } from '@/theme/AppTheme';
import type { CollectionTones } from '@/theme/palette';
import type { IconName } from '@/theme/icons';
import { Ico } from '@/ui/Ico';
import { Text } from '@/ui/Text';

type Props = {
  feedTitle: string;
  /** Site the article lives on ("techpowerup.com"). */
  host: string | null;
  tone: CollectionTones;
  /** "By Jane Doe" / "Posted by speckx". */
  author: string | null;
  published: Date | null;
  minutes: number | null;
};

/** Avatar letter: first letter of the feed's name, ignoring a leading "The ". */
const initial = (name: string) => (name.replace(/^the\s+/i, '').trim()[0] ?? '?').toUpperCase();

/**
 * The article's facts on one tonal card, apart from the hero and the body: source with its
 * avatar and the site host, then author, published date (absolute and relative) and read time.
 */
export const MetaCard = memo(function MetaCard({ feedTitle, host, tone, author, published, minutes }: Props) {
  const { colors } = useAppTheme();
  const rows: { icon: IconName; label: string; value: string; sub?: string }[] = [];
  if (author) rows.push({ icon: 'person', label: 'Author', value: author });
  if (published) rows.push({ icon: 'calendarToday', label: 'Published', value: formatPublished(published), sub: relativeTime(published) });
  if (minutes) rows.push({ icon: 'schedule', label: 'Reading time', value: `${minutes} min read` });

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}>
      <View style={styles.source}>
        <View style={[styles.avatar, { backgroundColor: tone.container }]}>
          <Text variant="titleMedium" color={tone.onContainer} style={{ fontWeight: '800' }}>
            {initial(feedTitle)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="titleSmall" numberOfLines={1}>
            {feedTitle}
          </Text>
          {host ? (
            <View style={styles.host}>
              <Ico name="public" size={14} color={colors.onSurfaceVariant} />
              <Text variant="labelMedium" color="onSurfaceVariant" numberOfLines={1} style={{ flexShrink: 1 }}>
                {host}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {rows.length > 0 && <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />}

      {rows.map((r) => (
        <View key={r.icon} style={styles.row} accessible accessibilityLabel={`${r.label}: ${r.value}${r.sub ? `, ${r.sub}` : ''}`}>
          <View style={[styles.rowIcon, { backgroundColor: colors.surfaceContainerHigh }]}>
            <Ico name={r.icon} size={18} color={colors.onSurfaceVariant} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="labelSmall" color="onSurfaceVariant">
              {r.label}
            </Text>
            <Text variant="bodyMedium" numberOfLines={2}>
              {r.value}
              {r.sub ? (
                <Text variant="bodyMedium" color="onSurfaceVariant">
                  {`  ·  ${r.sub}`}
                </Text>
              ) : null}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 16, borderRadius: 28, padding: 16 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  host: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 5 },
  rowIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
