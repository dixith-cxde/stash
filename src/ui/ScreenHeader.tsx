import { View } from 'react-native';

import type { TypeVariant } from '@/theme/type';
import { Layout } from '@/theme/tokens';

import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string;
  /** displayLarge on Home ("Stash"), displayMedium elsewhere ("Library"). */
  size?: Extract<TypeVariant, 'displayLarge' | 'displayMedium'>;
  trailing?: React.ReactNode;
};

/** Large expressive page title with a one-line summary and an optional action (design header). */
export function ScreenHeader({ title, subtitle, size = 'displayMedium', trailing }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingLeft: Layout.textInset, paddingRight: 20, paddingTop: 20, paddingBottom: 4 }}>
      <View style={{ flex: 1 }}>
        <Text variant={size} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodyMedium" color="onSurfaceVariant" style={{ marginTop: 4 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

/** Section title row: "Collections 6 ··· See all". */
export function SectionHeader({ title, count, trailing }: { title: string; count?: number; trailing?: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: Layout.textInset,
        paddingRight: Layout.gutter,
        paddingTop: 28,
        paddingBottom: 12,
        minHeight: 40,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {title}
        </Text>
        {count !== undefined && (
          <Text variant="bodyMedium" color="onSurfaceVariant" style={{ fontWeight: '600' }}>
            {count}
          </Text>
        )}
      </View>
      {trailing}
    </View>
  );
}

/** Small uppercase label ("SMART VIEWS", "ORGANIZE"). */
export function Overline({ children, inset = true }: { children: string; inset?: boolean }) {
  return (
    <Text variant="overline" color="primary" style={inset ? { paddingHorizontal: Layout.textInset, paddingTop: 24, paddingBottom: 10 } : undefined}>
      {children}
    </Text>
  );
}
