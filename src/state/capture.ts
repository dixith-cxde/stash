import { create } from 'zustand';

import type { CaptureDraft } from '@/features/capture/normalize';

type CaptureState = {
  drafts: CaptureDraft[];
  /** True when another app launched us (share sheet / text selection): return there after saving. */
  external: boolean;
  setDrafts: (d: CaptureDraft[], external?: boolean) => void;
  clear: () => void;
};

/** Drafts handed over from the share sheet / text-selection menu to the capture screen. */
export const useCapture = create<CaptureState>((set) => ({
  drafts: [],
  external: false,
  setDrafts: (drafts, external = false) => set({ drafts, external }),
  clear: () => set({ drafts: [], external: false }),
}));
