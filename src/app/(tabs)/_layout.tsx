import { router } from "expo-router";
import { type BottomTabBarProps, Tabs } from "expo-router/tabs";
import { useEffect } from "react";

import { openQuickAdd } from "@/features/capture/quickAdd";
import { ChromeProvider } from "@/motion/ScrollChrome";
import { TAB_TRANSITION } from "@/motion/tabTransition";
import { FloatingNavBar, type NavItem } from "@/ui/FloatingNavBar";

const TABS: Record<string, Omit<NavItem, "key">> = {
  index: { label: "Home", icon: "home", selectedIcon: "homeFill" },
  library: {
    label: "Library",
    icon: "collectionsBookmark",
    selectedIcon: "collectionsBookmarkFill",
  },
  highlights: {
    label: "Highlights",
    icon: "inkHighlighter",
    selectedIcon: "inkHighlighterFill",
  },
  search: { label: "Search", icon: "search", selectedIcon: "searchFill" },
};

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  return (
    <FloatingNavBar
      items={state.routes
        .filter((r) => TABS[r.name])
        .map((r) => ({ key: r.key, ...TABS[r.name] }))}
      selectedKey={state.routes[state.index].key}
      onSelect={navigateToTab}
      onFab={() => void openQuickAdd()}
      fabLabel="Add to Stash"
    />
  );
}

/** Tabs other than Home, mounted in the background so the first switch to each is instant. */
const PRELOAD = ["/library", "/highlights", "/search"] as const;
/** Long enough for Home to finish its first render and data load. */
const PRELOAD_DELAY = 1500;

export default function TabsLayout() {
  useEffect(() => {
    const t = setTimeout(() => PRELOAD.forEach((href) => router.prefetch(href)), PRELOAD_DELAY);
    return () => clearTimeout(t);
  }, []);
  return (
    <ChromeProvider>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, freezeOnBlur: true, ...TAB_TRANSITION }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="library" />
        <Tabs.Screen name="highlights" />
        <Tabs.Screen name="search" />
      </Tabs>
    </ChromeProvider>
  );
}
