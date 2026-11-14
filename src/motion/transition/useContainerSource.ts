import { type Href, router } from 'expo-router';
import { type ComponentRef, type ReactNode, useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';

import { useTransitions } from './store';

let seq = 0;

/**
 * Makes a card the start of a container transform. Attach `ref` to the card's outer view
 * and call `open(href)`: the card is measured, the destination route grows out of it, and
 * the card hides until the page has shrunk back into it.
 *
 * The destination route must be presented as `transparentModal` and wrap its body in
 * <TransitionScreen kind="container" origin={params.origin}>; `open` adds the `origin` param.
 */
export function useContainerSource({ corner, color, ghost }: { corner: number; color: string; ghost?: ReactNode }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [id] = useState(() => `origin-${++seq}`);
  const hidden = useTransitions((s) => s.active === id);

  const open = useCallback(
    (href: Href) => {
      const node = ref.current;
      const go = () => {
        const target = typeof href === 'string' ? { pathname: href } : href;
        router.push({ ...target, params: { ...('params' in target ? target.params : {}), origin: id } } as Href);
      };
      if (!node) return go();
      node.measureInWindow((x: number, y: number, width: number, height: number) => {
        useTransitions.getState().open(id, { x, y, width, height, corner, color, ghost });
        go();
      });
    },
    [id, corner, color, ghost],
  );

  return { ref, open, hidden };
}
