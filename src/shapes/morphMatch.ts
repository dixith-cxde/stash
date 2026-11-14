/**
 * TypeScript port of androidx.graphics.shapes Morph.match(): measures both outlines, maps
 * corners of one shape to the nearest corners of the same kind (convex/concave) on the
 * other, then cuts both outlines at matching progress points so each cubic of the start
 * shape has a partner cubic in the end shape. Interpolating partners keeps corners intact
 * mid-morph. Sources: Morph.kt, PolygonMeasure.kt, FeatureMapping.kt, FloatMapping.kt.
 */
import { type Cubic, type Feature, type Polygon, pointOnCurve, split } from './geometry';

const DistanceEpsilon = 1e-4;
const AngleEpsilon = 1e-6;

const positiveModulo = (n: number, m: number) => ((n % m) + m) % m;
const progressDistance = (a: number, b: number) => {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
};
const progressInRange = (p: number, from: number, to: number) => (to >= from ? p >= from && p <= to : p >= from || p <= to);

// --- LengthMeasurer -------------------------------------------------------------------------

const SEGMENTS = 3;

/** [progress at which `threshold` length is reached, total length] */
function closestProgressTo(c: Cubic, threshold: number): [number, number] {
  let total = 0;
  let remainder = threshold;
  let prev = { x: c[0], y: c[1] };
  for (let i = 1; i <= SEGMENTS; i++) {
    const progress = i / SEGMENTS;
    const p = pointOnCurve(c, progress);
    const segment = Math.hypot(p.x - prev.x, p.y - prev.y);
    if (segment >= remainder) return [progress - (1 - remainder / segment) / SEGMENTS, threshold];
    remainder -= segment;
    total += segment;
    prev = p;
  }
  return [1, total];
}
const measureCubic = (c: Cubic) => closestProgressTo(c, Infinity)[1];
const findCubicCutPoint = (c: Cubic, m: number) => closestProgressTo(c, m)[0];

// --- MeasuredPolygon ------------------------------------------------------------------------

type ProgressableFeature = { progress: number; feature: Feature };

class MeasuredCubic {
  readonly size: number;
  constructor(
    readonly cubic: Cubic,
    public start: number,
    public end: number,
  ) {
    this.size = measureCubic(cubic);
  }

  cutAtProgress(cut: number): [MeasuredCubic, MeasuredCubic] {
    const bounded = Math.min(Math.max(cut, this.start), this.end);
    const relative = (bounded - this.start) / (this.end - this.start);
    const t = findCubicCutPoint(this.cubic, relative * this.size);
    const [c1, c2] = split(this.cubic, t);
    return [new MeasuredCubic(c1, this.start, bounded), new MeasuredCubic(c2, bounded, this.end)];
  }
}

class MeasuredPolygon {
  readonly cubics: MeasuredCubic[];

  constructor(
    readonly features: ProgressableFeature[],
    cubics: Cubic[],
    outlineProgress: number[],
  ) {
    const measured: MeasuredCubic[] = [];
    let start = 0;
    for (let i = 0; i < cubics.length; i++) {
      if (outlineProgress[i + 1] - outlineProgress[i] > DistanceEpsilon) {
        measured.push(new MeasuredCubic(cubics[i], start, outlineProgress[i + 1]));
        start = outlineProgress[i + 1];
      }
    }
    measured[measured.length - 1].end = 1;
    this.cubics = measured;
  }

  static measure(polygon: Polygon): MeasuredPolygon {
    const cubics: Cubic[] = [];
    const featureToCubic: [Feature, number][] = [];
    for (const feature of polygon.features) {
      feature.cubics.forEach((c, i) => {
        if (feature.corner && i === Math.floor(feature.cubics.length / 2)) featureToCubic.push([feature, cubics.length]);
        cubics.push(c);
      });
    }
    const measures = [0];
    for (const c of cubics) measures.push(measures[measures.length - 1] + measureCubic(c));
    const total = measures[measures.length - 1];
    const outline = measures.map((m) => m / total);
    const features = featureToCubic.map(([feature, ix]) => ({
      progress: positiveModulo((outline[ix] + outline[ix + 1]) / 2, 1),
      feature,
    }));
    return new MeasuredPolygon(features, cubics, outline);
  }

