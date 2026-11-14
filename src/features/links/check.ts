/**
 * Does a saved link still load? One request per link, started only by the user (Settings →
 * Check saved links), never in the background. Pure apart from the injected `fetch`.
 */
export type LinkHealth = 'ok' | 'broken' | 'unsure';

/** Gone for good: not found, removed, or the site no longer exists. */
const BROKEN_STATUS = new Set([404, 410, 451]);

export function healthFromStatus(status: number): LinkHealth {
  if (status >= 200 && status < 400) return 'ok';
  if (BROKEN_STATUS.has(status)) return 'broken';
  // 401/403/429/5xx: logins, bot walls and outages. Not proof the page is gone.
  return 'unsure';
}

export async function checkLink(url: string, fetchImpl: typeof fetch = fetch, timeoutMs = 10_000): Promise<LinkHealth> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // GET (not HEAD): many sites answer HEAD with 404/405 although the page works.
    const res = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { Accept: 'text/html,*/*' } });
    return healthFromStatus(res.status);
  } catch {
    // A timeout is a slow site; a failed lookup or refused connection is a dead one.
    return ctrl.signal.aborted ? 'unsure' : 'broken';
  } finally {
    clearTimeout(timer);
  }
}

/** Runs `work` over `items`, `limit` at a time, reporting each result as it lands. */
export async function runPool<T, R>(items: T[], limit: number, work: (t: T) => Promise<R>, onResult: (t: T, r: R) => void, shouldStop = () => false) {
  let next = 0;
  const lane = async () => {
    while (next < items.length && !shouldStop()) {
      const t = items[next++];
      onResult(t, await work(t));
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}
