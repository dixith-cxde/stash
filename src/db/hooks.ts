import { addDatabaseChangeListener } from 'expo-sqlite';
import { NavigationContext } from 'expo-router/react-navigation';
import { use, useEffect, useEffectEvent, useRef, useState } from 'react';
import { devWarn } from '@/lib/log';

type Listener = () => void;

/** JSON.stringify drops Map and Set contents; keep them so changes are seen. */
const serialize = (_: string, v: unknown) => (v instanceof Map || v instanceof Set ? [...v] : v);
const listeners = new Set<Listener>();
let scheduled = false;

// One native subscription fans out to every mounted query. Bursts of row changes
// (e.g. a batch insert) are coalesced into a single re-run per frame.
addDatabaseChangeListener(() => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    listeners.forEach((l) => l());
  });
});

/** Notify subscribers after writes that bypass the update hook (e.g. FTS-only changes). */
export function invalidateQueries() {
  listeners.forEach((l) => l());
}

/**
 * Runs an async query and re-runs it whenever the database changes. Works for Drizzle
 * builders and raw SQL alike (FTS, recursive CTEs), unlike drizzle's useLiveQuery.
 *
 * Battery: a query on a screen that is not focused (another tab, or under a page) does not
 * re-run on changes; it is marked stale and refreshes once when its screen regains focus.
 * Outside a navigator (e.g. sheets in the root portal) it always stays live.
 */
export function useDbQuery<T>(query: () => Promise<T>, deps: unknown[], initial: T): { data: T; loading: boolean } {
  const [state, setState] = useState<{ data: T; loading: boolean }>({ data: initial, loading: true });
  const runQuery = useEffectEvent(query);
  const navigation = use(NavigationContext);
  const focused = useRef(true);
  const stale = useRef(false);
  const run = useRef<() => void>(() => {});
  /** Serialized last result: an unchanged re-run (e.g. refresh on focus) skips the re-render. */
  const last = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let version = 0;
    const exec = () => {
      const v = ++version;
      stale.current = false;
      runQuery()
        .then((data) => {
          if (cancelled || v !== version) return;
          const key = JSON.stringify(data, serialize);
          if (key === last.current) {
            setState((s) => (s.loading ? { ...s, loading: false } : s));
            return;
          }
          last.current = key;
          setState({ data, loading: false });
        })
        .catch((e) => {
          devWarn('[useDbQuery]', e);
          if (!cancelled && v === version) setState((s) => ({ ...s, loading: false }));
        });
    };
    run.current = exec;
    const onChange = () => {
      if (focused.current) exec();
      else stale.current = true;
    };
    exec();
    listeners.add(onChange);
    return () => {
      cancelled = true;
      listeners.delete(onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!navigation) return;
    // Read after mount: during render isFocused() can be stale.
    focused.current = navigation.isFocused();
    const offFocus = navigation.addListener('focus', () => {
      focused.current = true;
      if (stale.current) run.current();
    });
    const offBlur = navigation.addListener('blur', () => {
      focused.current = false;
    });
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);

  return state;
}
