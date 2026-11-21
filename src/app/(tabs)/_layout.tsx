import { router } from "expo-router";
import { type BottomTabBarProps, Tabs } from "expo-router/tabs";
import { useEffect } from "react";
import { useReducedMotion } from "react-native-reanimated";

import { openCapture, pickImages } from "@/features/capture/quickAdd";
import { haptic } from "@/motion/haptics";
import { ChromeProvider } from "@/motion/ScrollChrome";
import { endTabSwipe, TabSwipe } from "@/motion/TabSwipe";
import { tabTransition, tabTransitionReduced } from "@/motion/tabTransition";
import type { FabMenuItem } from "@/ui/FabMenu";
import { FloatingNavBar, type NavItem } from "@/ui/FloatingNavBar";
import { showSnackbar } from "@/ui/Snackbar";

const TABS: Record<string, Omit<NavItem, "key">> = {
  index: { label: "Home", icon: "home", selectedIcon: "homeFill" },
  library: {
    label: "Library",
    icon: "collectionsBookmark",
    selectedIcon: "collectionsBookmarkFill",
  },
  feeds: { label: "Feeds", icon: "rssFeed", selectedIcon: "rssFeed" },
  search: { label: "Search", icon: "search", selectedIcon: "searchFill" },
};

/** Left-to-right tab order for swiping between tabs. */
const TAB_ORDER = Object.keys(TABS);

/** The + menu: what you can add to the stash. */
const ADD_ITEMS: FabMenuItem[] = [
  { label: "Link", icon: "addLink", onPress: () => void openCapture("link") },
  { label: "Note", icon: "noteAdd", onPress: () => void openCapture("note") },
  { label: "File or PDF", icon: "uploadFile", onPress: () => void openCapture("file") },
  {
    label: "Images",
    icon: "addPhotoAlternate",
    onPress: () =>
      void pickImages().then((n) => {
        if (!n) return;
        haptic.save();
        showSnackbar(n === 1 ? "Image saved" : `${n} images saved`);
      }),
  },
];

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  return (
    <FloatingNavBar
      items={state.routes
        .filter((r) => TABS[r.name])
        .map((r) => ({ key: r.key, ...TABS[r.name] }))}
      selectedKey={state.routes[state.index].key}
      onSelect={navigateToTab}
      fabItems={ADD_ITEMS}
      fabLabel="Add to Stash"
    />
  );
}

/** Tabs other than Home, mounted in the background so the first switch to each is instant. */
const PRELOAD = ["/library", "/feeds", "/search"] as const;
/** Long enough for Home to finish its first render and data load. */
const PRELOAD_DELAY = 1500;

export default function TabsLayout() {
  const reduced = useReducedMotion();
  useEffect(() => {
    const t = setTimeout(() => PRELOAD.forEach((href) => router.prefetch(href)), PRELOAD_DELAY);
    return () => clearTimeout(t);
  }, []);
  return (
    <ChromeProvider>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        // Inactive tabs stay attached (hidden by the fade-through) so a swipe can show the
        // neighbouring tab beside the one being dragged.
        detachInactiveScreens={false}
        screenListeners={({ route }) => ({
          transitionEnd: () => endTabSwipe(route.name),
        })}
        screenLayout={({ children, route, navigation }) => (
          <TabSwipe order={TAB_ORDER} current={route.name} onGo={(name) => navigation.navigate(name)}>
            {children}
          </TabSwipe>
        )}
        screenOptions={({ route }) => ({
          headerShown: false,
          ...(reduced ? tabTransitionReduced(route.name) : tabTransition(route.name)),
        })}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="library" />
        <Tabs.Screen name="feeds" />
        <Tabs.Screen name="search" />
      </Tabs>
    </ChromeProvider>
  );
}