  cutAndShift(cuttingPoint: number): MeasuredPolygon {
    if (cuttingPoint < DistanceEpsilon) return this;
    const cubics = this.cubics;
    const targetIndex = cubics.findIndex((c) => cuttingPoint >= c.start && cuttingPoint <= c.end);
    const [b1, b2] = cubics[targetIndex].cutAtProgress(cuttingPoint);
    const ret = [b2.cubic];
    for (let i = 1; i < cubics.length; i++) ret.push(cubics[(i + targetIndex) % cubics.length].cubic);
    ret.push(b1.cubic);
    const outline: number[] = [];
    for (let index = 0; index < cubics.length + 2; index++) {
      if (index === 0) outline.push(0);
      else if (index === cubics.length + 1) outline.push(1);
      else outline.push(positiveModulo(cubics[(targetIndex + index - 1) % cubics.length].end - cuttingPoint, 1));
    }
    const features = this.features.map((f) => ({ progress: positiveModulo(f.progress - cuttingPoint, 1), feature: f.feature }));
    return new MeasuredPolygon(features, ret, outline);
  }
}

// --- Feature mapping ------------------------------------------------------------------------

function representativePoint(f: Feature) {
  const first = f.cubics[0];
  const last = f.cubics[f.cubics.length - 1];
  return { x: (first[0] + last[6]) / 2, y: (first[1] + last[7]) / 2 };
}

