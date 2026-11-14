import { type Cubic, type Polygon, pointOnCurve } from './geometry';

/** Exact SVG path of a unit-square polygon scaled to `size` (for static shapes). */
export function svgPath(p: Polygon, size: number, rotationDeg = 0): string {
  const a = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const tx = (x: number, y: number) => {
    const dx = x - 0.5;
    const dy = y - 0.5;
    return `${((dx * cos - dy * sin + 0.5) * size).toFixed(2)} ${((dx * sin + dy * cos + 0.5) * size).toFixed(2)}`;
  };
  const c0 = p.cubics[0];
  let d = `M${tx(c0[0], c0[1])}`;
  for (const c of p.cubics) d += `C${tx(c[2], c[3])} ${tx(c[4], c[5])} ${tx(c[6], c[7])}`;
  return `${d}Z`;
}

const SUBDIV = 16;

function cubicLength(c: Cubic): number {
  let total = 0;
  let prev = pointOnCurve(c, 0);
  for (let i = 1; i <= SUBDIV; i++) {
    const p = pointOnCurve(c, i / SUBDIV);
    total += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return total;
}

/**
 * Samples the outline at `count` points evenly spaced by arc length, clockwise on screen,
 * as a flat [x0, y0, x1, y1, …] array in unit coordinates (geometry checks and hit areas).
 */
export function samplePolygon(p: Polygon, count: number): number[] {
  const lengths = p.cubics.map(cubicLength);
  const total = lengths.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let ci = 0;
  let acc = 0;
  for (let i = 0; i < count; i++) {
    const target = (i / count) * total;
    while (ci < lengths.length - 1 && acc + lengths[ci] < target) acc += lengths[ci++];
    const t = lengths[ci] > 0 ? Math.min(1, (target - acc) / lengths[ci]) : 0;
    const q = pointOnCurve(p.cubics[ci], t);
    out.push(q.x, q.y);
  }
  // Keep a single winding so point i of one shape lines up with point i of another.
  let area = 0;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    area += out[i * 2] * out[j * 2 + 1] - out[j * 2] * out[i * 2 + 1];
  }
  return area < 0 ? reversePoints(out) : out;
}

function reversePoints(pts: number[]): number[] {
  const n = pts.length / 2;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (n - i) % n;
    out.push(pts[j * 2], pts[j * 2 + 1]);
  }
  return out;
}
