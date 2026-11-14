import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';
export type HomeLayout = 'cards' | 'shapes';
/** stash = the design's palette · wallpaper = Android dynamic color · seed = Expressive scheme from seedColor. */
export type ColorSource = 'stash' | 'wallpaper' | 'seed';

type Settings = {
  colorSource: ColorSource;
  /** Seed for colorSource 'seed'. */
  seedColor: string | null;
  themeMode: ThemeMode;
  homeLayout: HomeLayout;
  /** Open feed articles and saved links in Stash's reader view instead of the web page. */
  readerMode: boolean;
  /** The welcome pages were seen (first launch). */
  onboarded: boolean;
  /** The Home tour was finished or skipped. */
  tourDone: boolean;
  setOnboarded: (on: boolean) => void;
  setTourDone: (on: boolean) => void;
  setColorSource: (c: ColorSource) => void;
  setSeedColor: (c: string | null) => void;
  setThemeMode: (m: ThemeMode) => void;
  setHomeLayout: (l: HomeLayout) => void;
  setReaderMode: (on: boolean) => void;
};

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      colorSource: 'stash',
      seedColor: null,
      setColorSource: (colorSource) => set({ colorSource }),
      themeMode: 'system',
      homeLayout: 'cards',
      readerMode: true,
      onboarded: false,
      tourDone: false,
      setOnboarded: (onboarded) => set({ onboarded }),
      setTourDone: (tourDone) => set({ tourDone }),
      setSeedColor: (seedColor) => set({ seedColor }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setHomeLayout: (homeLayout) => set({ homeLayout }),
      setReaderMode: (readerMode) => set({ readerMode }),
    }),
    {
      name: 'stash.settings',
      storage: createJSONStorage(() => ({
        getItem: (k) => Storage.getItemSync(k),
        setItem: (k, v) => Storage.setItemSync(k, v),
        removeItem: (k) => Storage.removeItemSync(k),
      })),
    },
  ),
);

/** Expressive seed palette offered in Settings (besides dynamic color). */
export const SEED_COLORS = ['#6750A4', '#B3261E', '#7D5260', '#006A6A', '#386A20', '#8B5000', '#0061A4', '#984061'];
