import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const MAX = 8;

type SearchHistory = {
  /** Most recent first, case-insensitively unique. */
  recent: string[];
  remember: (query: string) => void;
  forget: (query: string) => void;
  clear: () => void;
};

/** The Search tab's recent searches (last 8), persisted like settings via expo-sqlite/kv-store. */
export const useSearchHistory = create<SearchHistory>()(
  persist(
    (set) => ({
      recent: [],
      remember: (query) => {
        const q = query.trim();
        if (!q) return;
        set((s) => ({ recent: [q, ...s.recent.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, MAX) }));
      },
      forget: (query) => set((s) => ({ recent: s.recent.filter((r) => r !== query) })),
      clear: () => set({ recent: [] }),
    }),
    {
      name: 'stash.searchHistory',
      storage: createJSONStorage(() => ({
        getItem: (k) => Storage.getItemSync(k),
        setItem: (k, v) => Storage.setItemSync(k, v),
        removeItem: (k) => Storage.removeItemSync(k),
      })),
      partialize: (s) => ({ recent: s.recent }),
    },
  ),
);
