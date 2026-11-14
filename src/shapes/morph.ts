import { type SkPath, Skia } from '@shopify/react-native-skia';

import type { Cubic, Polygon } from './geometry';
import { materialShape } from './materialShapes';
import { type MorphPair, morphPair } from './morphMatch';
import type { MaterialShapeName } from './names';

export type { MorphPair };

const pairs = new Map<string, MorphPair>();

/** Feature-matched morph between two MaterialShapes (androidx Morph), cached per pair. */
export function shapeMorph(from: MaterialShapeName, to: MaterialShapeName): MorphPair {
  const key = `${from}>${to}`;
  let p = pairs.get(key);
  if (!p) {
    p = morphPair(materialShape(from), materialShape(to));
    pairs.set(key, p);
  }
  return p;
}

/** Morph from any outline (e.g. one caught mid-morph) to a MaterialShape. */
export function morphFrom(polygon: Polygon, to: MaterialShapeName): MorphPair {
  return morphPair(polygon, materialShape(to));
}

/** The flat cubic array at progress `t`, as Cubic tuples (JS side). */
export function cubicsAt(pair: MorphPair, t: number): Cubic[] {
  const out: Cubic[] = [];
  for (let i = 0; i < pair.from.length; i += 8) {
    const c = new Array(8) as Cubic;
    for (let k = 0; k < 8; k++) c[k] = pair.from[i + k] + (pair.to[i + k] - pair.from[i + k]) * t;
    out.push(c);
  }
  return out;
}

/**
 * Largest distance of an outline from the unit-square center, checked at each cubic's
 * anchors and midpoint (androidx calculateMaxBounds). Scaling by 0.5 / radius lets the
 * shape rotate to any angle without leaving its square.
 */
export function maxRadius(flat: number[]): number {
  let r = 0;
  for (let i = 0; i < flat.length; i += 8) {
    const ax = flat[i] - 0.5;
    const ay = flat[i + 1] - 0.5;
    // B(0.5) = (a0 + 3c0 + 3c1 + a1) / 8
    const mx = (flat[i] + 3 * flat[i + 2] + 3 * flat[i + 4] + flat[i + 6]) / 8 - 0.5;
    const my = (flat[i + 1] + 3 * flat[i + 3] + 3 * flat[i + 5] + flat[i + 7]) / 8 - 0.5;
    r = Math.max(r, Math.hypot(ax, ay), Math.hypot(mx, my));
  }
  return r;
}

/**
 * Builds the morph path on the UI thread, as androidx Morph.toPath: interpolates each
 * matched cubic pair, then rotates about the center and scales into `size`. With `radius`
 * set the shape is fitted by its max radius (safe at any rotation); otherwise it fills the box.
 */
export function morphPath(
  from: number[],
  to: number[],
  t: number,
  size: number,
  rotationDeg = 0,
  radius = 0,
): SkPath {
  'worklet';
  const builder = Skia.PathBuilder.Make();
  const count = from.length;
  if (count < 8) return builder.detach();
  const a = (rotationDeg * Math.PI) / 180;
  const scale = radius > 0 ? 0.5 / radius : 1;
  const cos = Math.cos(a) * scale;
  const sin = Math.sin(a) * scale;
  const px = (i: number) => {
    'worklet';
    const x = from[i] + (to[i] - from[i]) * t - 0.5;
    const y = from[i + 1] + (to[i + 1] - from[i + 1]) * t - 0.5;
    return [(x * cos - y * sin + 0.5) * size, (x * sin + y * cos + 0.5) * size];
  };
  const [sx, sy] = px(0);
  builder.moveTo(sx, sy);
  for (let i = 0; i < count; i += 8) {
    const [c0x, c0y] = px(i + 2);
    const [c1x, c1y] = px(i + 4);
    const [ex, ey] = px(i + 6);
    builder.cubicTo(c0x, c0y, c1x, c1y, ex, ey);
  }
  builder.close();
  return builder.detach();
}
