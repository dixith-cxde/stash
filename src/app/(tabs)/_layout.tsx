import { type BottomTabBarProps, Tabs } from 'expo-router/tabs';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openQuickAdd } from '@/features/capture/quickAdd';
import { AppHost } from '@/theme/AppTheme';
import { type IconName, nativeIcon } from '@/theme/icons';

import { StashNavToolbar } from '../../../modules/expressive';

const TABS: Record<string, { label: string; icon: IconName; selectedIcon: IconName }> = {
  index: { label: 'Home', icon: 'home', selectedIcon: 'homeFill' },
  library: { label: 'Library', icon: 'collectionsBookmark', selectedIcon: 'collectionsBookmarkFill' },
  highlights: { label: 'Highlights', icon: 'inkHighlighter', selectedIcon: 'inkHighlighterFill' },
  search: { label: 'Search', icon: 'search', selectedIcon: 'searchFill' },
};

/**
 * M3 Expressive floating toolbar with the add FAB attached, floating over the tab content
 * (screens pad their scroll content so the last row clears it).
 */
function FloatingTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index];
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <AppHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <StashNavToolbar
          items={state.routes
            .filter((r) => TABS[r.name])
            .map((r) => ({
              key: r.key,
              label: TABS[r.name].label,
              icon: nativeIcon(TABS[r.name].icon),
              selectedIcon: nativeIcon(TABS[r.name].selectedIcon),
            }))}
          selectedKey={current.key}
          fabIcon={nativeIcon('add')}
          fabLabel="Add to Stash"
          bottomInset={insets.bottom}
          onAction={({ action, key }) => {
            if (action === 'tab') navigateToTab(key);
            if (action === 'fab') void openQuickAdd();
          }}
        />
      </AppHost>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="highlights" />
      <Tabs.Screen name="search" />
    </Tabs>
  );
}
