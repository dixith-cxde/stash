/**
 * The 35 M3 Expressive MaterialShapes, ported value for value from
 * androidx compose material3 MaterialShapes.kt. Each is normalized to the unit square.
 */
import {
  circlePolygon,
  customPolygon,
  normalized,
  type Polygon,
  rectanglePolygon,
  regularPolygon,
  rotated,
  rounding as r,
  scaled,
  starPolygon,
} from './geometry';
import type { MaterialShapeName } from './names';

const r15 = r(0.15);
const r20 = r(0.2);
const r30 = r(0.3);
const r50 = r(0.5);
const r100 = r(1);

const DEFINITIONS: Record<MaterialShapeName, () => Polygon> = {
  circle: () => circlePolygon(10),
  square: () => rectanglePolygon(1, 1, { rounding: r30 }),
  slanted: () => customPolygon([{ x: 0.926, y: 0.97, r: r(0.189, 0.811) }, { x: -0.021, y: 0.967, r: r(0.187, 0.057) }], 2),
  arch: () => rotated(regularPolygon(4, { perVertex: [r100, r100, r20, r20] }), -135),
  fan: () =>
    customPolygon(
      [
        { x: 1.004, y: 1.0, r: r(0.148, 0.417) },
        { x: 0.0, y: 1.0, r: r(0.151) },
        { x: 0.0, y: -0.003, r: r(0.148) },
        { x: 0.978, y: 0.02, r: r(0.803) },
      ],
      1,
    ),
  arrow: () =>
    customPolygon(
      [
        { x: 0.5, y: 0.892, r: r(0.313) },
        { x: -0.216, y: 1.05, r: r(0.207) },
        { x: 0.499, y: -0.16, r: r(0.215, 1) },
        { x: 1.225, y: 1.06, r: r(0.211) },
      ],
      1,
    ),
  semiCircle: () => rectanglePolygon(1.6, 1, { perVertex: [r20, r20, r100, r100] }),
  oval: () => rotated(scaled(circlePolygon(8), 1, 0.64), -45),
  pill: () =>
    customPolygon([{ x: 0.961, y: 0.039, r: r(0.426) }, { x: 1.001, y: 0.428 }, { x: 1.0, y: 0.609, r: r(1) }], 2, true),
  triangle: () => rotated(regularPolygon(3, { rounding: r20 }), -90),
  diamond: () => customPolygon([{ x: 0.5, y: 1.096, r: r(0.151, 0.524) }, { x: 0.04, y: 0.5, r: r(0.159) }], 2),
  clamShell: () =>
    customPolygon(
      [
        { x: 0.171, y: 0.841, r: r(0.159) },
        { x: -0.02, y: 0.5, r: r(0.14) },
        { x: 0.17, y: 0.159, r: r(0.159) },
      ],
      2,
    ),
  pentagon: () =>
    customPolygon(
      [
        { x: 0.5, y: -0.009, r: r(0.172) },
        { x: 1.03, y: 0.365, r: r(0.164) },
        { x: 0.828, y: 0.97, r: r(0.169) },
      ],
      1,
      true,
    ),
  gem: () =>
    customPolygon(
      [
        { x: 0.499, y: 1.023, r: r(0.241, 0.778) },
        { x: -0.005, y: 0.792, r: r(0.208) },
        { x: 0.073, y: 0.258, r: r(0.228) },
        { x: 0.433, y: -0.0, r: r(0.491) },
      ],
      1,
      true,
    ),
  sunny: () => starPolygon(8, { innerRadius: 0.8, rounding: r15 }),
  verySunny: () => customPolygon([{ x: 0.5, y: 1.08, r: r(0.085) }, { x: 0.358, y: 0.843, r: r(0.085) }], 8),
  cookie4Sided: () => customPolygon([{ x: 1.237, y: 1.236, r: r(0.258) }, { x: 0.5, y: 0.918, r: r(0.233) }], 4),
  cookie6Sided: () => customPolygon([{ x: 0.723, y: 0.884, r: r(0.394) }, { x: 0.5, y: 1.099, r: r(0.398) }], 6),
  cookie7Sided: () => rotated(starPolygon(7, { innerRadius: 0.75, rounding: r50 }), -90),
  cookie9Sided: () => rotated(starPolygon(9, { innerRadius: 0.8, rounding: r50 }), -90),
  cookie12Sided: () => rotated(starPolygon(12, { innerRadius: 0.8, rounding: r50 }), -90),
  ghostish: () =>
    customPolygon(
      [
        { x: 0.5, y: 0, r: r(1) },
        { x: 1, y: 0, r: r(1) },
        { x: 1, y: 1.14, r: r(0.254, 0.106) },
        { x: 0.575, y: 0.906, r: r(0.253) },
      ],
      1,
      true,
    ),
  clover4Leaf: () => customPolygon([{ x: 0.5, y: 0.074 }, { x: 0.725, y: -0.099, r: r(0.476) }], 4, true),
  clover8Leaf: () => customPolygon([{ x: 0.5, y: 0.036 }, { x: 0.758, y: -0.101, r: r(0.209) }], 8),
  burst: () => customPolygon([{ x: 0.5, y: -0.006, r: r(0.006) }, { x: 0.592, y: 0.158, r: r(0.006) }], 12),
  softBurst: () => customPolygon([{ x: 0.193, y: 0.277, r: r(0.053) }, { x: 0.176, y: 0.055, r: r(0.053) }], 10),
  boom: () => customPolygon([{ x: 0.457, y: 0.296, r: r(0.007) }, { x: 0.5, y: -0.051, r: r(0.007) }], 15),
  softBoom: () =>
    customPolygon(
      [
        { x: 0.733, y: 0.454 },
        { x: 0.839, y: 0.437, r: r(0.532) },
        { x: 0.949, y: 0.449, r: r(0.439, 1) },
        { x: 0.998, y: 0.478, r: r(0.174) },
      ],
      16,
      true,
    ),
  flower: () =>
    customPolygon(
      [
        { x: 0.37, y: 0.187 },
        { x: 0.416, y: 0.049, r: r(0.381) },
        { x: 0.479, y: 0.001, r: r(0.095) },
      ],
      8,
      true,
    ),
  puffy: () =>
    scaled(
      customPolygon(
        [
          { x: 0.5, y: 0.053 },
          { x: 0.545, y: -0.04, r: r(0.405) },
          { x: 0.67, y: -0.035, r: r(0.426) },
          { x: 0.717, y: 0.066, r: r(0.574) },
          { x: 0.722, y: 0.128 },
          { x: 0.777, y: 0.002, r: r(0.36) },
          { x: 0.914, y: 0.149, r: r(0.66) },
          { x: 0.926, y: 0.289, r: r(0.66) },
          { x: 0.881, y: 0.346 },
          { x: 0.94, y: 0.344, r: r(0.126) },
          { x: 1.003, y: 0.437, r: r(0.255) },
        ],
        2,
        true,
      ),
      1,
      0.742,
    ),
  puffyDiamond: () =>
    customPolygon(
      [
        { x: 0.87, y: 0.13, r: r(0.146) },
        { x: 0.818, y: 0.357 },
        { x: 1.0, y: 0.332, r: r(0.853) },
      ],
      4,
      true,
    ),
  pixelCircle: () =>
    customPolygon(
      [
        { x: 0.5, y: 0.0 },
        { x: 0.704, y: 0.0 },
        { x: 0.704, y: 0.065 },
        { x: 0.843, y: 0.065 },
        { x: 0.843, y: 0.148 },
        { x: 0.926, y: 0.148 },
        { x: 0.926, y: 0.296 },
        { x: 1.0, y: 0.296 },
      ],
      2,
      true,
    ),
  pixelTriangle: () =>
    customPolygon(
      [
        { x: 0.11, y: 0.5 },
        { x: 0.113, y: 0.0 },
        { x: 0.287, y: 0.0 },
        { x: 0.287, y: 0.087 },
        { x: 0.421, y: 0.087 },
        { x: 0.421, y: 0.17 },
        { x: 0.56, y: 0.17 },
        { x: 0.56, y: 0.265 },
        { x: 0.674, y: 0.265 },
        { x: 0.675, y: 0.344 },
        { x: 0.789, y: 0.344 },
        { x: 0.789, y: 0.439 },
        { x: 0.888, y: 0.439 },
      ],
      1,
      true,
    ),
  bun: () =>
    customPolygon(
      [
        { x: 0.796, y: 0.5 },
        { x: 0.853, y: 0.518, r: r(1) },
        { x: 0.992, y: 0.631, r: r(1) },
        { x: 0.968, y: 1.0, r: r(1) },
      ],
      2,
      true,
    ),
  heart: () =>
    customPolygon(
      [
        { x: 0.5, y: 0.268, r: r(0.016) },
        { x: 0.792, y: -0.066, r: r(0.958) },
        { x: 1.064, y: 0.276, r: r(1) },
        { x: 0.501, y: 0.946, r: r(0.129) },
      ],
      1,
      true,
    ),
};

const cache = new Map<MaterialShapeName, Polygon>();

/** A MaterialShape normalized to the unit square (0..1 on both axes). */
export function materialShape(name: MaterialShapeName): Polygon {
  let p = cache.get(name);
  if (!p) {
    p = normalized(DEFINITIONS[name]());
    cache.set(name, p);
  }
  return p;
}
