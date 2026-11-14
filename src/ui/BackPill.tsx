import { useColors } from '@/theme/AppTheme';
import { withAlpha } from '@/theme/palette';

import { Ico } from './Ico';
import { PressableSurface } from './PressableSurface';
import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  /** Over a colored hero: translucent dark pill with the hero's content color. */
  onHero?: string;
};

/** "← Library" back button (design: 48dp pill). */
export function BackPill({ label, onPress, onHero }: Props) {
  const colors = useColors();
  const fg = onHero ?? colors.onSurface;
  return (
    <PressableSurface
      kind="button"
      corner={24}
      pressedCorner={16}
      onPress={onPress}
      accessibilityLabel={`Back to ${label}`}
      style={{
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 12,
        paddingRight: 18,
        alignSelf: 'flex-start',
        backgroundColor: onHero ? withAlpha(colors.surface, 0.5) : colors.surfaceContainerHigh,
      }}
    >
      <Ico name="arrowBack" size={24} color={fg} />
      <Text variant="labelLargeEmphasized" color={fg}>
        {label}
      </Text>
    </PressableSurface>
  );
}

/** Round icon button for hero toolbars (design: "⋮" over the hero). */
export function HeroIconButton({
  icon,
  label,
  onPress,
  onHero,
}: {
  icon: 'moreVert' | 'share';
  label: string;
  onPress: () => void;
  onHero?: string;
}) {
  const colors = useColors();
  return (
    <PressableSurface
      kind="button"
      corner={24}
      pressedCorner={16}
      onPress={onPress}
      accessibilityLabel={label}
      style={{
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: onHero ? withAlpha(colors.surface, 0.5) : colors.surfaceContainerHigh,
      }}
    >
      <Ico name={icon} size={24} color={onHero ?? colors.onSurface} />
    </PressableSurface>
  );
}
