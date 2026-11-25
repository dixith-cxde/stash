import { router } from "expo-router";
import { type BottomTabBarProps, type BottomTabNavigationOptions, Tabs } from "expo-router/tabs";
import { type ComponentProps, useEffect } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { ScreenContext } from "react-native-screens";

import { openCapture, pickImages } from "@/features/capture/quickAdd";
import { haptic } from "@/motion/haptics";
import { ChromeProvider } from "@/motion/ScrollChrome";
import { TabScreen } from "@/motion/TabScreen";
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
  { label: "Collection", icon: "createNewFolder", onPress: () => router.push("/collection/new") },
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

type TabsProps = ComponentProps<typeof Tabs>;

/*
 * Navigator props are module-level so they keep the same identity between renders: the tab
 * navigator re-runs its options, layouts and transition setup whenever they change.
 */
const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

const screenListeners: TabsProps["screenListeners"] = ({ route }) => ({
  transitionEnd: () => endTabSwipe(route.name),
});

const screenLayout: TabsProps["screenLayout"] = ({ children, route, navigation }) => (
  <TabSwipe order={TAB_ORDER} current={route.name} navigation={navigation}>
    {children}
  </TabSwipe>
);

const optionsCache = new Map<string, BottomTabNavigationOptions>();
function optionsFor(name: string, reduced: boolean) {
  const key = `${reduced ? "r" : "f"}:${name}`;
  let o = optionsCache.get(key);
  if (!o) {
    o = { headerShown: false, ...(reduced ? tabTransitionReduced(name) : tabTransition(name)) };
    optionsCache.set(key, o);
  }
  return o;
}
const screenOptionsFull: TabsProps["screenOptions"] = ({ route }) => optionsFor(route.name, false);
const screenOptionsReduced: TabsProps["screenOptions"] = ({ route }) => optionsFor(route.name, true);

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
      {/* Inactive tabs stay mounted and laid out, hidden by the fade-through (see TabScreen). */}
      <ScreenContext.Provider value={TabScreen}>
        <Tabs
          tabBar={renderTabBar}
          // Inactive tabs stay attached so a swipe can show the neighbouring tab beside the
          // one being dragged.
          detachInactiveScreens={false}
          screenListeners={screenListeners}
          screenLayout={screenLayout}
          screenOptions={reduced ? screenOptionsReduced : screenOptionsFull}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="library" />
          <Tabs.Screen name="feeds" />
          <Tabs.Screen name="search" />
        </Tabs>
      </ScreenContext.Provider>
    </ChromeProvider>
  );
}
