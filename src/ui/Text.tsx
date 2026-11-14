import { Text as RNText, type TextProps } from 'react-native';

import { useColors } from '@/theme/AppTheme';
import type { ColorRole } from '@/theme/palette';
import { FONT_FAMILY, Type, type TypeVariant } from '@/theme/type';

type Props = TextProps & {
  variant?: TypeVariant;
  /** A color role, or a literal color for content on custom containers (collection tones). */
  color?: ColorRole | (string & {});
};

/** Text in the Stash type scale. Defaults to bodyMedium on `onSurface`. */
export function Text({ variant = 'bodyMedium', color = 'onSurface', style, ...rest }: Props) {
  const colors = useColors();
  const resolved = color in colors ? colors[color as ColorRole] : color;
  return <RNText {...rest} style={[{ fontFamily: FONT_FAMILY, color: resolved }, Type[variant], style]} />;
}