function featureDistSquared(a: Feature, b: Feature): number {
  if (a.corner && b.corner && a.convex !== b.convex) return Number.MAX_VALUE;
  const p = representativePoint(a);
  const q = representativePoint(b);
  return (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
}

function doMapping(f1s: ProgressableFeature[], f2s: ProgressableFeature[]): [number, number][] {
  const candidates: { d: number; f1: ProgressableFeature; f2: ProgressableFeature }[] = [];
  for (const f1 of f1s) {
    for (const f2 of f2s) {
      const d = featureDistSquared(f1.feature, f2.feature);
      if (d !== Number.MAX_VALUE) candidates.push({ d, f1, f2 });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  if (candidates.length === 0) return [[0, 0], [0.5, 0.5]];
  if (candidates.length === 1) {
    const { f1, f2 } = candidates[0];
    return [
      [f1.progress, f2.progress],
      [(f1.progress + 0.5) % 1, (f2.progress + 0.5) % 1],
    ];
  }
  const mapping: [number, number][] = [];
  const used1 = new Set<ProgressableFeature>();
  const used2 = new Set<ProgressableFeature>();
  for (const { f1, f2 } of candidates) {
    if (used1.has(f1) || used2.has(f2)) continue;
    // Binary-search insertion point by f1.progress (mapping stays sorted by source progress).
    let lo = 0;
    let hi = mapping.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (mapping[mid][0] < f1.progress) lo = mid + 1;
      else hi = mid;
    }
    if (lo < mapping.length && mapping[lo][0] === f1.progress) throw new Error("There can't be two features with the same progress");
    const n = mapping.length;
    if (n >= 1) {
      const [before1, before2] = mapping[(lo + n - 1) % n];
      const [after1, after2] = mapping[lo % n];
      if (
        progressDistance(f1.progress, before1) < DistanceEpsilon ||
        progressDistance(f1.progress, after1) < DistanceEpsilon ||
        progressDistance(f2.progress, before2) < DistanceEpsilon ||
        progressDistance(f2.progress, after2) < DistanceEpsilon
      ) {
        continue;
      }
      if (n > 1 && !progressInRange(f2.progress, before2, after2)) continue;
    }
    mapping.splice(lo, 0, [f1.progress, f2.progress]);
    used1.add(f1);
    used2.add(f2);
  }
  return mapping;
}

function linearMap(xs: number[], ys: number[], x: number): number {
  let start = 0;
  for (let i = 0; i < xs.length; i++) {
    if (progressInRange(x, xs[i], xs[(i + 1) % xs.length])) {
      start = i;
      break;
    }
  }
  const end = (start + 1) % xs.length;
  const sizeX = positiveModulo(xs[end] - xs[start], 1);
  const sizeY = positiveModulo(ys[end] - ys[start], 1);
  const pos = sizeX < 0.001 ? 0.5 : positiveModulo(x - xs[start], 1) / sizeX;
  return positiveModulo(ys[start] + sizeY * pos, 1);
}

class DoubleMapper {
  private readonly src: number[];
  private readonly dst: number[];
  constructor(mappings: [number, number][]) {
    this.src = mappings.map((m) => m[0]);
    this.dst = mappings.map((m) => m[1]);
  }
  map = (x: number) => linearMap(this.src, this.dst, x);
  mapBack = (x: number) => linearMap(this.dst, this.src, x);
}

function featureMapper(f1: ProgressableFeature[], f2: ProgressableFeature[]): DoubleMapper {
  return new DoubleMapper(doMapping(f1.filter((f) => f.feature.corner), f2.filter((f) => f.feature.corner)));
}

// --- Morph.match ----------------------------------------------------------------------------

/** Matched cubic pairs for morphing `p1` into `p2` (androidx Morph.match). */
export function matchPolygons(p1: Polygon, p2: Polygon): [Cubic, Cubic][] {
  const m1 = MeasuredPolygon.measure(p1);
  const m2 = MeasuredPolygon.measure(p2);
  const mapper = featureMapper(m1.features, m2.features);
  const cut = mapper.map(0);
  const bs1 = m1.cubics;
  const bs2 = m2.cutAndShift(cut).cubics;

  const ret: [Cubic, Cubic][] = [];
  let i1 = 0;
  let i2 = 0;
  let b1: MeasuredCubic | undefined = bs1[i1++];
  let b2: MeasuredCubic | undefined = bs2[i2++];
  while (b1 && b2) {
    const b1a = i1 === bs1.length ? 1 : b1.end;
    const b2a = i2 === bs2.length ? 1 : mapper.mapBack(positiveModulo(b2.end + cut, 1));
    const minb = Math.min(b1a, b2a);
    let seg1: MeasuredCubic;
    let seg2: MeasuredCubic;
    if (b1a > minb + AngleEpsilon) {
      [seg1, b1] = b1.cutAtProgress(minb);
    } else {
      seg1 = b1;
      b1 = bs1[i1++];
    }
    if (b2a > minb + AngleEpsilon) {
      [seg2, b2] = b2.cutAtProgress(positiveModulo(mapper.map(minb) - cut, 1));
    } else {
      seg2 = b2;
      b2 = bs2[i2++];
    }
    ret.push([seg1.cubic, seg2.cubic]);
  }
  if (b1 || b2) throw new Error("Expected both Polygon's Cubic to be fully matched");
  return ret;
}

/** Flat [8 numbers per cubic] arrays for the UI thread: start shape and end shape. */
export type MorphPair = { from: number[]; to: number[] };

export function morphPair(p1: Polygon, p2: Polygon): MorphPair {
  const pairs = matchPolygons(p1, p2);
  return { from: pairs.flatMap(([a]) => a), to: pairs.flatMap(([, b]) => b) };
}

/** A polygon made from an arbitrary outline (e.g. a morph caught mid-flight): all edges. */
export function polygonFromCubics(cubics: Cubic[]): Polygon {
  let x = 0;
  let y = 0;
  for (const c of cubics) {
    x += c[0];
    y += c[1];
  }
  return {
    cubics,
    features: cubics.map((c) => ({ cubics: [c], corner: false, convex: false })),
    center: { x: x / cubics.length, y: y / cubics.length },
  };
}
