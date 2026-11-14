/**
 * TypeScript port of androidx.graphics.shapes (graphics-shapes 1.x): Cubic, RoundedPolygon with
 * per-vertex CornerRounding (radius + smoothing), and the circle/rectangle/star helpers.
 * Kept close to the Kotlin source so MaterialShapes render identically to Compose.
 * Source: androidx-main graphics/graphics-shapes/src/commonMain/kotlin/androidx/graphics/shapes.
 */

export type Pt = { x: number; y: number };
/** [anchor0X, anchor0Y, control0X, control0Y, control1X, control1Y, anchor1X, anchor1Y] */
export type Cubic = [number, number, number, number, number, number, number, number];
export type CornerRounding = { radius: number; smoothing: number };
/** A corner (rounded vertex; convex or concave) or a straight edge, as androidx Feature. */
export type Feature = { cubics: Cubic[]; corner: boolean; convex: boolean };
export type Polygon = { cubics: Cubic[]; features: Feature[]; center: Pt };

export const Unrounded: CornerRounding = { radius: 0, smoothing: 0 };
export const rounding = (radius: number, smoothing = 0): CornerRounding => ({ radius, smoothing });

const DistanceEpsilon = 1e-4;

// --- Point math -----------------------------------------------------------------------------

const pt = (x: number, y: number): Pt => ({ x, y });
const add = (a: Pt, b: Pt) => pt(a.x + b.x, a.y + b.y);
const sub = (a: Pt, b: Pt) => pt(a.x - b.x, a.y - b.y);
const mul = (a: Pt, k: number) => pt(a.x * k, a.y * k);
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const len = (a: Pt) => Math.hypot(a.x, a.y);
const rotate90 = (a: Pt) => pt(-a.y, a.x);
function direction(a: Pt): Pt {
  const d = len(a);
  if (!(d > 0)) throw new Error('Required distance greater than zero');
  return mul(a, 1 / d);
}
const lerp = (a: number, b: number, t: number) => (1 - t) * a + t * b;
const lerpPt = (a: Pt, b: Pt, t: number) => pt(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
const radial = (r: number, angle: number, c: Pt = pt(0, 0)) => pt(Math.cos(angle) * r + c.x, Math.sin(angle) * r + c.y);

// --- Cubic ----------------------------------------------------------------------------------

export function cubic(a0: Pt, c0: Pt, c1: Pt, a1: Pt): Cubic {
  return [a0.x, a0.y, c0.x, c0.y, c1.x, c1.y, a1.x, a1.y];
}

export function pointOnCurve(c: Cubic, t: number): Pt {
  const u = 1 - t;
  return pt(
    c[0] * u * u * u + c[2] * 3 * t * u * u + c[4] * 3 * t * t * u + c[6] * t * t * t,
    c[1] * u * u * u + c[3] * 3 * t * u * u + c[5] * 3 * t * t * u + c[7] * t * t * t,
  );
}

export const zeroLength = (c: Cubic) => Math.abs(c[0] - c[6]) < DistanceEpsilon && Math.abs(c[1] - c[7]) < DistanceEpsilon;

export function straightLine(x0: number, y0: number, x1: number, y1: number): Cubic {
  return [x0, y0, lerp(x0, x1, 1 / 3), lerp(y0, y1, 1 / 3), lerp(x0, x1, 2 / 3), lerp(y0, y1, 2 / 3), x1, y1];
}

export function circularArc(cx: number, cy: number, x0: number, y0: number, x1: number, y1: number): Cubic {
  const p0d = direction(pt(x0 - cx, y0 - cy));
  const p1d = direction(pt(x1 - cx, y1 - cy));
  const r0 = rotate90(p0d);
  const r1 = rotate90(p1d);
  const clockwise = dot(r0, pt(x1 - cx, y1 - cy)) >= 0;
  const cosa = dot(p0d, p1d);
  if (cosa > 0.999) return straightLine(x0, y0, x1, y1);
  const k =
    ((Math.hypot(x0 - cx, y0 - cy) * 4) / 3) *
    ((Math.sqrt(2 * (1 - cosa)) - Math.sqrt(1 - cosa * cosa)) / (1 - cosa)) *
    (clockwise ? 1 : -1);
  return [x0, y0, x0 + r0.x * k, y0 + r0.y * k, x1 - r1.x * k, y1 - r1.y * k, x1, y1];
}

export function split(c: Cubic, t: number): [Cubic, Cubic] {
  const u = 1 - t;
  const p = pointOnCurve(c, t);
  return [
    [c[0], c[1], c[0] * u + c[2] * t, c[1] * u + c[3] * t, c[0] * u * u + c[2] * 2 * u * t + c[4] * t * t,
      c[1] * u * u + c[3] * 2 * u * t + c[5] * t * t, p.x, p.y],
    [p.x, p.y, c[2] * u * u + c[4] * 2 * u * t + c[6] * t * t, c[3] * u * u + c[5] * 2 * u * t + c[7] * t * t,
      c[4] * u + c[6] * t, c[5] * u + c[7] * t, c[6], c[7]],
  ];
}

const reverse = (c: Cubic): Cubic => [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]];

