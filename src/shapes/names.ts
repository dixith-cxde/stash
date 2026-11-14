/** The 35 MaterialShapes (androidx compose material3 MaterialShapes.kt), camelCase. */
export const MATERIAL_SHAPES = [
  'circle', 'square', 'slanted', 'arch', 'fan', 'arrow', 'semiCircle', 'oval', 'pill', 'triangle',
  'diamond', 'clamShell', 'pentagon', 'gem', 'sunny', 'verySunny', 'cookie4Sided', 'cookie6Sided',
  'cookie7Sided', 'cookie9Sided', 'cookie12Sided', 'ghostish', 'clover4Leaf', 'clover8Leaf', 'burst',
  'softBurst', 'boom', 'softBoom', 'flower', 'puffy', 'puffyDiamond', 'pixelCircle', 'pixelTriangle',
  'bun', 'heart',
] as const;

export type MaterialShapeName = (typeof MATERIAL_SHAPES)[number];

/** Shapes Stash never uses: they read as odd next to the rest of the design. */
export const EXCLUDED_SHAPES: readonly MaterialShapeName[] = ['puffy', 'heart'];

/** Every MaterialShape the app may use (pickers, decorations, galleries). */
export const USABLE_SHAPES = MATERIAL_SHAPES.filter((s) => !EXCLUDED_SHAPES.includes(s));
