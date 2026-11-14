import { useRef } from 'react';
import { View } from 'react-native';
import { create } from 'zustand';

export type TourRect = { x: number; y: number; w: number; h: number; r: number };

/** Where the Home tour's targets sit on screen (window coordinates), filled in by TourTarget. */
export const useTourTargets = create<{ rects: Record<string, TourRect>; set: (id: string, rect: TourRect) => void }>()((set) => ({
  rects: {},
  set: (id, rect) => set((s) => ({ rects: { ...s.rects, [id]: rect } })),
}));

/** Marks a view as a Home tour target: its on-screen frame is measured whenever it lays out. */
export function TourTarget({ id, radius, children }: { id: string; radius: number; children: React.ReactNode }) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const set = useTourTargets((s) => s.set);
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={() => ref.current?.measureInWindow((x, y, w, h) => w > 0 && set(id, { x, y, w, h, r: radius }))}
    >
      {children}
    </View>
  );
}
