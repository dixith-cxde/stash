import type { BookmarkType } from '@/db/schema';
import type { MaterialShapeName } from '@/shapes/names';

import type { IconName } from './icons';
import type { ColorRoles } from './palette';

type Role = 'primary' | 'secondary' | 'tertiary';

/** Each content type gets its own Expressive shape + tonal role, so the list reads at a glance. */
export const TYPE_META: Record<
  BookmarkType | 'highlight',
  { label: string; plural: string; icon: IconName; shape: MaterialShapeName; role: Role }
> = {
  link: { label: 'Link', plural: 'Links', icon: 'link', shape: 'clover4Leaf', role: 'primary' },
  pdf: { label: 'PDF', plural: 'PDFs', icon: 'pictureAsPdf', shape: 'cookie9Sided', role: 'tertiary' },
  text: { label: 'Note', plural: 'Notes', icon: 'notes', shape: 'cookie6Sided', role: 'secondary' },
  image: { label: 'Image', plural: 'Images', icon: 'image', shape: 'sunny', role: 'tertiary' },
  file: { label: 'File', plural: 'Files', icon: 'attachFile', shape: 'pill', role: 'secondary' },
  highlight: { label: 'Highlight', plural: 'Highlights', icon: 'inkHighlighter', shape: 'softBurst', role: 'primary' },
};

export function roleColors(colors: ColorRoles, role: Role) {
  switch (role) {
    case 'primary':
      return { container: colors.primaryContainer, content: colors.onPrimaryContainer };
    case 'secondary':
      return { container: colors.secondaryContainer, content: colors.onSecondaryContainer };
    case 'tertiary':
      return { container: colors.tertiaryContainer, content: colors.onTertiaryContainer };
  }
}

/** Shapes users can pick for folders and lists. */
export const PICKABLE_SHAPES: MaterialShapeName[] = [
  'cookie9Sided', 'clover4Leaf', 'sunny', 'softBurst', 'cookie4Sided', 'pentagon',
  'cookie7Sided', 'ghostish', 'gem', 'arch', 'boom', 'clover8Leaf',
];
