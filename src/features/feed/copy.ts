import { cardKind, type FeedItem } from '@/features/stash/model';

/** What a feed card's text is, for "Copy note" / "Note copied". */
export type CopyNoun = 'Note' | 'Highlight' | 'Text';

export type CopyTargets = {
  /** Web URL to copy or share (http/https only: never a local file path). */
  link?: string;
  /** Text body to copy (note Markdown, highlight text, text file contents). */
  text?: string;
  /** Names `text`. Set exactly when `text` is. */
  noun?: CopyNoun;
  /** What the card's copy button copies; undefined: the card shows no button. */
  primary?: 'link' | 'text';
  /** Sheet title. */
  title: string;
};

const webUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : undefined);
const nonEmpty = (s: string | null | undefined) => (s && s.trim() ? s : undefined);

/** What can be copied or shared from a feed card (card button and long-press sheet). */
export function copyTargets(f: FeedItem): CopyTargets {
  if (f.kind === 'highlight') {
    const h = f.highlight;
    const text = nonEmpty(h.text);
    return {
      link: webUrl(h.sourceUrl),
      ...(text ? { text, noun: 'Highlight' as const, primary: 'text' as const } : {}),
      title: h.sourceTitle || h.bookmarkTitle || 'Highlight',
    };
  }
  const b = f.item;
  const link = webUrl(b.url);
  const kind = cardKind(b);
  const noun: CopyNoun | undefined =
    kind === 'note' ? 'Note' : kind === 'markdown' || kind === 'textfile' ? 'Text' : undefined;
  const text = noun ? nonEmpty(b.content) : undefined;
  const title = b.title || (kind === 'note' ? 'Untitled note' : 'Untitled');
  if (text && noun) return { link, text, noun, primary: 'text', title };
  const primary = link && (kind === 'link' || kind === 'video') ? 'link' : undefined;
  return { link, primary, title };
}

/** Snackbar message after copying. */
export const copiedMessage = (t: CopyTargets, what: 'link' | 'text') =>
  what === 'link' ? 'Link copied' : `${t.noun ?? 'Text'} copied`;
