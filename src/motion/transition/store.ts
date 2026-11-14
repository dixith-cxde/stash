import type { ReactNode } from 'react';
import { create } from 'zustand';

/** Where a container transform starts: the tapped card's window frame and look. */
export type Origin = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Card corner radius. */
  corner: number;
  /** Card container color: the growing surface keeps it, so it reads as the same object. */
  color: string;
  /** Snapshot of the card's content, drawn inside the container while it fades out. */
  ghost?: ReactNode;
};

type TransitionState = {
  origins: Record<string, Origin>;
  /** The origin currently expanded into a page; its source card hides meanwhile. */
  active: string | null;
  /** The origin a TransitionScreen has taken over; an unclaimed one is released (see useContainerSource). */
  claimed: string | null;
  open: (id: string, origin: Origin) => void;
  settle: (id: string) => void;
  claim: (id: string) => void;
};

export const useTransitions = create<TransitionState>((set) => ({
  origins: {},
  active: null,
  claimed: null,
  open: (id, origin) => set((s) => ({ origins: { ...s.origins, [id]: origin }, active: id, claimed: null })),
  claim: (id) => set({ claimed: id }),
  settle: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.origins;
      return { origins: rest, active: s.active === id ? null : s.active };
    }),
}));