/** Approximate bounds (anchors + controls), as RoundedPolygon.normalized() uses. */
function cubicBounds(c: Cubic): [number, number, number, number] {
  if (zeroLength(c)) return [c[0], c[1], c[0], c[1]];
  return [
    Math.min(c[0], c[6], c[2], c[4]),
    Math.min(c[1], c[7], c[3], c[5]),
    Math.max(c[0], c[6], c[2], c[4]),
    Math.max(c[1], c[7], c[3], c[5]),
  ];
}

// --- RoundedCorner --------------------------------------------------------------------------

class RoundedCorner {
  d1 = pt(0, 0);
  d2 = pt(0, 0);
  cornerRadius = 0;
  smoothing = 0;
  expectedRoundCut = 0;

  constructor(
    readonly p0: Pt,
    readonly p1: Pt,
    readonly p2: Pt,
    r: CornerRounding,
  ) {
    const v01 = sub(p0, p1);
    const v21 = sub(p2, p1);
    const d01 = len(v01);
    const d21 = len(v21);
    if (d01 > 0 && d21 > 0) {
      this.d1 = mul(v01, 1 / d01);
      this.d2 = mul(v21, 1 / d21);
      this.cornerRadius = r.radius;
      this.smoothing = r.smoothing;
      const cosAngle = dot(this.d1, this.d2);
      const sinAngle = Math.sqrt(1 - cosAngle * cosAngle);
      this.expectedRoundCut = sinAngle > 1e-3 ? (this.cornerRadius * (cosAngle + 1)) / sinAngle : 0;
    }
  }

  get expectedCut() {
    return (1 + this.smoothing) * this.expectedRoundCut;
  }

  getCubics(allowedCut0: number, allowedCut1: number): Cubic[] {
    const allowedCut = Math.min(allowedCut0, allowedCut1);
    if (this.expectedRoundCut < DistanceEpsilon || allowedCut < DistanceEpsilon || this.cornerRadius < DistanceEpsilon) {
      return [straightLine(this.p1.x, this.p1.y, this.p1.x, this.p1.y)];
    }
    const actualRoundCut = Math.min(allowedCut, this.expectedRoundCut);
    const s0 = this.actualSmoothing(allowedCut0);
    const s1 = this.actualSmoothing(allowedCut1);
    const actualR = (this.cornerRadius * actualRoundCut) / this.expectedRoundCut;
    const centerDistance = Math.sqrt(actualR * actualR + actualRoundCut * actualRoundCut);
    const center = add(this.p1, mul(direction(mul(add(this.d1, this.d2), 0.5)), centerDistance));
    const ci0 = add(this.p1, mul(this.d1, actualRoundCut));
    const ci2 = add(this.p1, mul(this.d2, actualRoundCut));
    const f0 = this.flanking(actualRoundCut, s0, this.p1, this.p0, ci0, ci2, center, actualR);
    const f2 = reverse(this.flanking(actualRoundCut, s1, this.p1, this.p2, ci2, ci0, center, actualR));
    return [f0, circularArc(center.x, center.y, f0[6], f0[7], f2[0], f2[1]), f2];
  }

