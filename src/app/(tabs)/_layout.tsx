import { NavigationBar, NavigationBarItem, Text } from '@expo/ui/jetpack-compose';
import { type BottomTabBarProps, Tabs } from 'expo-router/tabs';

import { Ico } from '@/components/Ico';
import { AppHost, useColors } from '@/theme/AppTheme';
import type { IconName } from '@/theme/icons';

const TABS: Record<string, { label: string; icon: IconName; selectedIcon: IconName }> = {
  index: { label: 'Home', icon: 'home', selectedIcon: 'homeFill' },
  library: { label: 'Library', icon: 'collectionsBookmark', selectedIcon: 'collectionsBookmarkFill' },
  highlights: { label: 'Highlights', icon: 'inkHighlighter', selectedIcon: 'inkHighlighterFill' },
  search: { label: 'Search', icon: 'search', selectedIcon: 'searchFill' },
};

/** Compose Material 3 NavigationBar, so the bar shares the Expressive theme and motion. */
function ExpressiveTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const colors = useColors();
  return (
    <AppHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <NavigationBar containerColor={colors.surfaceContainer}>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const selected = state.index === index;
          return (
            <NavigationBarItem
              key={route.key}
              selected={selected}
              onClick={() => {
                if (!selected) navigateToTab(route.key);
              }}>
              <NavigationBarItem.Icon>
                <Ico name={selected ? tab.selectedIcon : tab.icon} label={tab.label} />
              </NavigationBarItem.Icon>
              <NavigationBarItem.Label>
                <Text style={{ fontWeight: selected ? '700' : '500' }}>{tab.label}</Text>
              </NavigationBarItem.Label>
            </NavigationBarItem>
          );
        })}
      </NavigationBar>
    </AppHost>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <ExpressiveTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'shift' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="highlights" />
      <Tabs.Screen name="search" />
    </Tabs>
  );
}
