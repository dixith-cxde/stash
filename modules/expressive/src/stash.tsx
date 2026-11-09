import { type PrimitiveBaseProps } from '@expo/ui/jetpack-compose';
import { createViewModifierEventListener } from '@expo/ui/jetpack-compose/modifiers';
import { requireNativeView } from 'expo';

/*
 * Whole screens rendered natively in Compose (modules/expressive/.../stash). They take
 * display-ready records and report every user intent through one `onAction` callback.
 * Icon fields are Material Symbols drawable names, e.g. "home_rounded" (see nativeIcon()).
 */

export type CardKind = 'link' | 'video' | 'pdf' | 'text' | 'image' | 'file' | 'highlight';

export type CardRecord = {
  id: string;
  kind: CardKind;
  title: string;
  body?: string;
  site?: string;
  seed?: string;
  meta?: string;
  cover?: string | null;
  favicon?: string | null;
  badge?: string | null;
  tags?: string[];
  unread?: boolean;
  favorite?: boolean;
  color?: string | null;
};

export type CollectionRecord = {
  key: string;
  title: string;
  subtitle: string;
  shape: string;
  icon: string;
  tone: 'primary' | 'secondary' | 'tertiary';
  covers: string[];
};

export type OptionRecord = { key: string; label: string; icon?: string; selectedIcon?: string };

export type ChipRecord = { key: string; label: string; selected?: boolean };

export type HighlightRecord = { id: string; text: string; note?: string | null; color: string; meta: string };

export type StashAction = { action: string; key: string; value: string };

type NativeActionProps = { onAction?: (e: { nativeEvent: StashAction }) => void };

function toNativeProps<P extends PrimitiveBaseProps & { onAction?: (a: StashAction) => void }>(props: P) {
  const { modifiers, onAction, ...rest } = props;
  return {
    ...rest,
    modifiers,
    ...(modifiers ? createViewModifierEventListener(modifiers) : undefined),
    onAction: onAction ? (e: { nativeEvent: StashAction }) => onAction(e.nativeEvent) : undefined,
  };
}

/* ---------------------------------- Home ---------------------------------- */

export interface StashHomeProps extends PrimitiveBaseProps {
  title: string;
  subtitle: string;
  collections: CollectionRecord[];
  filters: OptionRecord[];
  selectedFilter: string;
  items: CardRecord[];
  emptyTitle?: string;
  emptyBody?: string;
  topInset: number;
  bottomInset: number;
  /** settings | search | seeAll | collection(key) | filter(key) | item(id) | itemMenu(id) | highlight(id) | highlightMenu(id) */
  onAction: (a: StashAction) => void;
}

const NativeHome = requireNativeView<Omit<StashHomeProps, 'onAction'> & NativeActionProps>('Expressive', 'StashHomeView');

export function StashHome(props: StashHomeProps) {
  return <NativeHome {...toNativeProps(props)} />;
}

/* ------------------------------- Nav toolbar ------------------------------ */

export interface StashNavToolbarProps extends PrimitiveBaseProps {
  items: OptionRecord[];
  selectedKey: string;
  fabIcon?: string;
  fabLabel?: string;
  bottomInset: number;
  /** tab(key) | fab */
  onAction: (a: StashAction) => void;
}

const NativeNavToolbar = requireNativeView<Omit<StashNavToolbarProps, 'onAction'> & NativeActionProps>(
  'Expressive',
  'StashNavToolbarView',
);

export function StashNavToolbar(props: StashNavToolbarProps) {
  return <NativeNavToolbar {...toNativeProps(props)} />;
}

/* --------------------------------- Detail --------------------------------- */

export interface StashDetailProps extends PrimitiveBaseProps {
  id: string;
  kind: CardKind;
  title: string;
  description?: string;
  site?: string;
  seed?: string;
  meta?: string;
  cover?: string | null;
  favicon?: string | null;
  favorite: boolean;
  readLabel: string;
  readIcon: string;
  canRead: boolean;
  editableBody?: boolean;
  body?: string;
  note?: string;
  folder: string;
  folderShape: string;
  lists: ChipRecord[];
  tags: ChipRecord[];
  suggestions: ChipRecord[];
  highlights: HighlightRecord[];
  url?: string | null;
  loading?: boolean;
  topInset: number;
  bottomInset: number;
  /**
   * back | more | read | share | title | favorite(value) | folder | addTag | addList | tag(key) | list(key)
   * | acceptTag(key, value=name) | note(value) | body(value) | highlight(key) | highlightMenu(key) | copyUrl
   */
  onAction: (a: StashAction) => void;
}

const NativeDetail = requireNativeView<Omit<StashDetailProps, 'onAction'> & NativeActionProps>('Expressive', 'StashDetailView');

export function StashDetail(props: StashDetailProps) {
  return <NativeDetail {...toNativeProps(props)} />;
}

/* ------------------------------- Quick save ------------------------------- */

export interface StashQuickSaveProps extends PrimitiveBaseProps {
  /** Set false to animate the sheet away; `dismiss` fires once it is gone. */
  visible: boolean;
  kind: CardKind;
  heading: string;
  subtitle: string;
  title: string;
  body?: string;
  /** Shows an editable body field with this label (notes and highlights). */
  bodyLabel?: string;
  cover?: string | null;
  seed?: string;
  showFolders: boolean;
  folders: OptionRecord[];
  selectedFolder: string;
  tags: ChipRecord[];
  duplicate?: string | null;
  menu: OptionRecord[];
  canSave: boolean;
  saving: boolean;
  saved: boolean;
  savedTitle?: string;
  savedBody?: string;
  canOpenApp?: boolean;
  /**
   * dismiss | title(value) | body(value) | folder(key) | moreFolders | tag(key, value=name) | addTag
   * | save | menu(key) | openApp | undo | view | viewDuplicate
   */
  onAction: (a: StashAction) => void;
}

const NativeQuickSave = requireNativeView<Omit<StashQuickSaveProps, 'onAction'> & NativeActionProps>(
  'Expressive',
  'StashQuickSaveView',
);

export function StashQuickSave(props: StashQuickSaveProps) {
  return <NativeQuickSave {...toNativeProps(props)} />;
}
