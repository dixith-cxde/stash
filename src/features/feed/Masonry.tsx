import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { SelectKey } from '@/features/select/store';
import { enterRiseAt, exitShrink, reflow } from '@/motion/layout';
import { estimateHeight, type FeedItem, masonry } from '@/features/stash/model';
import { Layout } from '@/theme/tokens';

import { FeedCard } from './FeedCard';

/**
 * Two-column masonry of feed cards. Items keep their keys across filter changes, so cards
 * that stay glide to their new slots while the rest fade in or out.
 */
export function Masonry({ items }: { items: FeedItem[] }) {
  const cols = masonry(items, estimateHeight);
  const order = new Map(items.map((f, i) => [f.key, i]));
  return (
    <View style={{ flexDirection: 'row', gap: Layout.gridGap, paddingHorizontal: Layout.gutter, alignItems: 'flex-start' }}>
      {cols.map((col, c) => (
        <View key={c} style={{ flex: 1, gap: Layout.gridGap, minWidth: 0 }}>
          {col.map((f) => (
            <Animated.View key={f.key} layout={reflow} entering={enterRiseAt(order.get(f.key) ?? 0)} exiting={exitShrink}>
              <SelectKey value={f.key}>
                <FeedCard f={f} />
              </SelectKey>
            </Animated.View>
          ))}
        </View>
      ))}
    </View>
  );
}
