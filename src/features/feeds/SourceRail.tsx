import { StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { FeedWithCounts } from '@/db/repo';
import { hostSeed } from '@/features/stash/model';
import { useSelection } from '@/motion/useSelection';
import { useAppTheme } from '@/theme/AppTheme';
import { collectionTones } from '@/theme/palette';
import { Layout } from '@/theme/tokens';
import { Ico } from '@/ui/Ico';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';

import { MorphingShape } from '@/shapes/MorphingShape';
import { sourceGlyph } from './ArticleCard';

const SIZE = 56;

function Avatar({
  label,
  bg,
  fg,
  glyph,
  count,
  selected,
  onPress,
}: {
  label: string;
  bg: string;
  fg: string;
  glyph: string | null;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const sel = useSelection(selected);
  // Selected: the 9-sided cookie morphs into a circle (MaterialShapes, fastSpatial) and a ring
  // fades in (effects).
  const ring = useAnimatedStyle(() => ({ opacity: sel.color.get(), transform: [{ scale: 0.9 + 0.1 * sel.shape.get() }] }));
  return (
    <PressableSurface
      corner={0}
      pressedScale={0.92}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count} new` : label}
      accessibilityState={{ selected }}
      style={styles.item}
    >
      <View style={styles.avatarBox}>
        <Animated.View style={[styles.ring, { borderColor: colors.primary }, ring]} />
        <View style={styles.avatar}>
          <MorphingShape shape={selected ? 'circle' : 'cookie9Sided'} size={SIZE} color={bg} fit="box" style={StyleSheet.absoluteFill} />
          {glyph ? (
            <Text variant="titleLargeEmphasized" color={fg} style={{ fontWeight: '700' }}>
              {glyph}
            </Text>
          ) : (
            <Ico name="rssFeed" size={24} color={fg} />
          )}
        </View>
        {count > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
            <Text variant="labelMedium" color="onPrimary" style={{ fontSize: 11, fontWeight: '700' }}>
              {count > 99 ? '99+' : String(count)}
            </Text>
          </View>
        )}
      </View>
      <Text
        variant="labelMedium"
        color={selected ? 'onSurface' : 'onSurfaceVariant'}
        numberOfLines={1}
        style={{ maxWidth: 64, fontWeight: selected ? '800' : '600' }}
      >
        {label}
      </Text>
    </PressableSurface>
  );
}

/** Source avatars with unread counts (design: Feeds); tapping one filters the list. */
export function SourceRail({
  feeds,
  value,
  onChange,
}: {
  feeds: FeedWithCounts[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { colors, dark } = useAppTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} accessibilityLabel="Sources">
      <Avatar label="All" bg={colors.primaryContainer} fg={colors.onPrimaryContainer} glyph={null} count={0} selected={value === null} onPress={() => onChange(null)} />
      {feeds.map((f) => {
        const tone = collectionTones(hostSeed(f.siteUrl ?? f.url), dark);
        return (
          <Avatar
            key={f.id}
            label={f.title}
            bg={tone.container}
            fg={tone.onContainer}
            glyph={sourceGlyph(f.title)}
            count={f.unread}
            selected={value === f.id}
            onPress={() => onChange(value === f.id ? null : f.id)}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: Layout.gutter + 4, paddingTop: 20, paddingBottom: 4, gap: 12 },
  item: { width: 64, alignItems: 'center', gap: 6, backgroundColor: 'transparent', overflow: 'visible' },
  avatarBox: { width: SIZE, height: SIZE },
  avatar: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', left: -5, top: -5, right: -5, bottom: -5, borderRadius: SIZE, borderWidth: 2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
