import { View } from 'react-native';

import { connectedCorners } from '@/motion/useSelection';
import type { IconName } from '@/theme/icons';

import { IconButton } from './IconButton';

type Item<K extends string> = { key: K; icon: IconName; label: string };

const SIZE = 40;
const WIDTH = 52;
/** Connected button group: 2dp gaps, 8dp inner corners, full outer corners (androidx tokens). */
const GAP = 2;
const INNER = 8;

/**
 * M3 Expressive connected icon button group for view switching: the selected button turns
 * fully round and primary, the others keep their connected corners.
 */
export function IconToggleGroup<K extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
}: {
  items: Item<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'row', gap: GAP }}>
      {items.map((it, i) => (
        <IconButton
          key={it.key}
          icon={it.icon}
          accessibilityLabel={it.label}
          variant="tonal"
          size={SIZE}
          width={WIDTH}
          selected={it.key === value}
          selectedColors={{ bg: 'primary', fg: 'onPrimary' }}
          corners={connectedCorners(i, items.length, SIZE / 2, INNER)}
          onPress={() => onChange(it.key)}
        />
      ))}
    </View>
  );
}
