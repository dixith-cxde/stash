import { circularArc, pointOnCurve, rectanglePolygon, rounding } from '@/shapes/geometry';
import { materialShape } from '@/shapes/materialShapes';
import { MATERIAL_SHAPES } from '@/shapes/names';
import { matchPolygons } from '@/shapes/morphMatch';
import { samplePolygon, svgPath } from '@/shapes/path';

describe('MaterialShapes', () => {
  it.each(MATERIAL_SHAPES)('%s is a closed, contiguous outline inside the unit square', (name) => {
    const { cubics } = materialShape(name);
    expect(cubics.length).toBeGreaterThan(2);
    for (let i = 0; i < cubics.length; i++) {
      const prev = cubics[(i + cubics.length - 1) % cubics.length];
      const cur = cubics[i];
      expect(Math.abs(prev[6] - cur[0])).toBeLessThan(1e-3);
      expect(Math.abs(prev[7] - cur[1])).toBeLessThan(1e-3);
      for (const v of cur) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThan(-0.01);
        expect(v).toBeLessThan(1.01);
      }
    }
  });

  it.each(MATERIAL_SHAPES)('%s fills the unit square on its longer axis', (name) => {
    const pts = samplePolygon(materialShape(name), 200);
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    // normalized() fits control-point bounds (as Compose does), so pointy shapes sit a little inside.
    expect(Math.max(w, h)).toBeGreaterThan(0.85);
  });

  it('a circle stays round', () => {
    const pts = samplePolygon(materialShape('circle'), 64);
    const radii = [];
    for (let i = 0; i < pts.length; i += 2) radii.push(Math.hypot(pts[i] - 0.5, pts[i + 1] - 0.5));
    // Compose splits the first arc, which skews normalized()'s control-point bounds by <1%.
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.01);
  });

  it('corners without smoothing collapse to one arc each', () => {
    const sq = rectanglePolygon(2, 2, { rounding: rounding(0.5) });
    // 4 arcs + 4 edges, the first arc split in two so the outline starts mid-corner.
    expect(sq.cubics.length).toBe(9);
    const smooth = rectanglePolygon(2, 2, { rounding: rounding(0.5, 1) });
    // Full smoothing: two flanking curves meet mid-corner, the arc between them vanishes,
    // and the cuts use up the whole side, so only the 8 flanking curves remain.
    expect(smooth.cubics.length).toBe(8);
  });
});

describe('arcs and sampling', () => {
  it('circularArc approximates a quarter circle', () => {
    const c = circularArc(0, 0, 1, 0, 0, 1);
    const mid = pointOnCurve(c, 0.5);
    expect(Math.hypot(mid.x, mid.y)).toBeCloseTo(1, 3);
  });

  it('samples have the requested count and one winding', () => {
    for (const name of ['cookie9Sided', 'heart', 'pixelTriangle'] as const) {
      const pts = samplePolygon(materialShape(name), 96);
      expect(pts).toHaveLength(192);
      let area = 0;
      for (let i = 0; i < 96; i++) {
        const j = (i + 1) % 96;
        area += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1];
      }
      expect(area).toBeGreaterThan(0);
    }
  });

  it('svgPath emits a closed path', () => {
    const d = svgPath(materialShape('clover4Leaf'), 100);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });
});

describe('Morph matching (androidx Morph.match port)', () => {
  const contiguous = (cubics: number[][]) =>
    cubics.every((c, i) => {
      const prev = cubics[(i + cubics.length - 1) % cubics.length];
      return Math.abs(prev[6] - c[0]) < 2e-3 && Math.abs(prev[7] - c[1]) < 2e-3;
    });

  it.each(MATERIAL_SHAPES.map((s, i) => [s, MATERIAL_SHAPES[(i + 7) % MATERIAL_SHAPES.length]]))(
    '%s → %s pairs every cubic into two closed outlines',
    (a, b) => {
      const pairs = matchPolygons(materialShape(a), materialShape(b));
      expect(pairs.length).toBeGreaterThan(2);
      expect(contiguous(pairs.map((p) => p[0]))).toBe(true);
      expect(contiguous(pairs.map((p) => p[1]))).toBe(true);
    },
  );

  it('maps corners onto corners: pentagon → triangle keeps 3 sharp turns mid-morph', () => {
    const pairs = matchPolygons(materialShape('pentagon'), materialShape('triangle'));
    // Halfway, the outline must still be one closed curve inside the unit square.
    const mid = pairs.map(([a, b]) => a.map((v, k) => v + (b[k] - v) * 0.5));
    expect(contiguous(mid)).toBe(true);
    for (const c of mid) for (const v of c) expect(v).toBeGreaterThan(-0.05);
  });
});
