import { router } from 'expo-router';

import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

export default function NewCollection() {
  return (
    <Sheet accessibilityLabel="New collection" onDismiss={() => router.back()}>
      <Text variant="headlineSmall">New collection</Text>
    </Sheet>
  );
}
