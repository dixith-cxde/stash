import { Fragment, type ReactNode, useEffect, useId, useLayoutEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';

type PortalState = {
  nodes: Record<string, ReactNode>;
  order: string[];
  mount: (id: string, node: ReactNode) => void;
  unmount: (id: string) => void;
};

const usePortals = create<PortalState>((set) => ({
  nodes: {},
  order: [],
  mount: (id, node) =>
    set((s) => ({ nodes: { ...s.nodes, [id]: node }, order: s.order.includes(id) ? s.order : [...s.order, id] })),
  unmount: (id) =>
    set((s) => {
      const { [id]: _, ...nodes } = s.nodes;
      return { nodes, order: s.order.filter((k) => k !== id) };
    }),
}));

/**
 * Renders its children in the root PortalHost, above every screen, instead of where it is
 * written. Sheets use it so a sheet opened from inside a scrolling card is never clipped or
 * covered by later content.
 */
export function Portal({ children }: { children: ReactNode }) {
  const id = useId();
  const mount = usePortals((s) => s.mount);
  const unmount = usePortals((s) => s.unmount);
  useLayoutEffect(() => {
    mount(id, children);
  });
  useEffect(() => () => unmount(id), [id, unmount]);
  return null;
}

/** Mount once at the root, after the navigator. */
export function PortalHost() {
  const nodes = usePortals((s) => s.nodes);
  const order = usePortals((s) => s.order);
  if (!order.length) return null;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {order.map((k) => (
        <Fragment key={k}>{nodes[k]}</Fragment>
      ))}
    </View>
  );
}
