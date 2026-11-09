import type { MaterialColors } from '@expo/ui/jetpack-compose';

import type { BookmarkType } from '@/db/schema';

import type { MaterialShapeName } from '../../modules/expressive';
import type { IconName } from './icons';

type Role = 'primary' | 'secondary' | 'tertiary';

/** Each content type gets its own Expressive shape + tonal role, so the list reads at a glance. */
export const TYPE_META: Record<
  BookmarkType | 'highlight',
  { label: string; plural: string; icon: IconName; shape: MaterialShapeName; role: Role }
> = {
  link: { label: 'Link', plural: 'Links', icon: 'link', shape: 'clover4Leaf', role: 'primary' },
  pdf: { label: 'PDF', plural: 'PDFs', icon: 'pictureAsPdf', shape: 'cookie9Sided', role: 'tertiary' },
  text: { label: 'Note', plural: 'Notes', icon: 'notes', shape: 'puffy', role: 'secondary' },
  image: { label: 'Image', plural: 'Images', icon: 'image', shape: 'sunny', role: 'tertiary' },
  file: { label: 'File', plural: 'Files', icon: 'attachFile', shape: 'pill', role: 'secondary' },
  highlight: { label: 'Highlight', plural: 'Highlights', icon: 'inkHighlighter', shape: 'softBurst', role: 'primary' },
};

export function roleColors(colors: MaterialColors, role: Role) {
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
  'puffy', 'ghostish', 'heart', 'arch', 'boom', 'clover8Leaf',
];

export const HIGHLIGHT_SWATCH: Record<string, { light: string; dark: string }> = {
  yellow: { light: '#FFF3B0', dark: '#5C4E00' },
  green: { light: '#CDEFC4', dark: '#1E4D1A' },
  blue: { light: '#CFE4FF', dark: '#11365C' },
  pink: { light: '#FFD8E4', dark: '#5C1F35' },
  purple: { light: '#E8DDFF', dark: '#3B2A63' },
};
