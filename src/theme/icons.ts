/*
 * Material Symbols Rounded. Add an icon with
 *   npx @expo/material-symbols --style rounded -o assets/icons <name>   (add --fill for filled)
 * then `npm run icons`, which regenerates ./iconPaths.ts. Names are camelCase, filled
 * variants end in "Fill" (home_rounded_fill.xml → homeFill).
 */
import { IconPaths } from './iconPaths';

export { IconPaths };
export type IconName = keyof typeof IconPaths;