  private actualSmoothing(allowedCut: number) {
    if (allowedCut > this.expectedCut) return this.smoothing;
    if (allowedCut > this.expectedRoundCut) {
      return (this.smoothing * (allowedCut - this.expectedRoundCut)) / (this.expectedCut - this.expectedRoundCut);
    }
    return 0;
  }

  private flanking(
    actualRoundCut: number,
    smoothing: number,
    corner: Pt,
    sideStart: Pt,
    circleIntersection: Pt,
    otherIntersection: Pt,
    circleCenter: Pt,
    actualR: number,
  ): Cubic {
    const sideDirection = direction(sub(sideStart, corner));
    const curveStart = add(corner, mul(sideDirection, actualRoundCut * (1 + smoothing)));
    const p = lerpPt(circleIntersection, mul(add(circleIntersection, otherIntersection), 0.5), smoothing);
    const curveEnd = add(circleCenter, mul(direction(sub(p, circleCenter)), actualR));
    const circleTangent = rotate90(sub(curveEnd, circleCenter));
    const anchorEnd = lineIntersection(sideStart, sideDirection, curveEnd, circleTangent) ?? circleIntersection;
    const anchorStart = mul(add(curveStart, mul(anchorEnd, 2)), 1 / 3);
    return cubic(curveStart, anchorStart, anchorEnd, curveEnd);
  }
}

function lineIntersection(p0: Pt, d0: Pt, p1: Pt, d1: Pt): Pt | null {
  const rd1 = rotate90(d1);
  const den = dot(d0, rd1);
  if (Math.abs(den) < DistanceEpsilon) return null;
  const num = dot(sub(p1, p0), rd1);
  if (Math.abs(den) < DistanceEpsilon * Math.abs(num)) return null;
  return add(p0, mul(d0, num / den));
}

// --- RoundedPolygon -------------------------------------------------------------------------

/** Builds the contiguous cubic list from corner/edge features, as RoundedPolygon.cubics does. */
function cubicsFromFeatures(features: Cubic[][], center: Pt): Cubic[] {
  const out: Cubic[] = [];
  let first: Cubic | null = null;
  let last: Cubic | null = null;
  let splitStart: Cubic[] | null = null;
  let splitEnd: Cubic[] | null = null;
  if (features.length > 0 && features[0].length === 3) {
    const [a, b] = split(features[0][1], 0.5);
    splitStart = [features[0][0], a];
    splitEnd = [b, features[0][2]];
  }
  for (let i = 0; i <= features.length; i++) {
    let fc: Cubic[];
    if (i === 0 && splitEnd) fc = splitEnd;
    else if (i === features.length) {
      if (splitStart) fc = splitStart;
      else break;
    } else fc = features[i];
    for (const c of fc) {
      if (!zeroLength(c)) {
        if (last) out.push(last);
        last = c;
        if (!first) first = c;
      } else if (last) {
        last = [...last] as Cubic;
        last[6] = c[0];
        last[7] = c[1];
      }
    }
  }
  if (last && first) out.push([last[0], last[1], last[2], last[3], last[4], last[5], first[0], first[1]]);
  else out.push([center.x, center.y, center.x, center.y, center.x, center.y, center.x, center.y]);
  return out;
}

function centerOf(vertices: number[]): Pt {
  let x = 0;
  let y = 0;
  for (let i = 0; i < vertices.length; i += 2) {
    x += vertices[i];
    y += vertices[i + 1];
  }
  const n = vertices.length / 2;
  return pt(x / n, y / n);
}

