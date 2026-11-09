import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useEffectEvent, useState } from 'react';

type Listener = () => void;
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
 */
export function useDbQuery<T>(query: () => Promise<T>, deps: unknown[], initial: T): { data: T; loading: boolean } {
  const [state, setState] = useState<{ data: T; loading: boolean }>({ data: initial, loading: true });
  const runQuery = useEffectEvent(query);

  useEffect(() => {
    let cancelled = false;
    let version = 0;
    const run = () => {
      const v = ++version;
      runQuery()
        .then((data) => {
          if (!cancelled && v === version) setState({ data, loading: false });
        })
        .catch((e) => {
          console.warn('[useDbQuery]', e);
          if (!cancelled && v === version) setState((s) => ({ ...s, loading: false }));
        });
    };
    run();
    listeners.add(run);
    return () => {
      cancelled = true;
      listeners.delete(run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
