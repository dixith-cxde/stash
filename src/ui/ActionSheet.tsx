import { View } from 'react-native';

import { useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';

import { Ico } from './Ico';
import { PressableSurface } from './PressableSurface';
import { Sheet } from './Sheet';
import { Text } from './Text';

export type SheetAction = { label: string; icon: IconName; onPress: () => void; destructive?: boolean };

/** A list of actions in the modal sheet; the sheet animates away before the action runs. */
export function ActionSheet({ title, actions, onDismiss }: { title?: string; actions: SheetAction[]; onDismiss: () => void }) {
  const colors = useColors();
  return (
    <Sheet accessibilityLabel={title ?? 'Actions'} onDismiss={onDismiss}>
      {(close) => (
        <View style={{ gap: 2 }}>
          {title ? (
            <Text variant="titleMedium" style={{ paddingHorizontal: 8, paddingBottom: 10 }} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {actions.map((a) => (
            <PressableSurface
              key={a.label}
              kind="button"
              corner={20}
              pressedScale={0.98}
              onPress={() => {
                close();
                setTimeout(a.onPress, 180);
              }}
              style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16 }}
            >
              <Ico name={a.icon} size={24} color={a.destructive ? colors.error : colors.onSurfaceVariant} />
              <Text variant="bodyLarge" color={a.destructive ? 'error' : 'onSurface'} style={{ fontWeight: '500' }}>
                {a.label}
              </Text>
            </PressableSurface>
          ))}
        </View>
      )}
    </Sheet>
  );
}
