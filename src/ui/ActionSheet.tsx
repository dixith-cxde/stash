import { View } from 'react-native';

import { useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';

import { Ico } from './Ico';
import { ListGroup, ListItem } from './List';
import { Sheet } from './Sheet';
import { Text } from './Text';

export type SheetAction = { label: string; icon: IconName; onPress: () => void; destructive?: boolean };

/**
 * Actions in a modal sheet (the compact-window stand-in for an M3 vertical menu): a segmented
 * group of items, destructive actions split off into their own group by a gap. The sheet
 * animates away before the action runs.
 */
export function ActionSheet({ title, actions, onDismiss }: { title?: string; actions: SheetAction[]; onDismiss: () => void }) {
  const colors = useColors();
  const groups = [actions.filter((a) => !a.destructive), actions.filter((a) => a.destructive)].filter((g) => g.length);
  return (
    <Sheet accessibilityLabel={title ?? 'Actions'} onDismiss={onDismiss}>
      {(close) => (
        <View style={{ gap: 12 }}>
          {title ? (
            <Text variant="titleMediumEmphasized" style={{ paddingHorizontal: 8 }} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {groups.map((group, gi) => (
            <ListGroup key={gi}>
              {group.map((a) => (
                <ListItem
                  key={a.label}
                  title={a.label}
                  container={a.destructive ? 'errorContainer' : 'surfaceContainerHigh'}
                  titleColor={a.destructive ? 'onErrorContainer' : 'onSurface'}
                  leading={<Ico name={a.icon} size={24} color={a.destructive ? colors.onErrorContainer : colors.onSurfaceVariant} />}
                  onPress={() => {
                    close();
                    setTimeout(a.onPress, 180);
                  }}
                />
              ))}
            </ListGroup>
          ))}
        </View>
      )}
    </Sheet>
  );
}
