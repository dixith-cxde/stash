import { IconButton, Text, TopAppBar } from '@expo/ui/jetpack-compose';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme/AppTheme';

import { Ico } from './Ico';

/** Small top app bar with back navigation; `actions` are IconButtons. */
export function TopBar({ title, actions, onBack }: { title?: string; actions?: React.ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  return (
    <TopAppBar windowInsets={{ top: insets.top }} colors={{ containerColor: colors.surface }}>
      <TopAppBar.NavigationIcon>
        <IconButton onClick={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}>
          <Ico name="arrowBack" label="Back" />
        </IconButton>
      </TopAppBar.NavigationIcon>
      <TopAppBar.Title>
        <Text maxLines={1} overflow="ellipsis" style={{ typography: 'titleLarge', fontWeight: '600' }}>
          {title ?? ''}
        </Text>
      </TopAppBar.Title>
      {actions ? <TopAppBar.Actions>{actions}</TopAppBar.Actions> : null}
    </TopAppBar>
  );
}
