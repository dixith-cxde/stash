import { useFocusEffect } from 'expo-router';
import { createContext, use, useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { createStore, type StoreApi, useStore } from 'zustand';

import { useChromeHidden } from '@/motion/ScrollChrome';
import { springTo, useSprings } from '@/motion/springs';

/**
 * Multi-select for a screen's cards. A long press starts it on that card; while anything is
 * selected, taps toggle cards instead of opening them. Clearing the last one ends it.
 * Keys are the screen's own ids ("b:<id>" / "h:<id>" for feed items, folder ids, …).
 */
type State = { keys: ReadonlySet<string> };
export type SelectionStore = StoreApi<State>;

const EMPTY: ReadonlySet<string> = new Set();
const createSelection = (): SelectionStore => createStore<State>(() => ({ keys: EMPTY }));
/** Stand-in when a card is outside any selection scope (hooks can't be conditional). */
const NONE = createSelection();

export const selection = {
  toggle(store: SelectionStore, key: string) {
    const keys = new Set(store.getState().keys);
    if (keys.has(key)) keys.delete(key);
    else keys.add(key);
    store.setState({ keys });
  },
  /** Long press: starts selecting with this card, or toggles it when already selecting. */
  start(store: SelectionStore, key: string) {
    selection.toggle(store, key);
  },
  set(store: SelectionStore, keys: Iterable<string>) {
    store.setState({ keys: new Set(keys) });
  },
  clear(store: SelectionStore) {
    if (store.getState().keys.size) store.setState({ keys: EMPTY });
  },
};

/** The screen's selection store (stable for the screen's life). */
export function useSelectionStore() {
  return useState(createSelection)[0];
}

/** Every selected key; re-renders the caller on each change (screens and bars only). */
export function useSelectedKeys(store: SelectionStore) {
  return useStore(store, (s) => s.keys);
}

/** Provides the store to cards below. */
export const SelectionScope = createContext<SelectionStore | null>(null);
/** The selection key of the card below (so card variants don't all need a prop). */
export const SelectKey = createContext<string | null>(null);

export type Selectable = { active: boolean; selected: boolean; toggle: () => void };

/**
 * For a card: whether selection mode is on, whether this card is selected, and its toggle.
 * Null outside a selection scope or without a key. Only re-renders when those booleans flip.
 */
export function useSelectable(keyProp?: string | null): Selectable | null {
  const scoped = use(SelectionScope);
  const ctxKey = use(SelectKey);
  const key = keyProp ?? ctxKey;
  const store = scoped && key ? scoped : NONE;
  const active = useStore(store, (s) => s.keys.size > 0);
  const selected = useStore(store, (s) => (key ? s.keys.has(key) : false));
  const toggle = useCallback(() => {
    if (key) selection.toggle(store, key);
  }, [store, key]);
  return store === NONE ? null : { active, selected, toggle };
}

/**
 * Screen side of selection mode: Back clears it, leaving the screen (another tab, a pushed
 * page) clears it, the floating nav bar hides while selecting, and keys whose cards are no
 * longer shown (deleted, filtered out) drop out of the selection.
 */
export function useSelectionMode(store: SelectionStore, visibleKeys: readonly string[]) {
  // Only the on/off state: subscribing to the keys re-rendered the whole screen on every tap.
  const active = useStore(store, (s) => s.keys.size > 0);
  const chrome = useChromeHidden();
  const springs = useSprings();

  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      selection.clear(store);
      return true;
    });
    return () => sub.remove();
  }, [active, store]);

  useFocusEffect(useCallback(() => () => selection.clear(store), [store]));

  const wasActive = useRef(false);
  useEffect(() => {
    if (!chrome || wasActive.current === active) return;
    wasActive.current = active;
    chrome.set(springTo(active ? 1 : 0, springs.defaultEffects));
  }, [active, chrome, springs]);

  const visibleSig = visibleKeys.join('|');
  useEffect(() => {
    const current = store.getState().keys;
    if (!current.size) return;
    const visible = new Set(visibleSig ? visibleSig.split('|') : []);
    const kept = [...current].filter((k) => visible.has(k));
    if (kept.length !== current.size) selection.set(store, kept);
  }, [visibleSig, store]);

  return { active };
}
