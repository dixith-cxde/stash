import { memo, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { materialShape } from './materialShapes';
import type { MaterialShapeName } from './names';
import { svgPath } from './path';

type Props = {
  name: MaterialShapeName;
  size: number;
  color: string;
  /** Degrees, clockwise. */
  rotation?: number;
  style?: StyleProp<ViewStyle>;
};

/** A static MaterialShape (exact cubic outline). Decorative: hidden from accessibility. */
export const Shape = memo(function Shape({ name, size, color, rotation = 0, style }: Props) {
  const d = useMemo(() => svgPath(materialShape(name), size, rotation), [name, size, rotation]);
  return (
    <Svg width={size} height={size} style={style} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Path d={d} fill={color} />
    </Svg>
  );
});
