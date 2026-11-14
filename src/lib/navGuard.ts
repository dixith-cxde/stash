import { router } from 'expo-router';

/** Pushes closer together than this are dropped: two quick taps must not stack two screens. */
const GUARD_MS = 600;

let installed = false;

/**
 * Wraps router.push / navigate once so a second push within GUARD_MS of the first is ignored
 * (double taps on two different cards, a tap during a transition). Back is never blocked.
 */
export function installNavGuard() {
  if (installed) return;
  installed = true;
  let last = 0;
  const guard = <F extends (...args: never[]) => unknown>(original: F): F =>
    ((...args: Parameters<F>) => {
      const now = Date.now();
      if (now - last < GUARD_MS) return;
      last = now;
      return original(...args);
    }) as F;
  router.push = guard(router.push);
  router.navigate = guard(router.navigate);
}
