import type { HighlightWithTags } from '@/db/repo';
import { useAppTheme } from '@/theme/AppTheme';
import { HIGHLIGHT_TONES } from '@/theme/palette';
import { Text } from '@/ui/Text';
import { TransformCard } from '@/ui/TransformCard';

/** A highlight as a search result: the quote on its highlight tone, then its source. */
export function HighlightResult({ h }: { h: HighlightWithTags }) {
  const { dark } = useAppTheme();
  const tone = HIGHLIGHT_TONES[h.color][dark ? 'dark' : 'light'];
  const source = h.bookmarkTitle ?? h.sourceTitle ?? h.sourceApp;
  return (
    <TransformCard
      href={h.bookmarkId ? `/item/${h.bookmarkId}` : `/highlight/${h.id}`}
      color={tone.bg}
      corner={24}
      accessibilityLabel={`Highlight: ${h.text}`}
      contentStyle={{ padding: 16 }}
    >
      <Text variant="bodyLarge" color={tone.fg} numberOfLines={4} style={{ fontWeight: '600', lineHeight: 23 }}>
        {`“${h.text}”`}
      </Text>
      {source ? (
        <Text variant="labelMedium" color={tone.fg} numberOfLines={1} style={{ marginTop: 8, opacity: 0.8 }}>
          {source}
        </Text>
      ) : null}
    </TransformCard>
  );
}
