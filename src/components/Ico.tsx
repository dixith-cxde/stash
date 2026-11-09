import { Icon } from '@expo/ui/jetpack-compose';
import type { ColorValue } from 'react-native';

import { type IconName, Icons } from '@/theme/icons';

/** Material Symbols Rounded icon for use inside a Compose tree. */
export function Ico({
  name,
  size = 24,
  tint,
  label,
}: {
  name: IconName;
  size?: number;
  tint?: ColorValue;
  label?: string;
}) {
  return <Icon source={Icons[name]} size={size} tint={tint} contentDescription={label} />;
}