/** RoundedPolygon(vertices, rounding, perVertexRounding, centerX, centerY). */
export function roundedPolygon(
  vertices: number[],
  opts: { rounding?: CornerRounding; perVertex?: CornerRounding[]; center?: Pt } = {},
): Polygon {
  const n = vertices.length / 2;
  if (n < 3) throw new Error('Polygons must have at least 3 vertices');
  const v = (i: number) => pt(vertices[i * 2], vertices[i * 2 + 1]);
  const corners: RoundedCorner[] = [];
  for (let i = 0; i < n; i++) {
    corners.push(new RoundedCorner(v((i + n - 1) % n), v(i), v((i + 1) % n), opts.perVertex?.[i] ?? opts.rounding ?? Unrounded));
  }
  const cutAdjusts = corners.map((c, ix) => {
    const next = corners[(ix + 1) % n];
    const expectedRoundCut = c.expectedRoundCut + next.expectedRoundCut;
    const expectedCut = c.expectedCut + next.expectedCut;
    const side = len(sub(v(ix), v((ix + 1) % n)));
    if (expectedRoundCut > side) return [side / expectedRoundCut, 0];
    if (expectedCut > side) return [1, (side - expectedRoundCut) / (expectedCut - expectedRoundCut)];
    return [1, 1];
  });
  const cornerCubics = corners.map((c, i) => {
    const allowed = [0, 1].map((delta) => {
      const [roundCutRatio, cutRatio] = cutAdjusts[(i + n - 1 + delta) % n];
      return c.expectedRoundCut * roundCutRatio + (c.expectedCut - c.expectedRoundCut) * cutRatio;
    });
    return c.getCubics(allowed[0], allowed[1]);
  });
  const features: Feature[] = [];
  for (let i = 0; i < n; i++) {
    const cur = cornerCubics[i];
    const nxt = cornerCubics[(i + 1) % n];
    const end = cur[cur.length - 1];
    const prev = v((i + n - 1) % n);
    const here = v(i);
    const next = v((i + 1) % n);
    // convex(previous, current, next) = (current - previous).clockwise(next - current)
    const a = sub(here, prev);
    const b = sub(next, here);
    features.push(
      { cubics: cur, corner: true, convex: a.x * b.y - a.y * b.x > 0 },
      { cubics: [straightLine(end[6], end[7], nxt[0][0], nxt[0][1])], corner: false, convex: false },
    );
  }
  const center = opts.center ?? centerOf(vertices);
  return { cubics: cubicsFromFeatures(features.map((f) => f.cubics), center), features, center };
}

/** RoundedPolygon(numVertices, radius, centerX, centerY, rounding, perVertexRounding). */
export function regularPolygon(
  numVertices: number,
  opts: { radius?: number; rounding?: CornerRounding; perVertex?: CornerRounding[] } = {},
): Polygon {
  const r = opts.radius ?? 1;
  const vertices: number[] = [];
  for (let i = 0; i < numVertices; i++) {
    const p = radial(r, (Math.PI / numVertices) * 2 * i);
    vertices.push(p.x, p.y);
  }
  return roundedPolygon(vertices, { rounding: opts.rounding, perVertex: opts.perVertex, center: pt(0, 0) });
}

export function circlePolygon(numVertices = 8, radius = 1): Polygon {
  const theta = Math.PI / numVertices;
  return regularPolygon(numVertices, { radius: radius / Math.cos(theta), rounding: rounding(radius) });
}

export function rectanglePolygon(
  width: number,
  height: number,
  opts: { rounding?: CornerRounding; perVertex?: CornerRounding[] } = {},
): Polygon {
  const l = -width / 2;
  const t = -height / 2;
  const r = width / 2;
  const b = height / 2;
  return roundedPolygon([r, b, l, b, l, t, r, t], { ...opts, center: pt(0, 0) });
}

