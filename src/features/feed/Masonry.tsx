import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { enterRise, exitShrink, reflow } from '@/motion/layout';
import { estimateHeight, type FeedItem, masonry } from '@/features/stash/model';
import { Layout } from '@/theme/tokens';

import { FeedCard } from './FeedCard';

/**
 * Two-column masonry of feed cards. Items keep their keys across filter changes, so cards
 * that stay glide to their new slots while the rest fade in or out.
 */
export function Masonry({ items }: { items: FeedItem[] }) {
  const cols = masonry(items, estimateHeight);
  return (
    <View style={{ flexDirection: 'row', gap: Layout.gridGap, paddingHorizontal: Layout.gutter, alignItems: 'flex-start' }}>
      {cols.map((col, c) => (
        <View key={c} style={{ flex: 1, gap: Layout.gridGap, minWidth: 0 }}>
          {col.map((f) => (
            <Animated.View key={f.key} layout={reflow} entering={enterRise} exiting={exitShrink}>
              <FeedCard f={f} />
            </Animated.View>
          ))}
        </View>
      ))}
    </View>
  );
}
