import { type ComponentRef, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useSelection } from '@/motion/useSelection';
import { useColors } from '@/theme/AppTheme';

import { Ico } from './Ico';
import { DropdownMenu, type MenuAnchor, type MenuOption } from './Menu';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';

/**
 * "⇅ Recent ▾" pill: opens a dropdown of sorts; the arrow turns while it is open.
 * Used by Library (collections) and collection pages (items).
 */
export function SortButton<K extends string>({
  options,
  value,
  onChange,
}: {
  options: MenuOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const colors = useColors();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const open = useSelection(!!anchor, { shape: 'fastSpatial' });
  const caret = useAnimatedStyle(() => ({ transform: [{ rotate: `${open.shape.get() * 180}deg` }] }));
  const label = options.find((o) => o.key === value)?.label ?? '';
  return (
    <>
      <View ref={ref} collapsable={false}>
        <PressableSurface
          kind="button"
          corner={20}
          onPress={() => ref.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }))}
          accessibilityLabel={`Sort by ${label}. Change`}
          style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingRight: 10, backgroundColor: colors.surfaceContainerHigh }}
        >
          <Ico name="swapVert" size={18} color={colors.onSurfaceVariant} />
          <Text variant="labelLarge" color="onSurfaceVariant">
            {label}
          </Text>
          <Animated.View style={caret}>
            <Ico name="expandMore" size={18} color={colors.onSurfaceVariant} />
          </Animated.View>
        </PressableSurface>
      </View>
      {anchor && <DropdownMenu anchor={anchor} options={options} selected={value} onSelect={onChange} onDismiss={() => setAnchor(null)} />}
    </>
  );
}
