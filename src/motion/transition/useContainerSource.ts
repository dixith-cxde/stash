import { type Href, router } from 'expo-router';
import { type ComponentRef, type ReactNode, useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';

import { useTransitions } from './store';

let seq = 0;

/**
 * If the pushed route hasn't taken over the transform by then (it isn't a TransitionScreen,
 * or navigation failed), the card shows again instead of leaving a hole in the list.
 */
const CLAIM_TIMEOUT = 600;

type Look = { corner: number; color: string; ghost?: ReactNode };
type Frame = { x: number; y: number; width: number; height: number };

function push(id: string, href: Href) {
  const target = typeof href === 'string' ? { pathname: href } : href;
  router.push({ ...target, params: { ...('params' in target ? target.params : {}), origin: id } } as Href);
}

function start(id: string, href: Href, frame: Frame, look: Look) {
  useTransitions.getState().open(id, { ...frame, ...look });
  push(id, href);
  setTimeout(() => {
    const s = useTransitions.getState();
    if (s.active === id && s.claimed !== id) s.settle(id);
  }, CLAIM_TIMEOUT);
}

/**
 * Makes a card the start of a container transform. Attach `ref` to the card's outer view
 * and call `open(href)`: the card is measured, the destination route grows out of it, and
 * the card hides until the page has shrunk back into it. `openAt(href, frame)` skips the
 * measuring when the frame was already taken on the UI thread (see usePressMorph).
 *
 * The destination route must be presented as `transparentModal` and wrap its body in
 * <TransitionScreen kind="container" origin={params.origin}>; both add the `origin` param.
 */
export function useContainerSource({ corner, color, ghost }: Look) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [id] = useState(() => `origin-${++seq}`);
  const hidden = useTransitions((s) => s.active === id);

  const open = useCallback(
    (href: Href) => {
      const node = ref.current;
      if (!node) return push(id, href);
      node.measureInWindow((x: number, y: number, width: number, height: number) =>
        start(id, href, { x, y, width, height }, { corner, color, ghost }),
      );
    },
    [id, corner, color, ghost],
  );

  const openAt = useCallback(
    (href: Href, frame: { pageX: number; pageY: number; width: number; height: number } | null) => {
      if (!frame) return open(href);
      start(id, href, { x: frame.pageX, y: frame.pageY, width: frame.width, height: frame.height }, { corner, color, ghost });
    },
    [id, corner, color, ghost, open],
  );

  return { ref, open, openAt, hidden };
}