export function starPolygon(numVerticesPerRadius: number, opts: { radius?: number; innerRadius: number; rounding?: CornerRounding }): Polygon {
  const r = opts.radius ?? 1;
  const vertices: number[] = [];
  for (let i = 0; i < numVerticesPerRadius; i++) {
    const a = radial(r, (Math.PI / numVerticesPerRadius) * 2 * i);
    const b = radial(opts.innerRadius, (Math.PI / numVerticesPerRadius) * (2 * i + 1));
    vertices.push(a.x, a.y, b.x, b.y);
  }
  return roundedPolygon(vertices, { rounding: opts.rounding, center: pt(0, 0) });
}

// --- Transforms -----------------------------------------------------------------------------

export function transformed(p: Polygon, f: (x: number, y: number) => Pt): Polygon {
  const map = (c: Cubic): Cubic => {
    const a = f(c[0], c[1]);
    const b = f(c[2], c[3]);
    const d = f(c[4], c[5]);
    const e = f(c[6], c[7]);
    return [a.x, a.y, b.x, b.y, d.x, d.y, e.x, e.y];
  };
  return {
    cubics: p.cubics.map(map),
    features: p.features.map((ft) => ({ ...ft, cubics: ft.cubics.map(map) })),
    center: f(p.center.x, p.center.y),
  };
}

export function rotated(p: Polygon, degrees: number): Polygon {
  const a = (degrees * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return transformed(p, (x, y) => pt(x * cos - y * sin, x * sin + y * cos));
}

export const scaled = (p: Polygon, sx: number, sy: number) => transformed(p, (x, y) => pt(x * sx, y * sy));

/** Fits the shape into the unit square, centered (RoundedPolygon.normalized()). */
export function normalized(p: Polygon): Polygon {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of p.cubics) {
    const [a, b, d, e] = cubicBounds(c);
    minX = Math.min(minX, a);
    minY = Math.min(minY, b);
    maxX = Math.max(maxX, d);
    maxY = Math.max(maxY, e);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const side = Math.max(w, h);
  const ox = (side - w) / 2 - minX;
  const oy = (side - h) / 2 - minY;
  return transformed(p, (x, y) => pt((x + ox) / side, (y + oy) / side));
}

// --- MaterialShapes customPolygon -----------------------------------------------------------

export type PointNRound = { x: number; y: number; r?: CornerRounding };

/** MaterialShapes.customPolygon: repeat (and optionally mirror) a sector of points around a center. */
export function customPolygon(points: PointNRound[], reps: number, mirroring = false, center: Pt = pt(0.5, 0.5)): Polygon {
  const out: PointNRound[] = [];
  if (mirroring) {
    const angles = points.map((p) => (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI);
    const distances = points.map((p) => Math.hypot(p.x - center.x, p.y - center.y));
    const actualReps = reps * 2;
    const section = 360 / actualReps;
    for (let it = 0; it < actualReps; it++) {
      for (let index = 0; index < points.length; index++) {
        const i = it % 2 === 0 ? index : points.length - 1 - index;
        if (i > 0 || it % 2 === 0) {
          const deg = section * it + (it % 2 === 0 ? angles[i] : section - angles[i] + 2 * angles[0]);
          const a = (deg * Math.PI) / 180;
          out.push({ x: Math.cos(a) * distances[i] + center.x, y: Math.sin(a) * distances[i] + center.y, r: points[i].r });
        }
      }
    }
  } else {
    const np = points.length;
    for (let it = 0; it < np * reps; it++) {
      const p = points[it % np];
      const a = ((Math.floor(it / np) * 360) / reps) * (Math.PI / 180);
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      out.push({ x: dx * Math.cos(a) - dy * Math.sin(a) + center.x, y: dx * Math.sin(a) + dy * Math.cos(a) + center.y, r: p.r });
    }
  }
  return roundedPolygon(
    out.flatMap((p) => [p.x, p.y]),
    { perVertex: out.map((p) => p.r ?? Unrounded), center },
  );
}
