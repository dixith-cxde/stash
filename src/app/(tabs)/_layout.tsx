import { type BottomTabBarProps, Tabs } from 'expo-router/tabs';

import { openQuickAdd } from '@/features/capture/quickAdd';
import { FloatingNavBar, type NavItem } from '@/ui/FloatingNavBar';

const TABS: Record<string, Omit<NavItem, 'key'>> = {
  index: { label: 'Home', icon: 'home', selectedIcon: 'homeFill' },
  library: { label: 'Library', icon: 'collectionsBookmark', selectedIcon: 'collectionsBookmarkFill' },
  highlights: { label: 'Highlights', icon: 'inkHighlighter', selectedIcon: 'inkHighlighterFill' },
  search: { label: 'Search', icon: 'search', selectedIcon: 'searchFill' },
};

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  return (
    <FloatingNavBar
      items={state.routes.filter((r) => TABS[r.name]).map((r) => ({ key: r.key, ...TABS[r.name] }))}
      selectedKey={state.routes[state.index].key}
      onSelect={navigateToTab}
      onFab={() => void openQuickAdd()}
      fabLabel="Add to Stash"
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: 'none' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="highlights" />
      <Tabs.Screen name="search" />
    </Tabs>
  );
}
