import { router } from 'expo-router';
import { View } from 'react-native';

import { useCapture } from '@/state/capture';
import { useColors } from '@/theme/AppTheme';
import { withAlpha } from '@/theme/palette';
import { PressableSurface } from '@/ui/PressableSurface';
import { Text } from '@/ui/Text';

/** Placeholder for the quick-save sheet (rebuilt in phase 6). Shows how many drafts arrived. */
export default function CaptureScreen() {
  const colors = useColors();
  const drafts = useCapture((s) => s.drafts);
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: withAlpha('#000000', 0.42) }}>
      <View style={{ backgroundColor: colors.surfaceContainerLow, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, gap: 16 }}>
        <Text variant="headlineSmall">Save to Stash</Text>
        <Text color="onSurfaceVariant">{`${drafts.length} item(s) waiting. The capture sheet is being rebuilt.`}</Text>
        <PressableSurface
          kind="button"
          corner={28}
          onPress={() => router.back()}
          style={{ height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}
        >
          <Text variant="labelLarge" color="onPrimary">Close</Text>
        </PressableSurface>
      </View>
    </View>
  );
}
