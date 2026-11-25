import { View } from 'react-native';

import { useColors } from '@/theme/AppTheme';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

/** A yes/no question in a sheet (bulk delete). The sheet animates away before `onConfirm` runs. */
export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  onConfirm,
  onDismiss,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const colors = useColors();
  return (
    <Sheet accessibilityLabel={title} onDismiss={onDismiss}>
      {(close) => (
        <View style={{ gap: 12 }}>
          <Text variant="headlineSmallEmphasized" style={{ paddingHorizontal: 8 }}>
            {title}
          </Text>
          <Text variant="bodyMedium" color="onSurfaceVariant" style={{ paddingHorizontal: 8 }}>
            {body}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Button label="Cancel" variant="tonal" grow onPress={close} />
            <Button
              label={confirmLabel}
              icon="delete"
              grow
              colors={{ bg: colors.error, fg: colors.onError }}
              onPress={() => {
                close();
                setTimeout(onConfirm, 180);
              }}
            />
          </View>
        </View>
      )}
    </Sheet>
  );
}
