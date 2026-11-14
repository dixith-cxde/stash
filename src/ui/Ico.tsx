import { memo } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { type IconName, IconPaths } from '@/theme/icons';

type Props = {
  name: IconName;
  size?: number;
  color: ColorValue;
  /** Accessible label; omit for decorative icons next to text. */
  label?: string;
};

/** Material Symbols Rounded icon. */
export const Ico = memo(function Ico({ name, size = 24, color, label }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 960 960"
      accessible={!!label}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    >
      <Path d={IconPaths[name]} fill={color} />
    </Svg>
  );
});
