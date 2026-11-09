import type { BookmarkType } from '@/db/schema';

/** Platform-agnostic shape of whatever another app handed us. */
export type IncomingShare = {
  text?: string | null;
  webUrl?: string | null;
  files?: IncomingFile[] | null;
  /** Text from Android's "PROCESS_TEXT" selection menu. */
  processText?: string | null;
  sourceApp?: string | null;
};

export type IncomingFile = {
  path: string;
  mimeType?: string | null;
  fileName?: string | null;
  size?: number | null;
};

export type CaptureDraft =
  | {
      kind: 'bookmark';
      type: BookmarkType;
      title: string;
      url?: string;
      content?: string;
      file?: IncomingFile;
      sourceApp?: string;
    }
  | { kind: 'highlight'; text: string; sourceUrl?: string; sourceApp?: string };

const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]}]/i;

export function extractUrl(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  return text.match(URL_RE)?.[0];
}

export function isProbablyUrl(text: string): boolean {
  const trimmed = text.trim();
  return /^https?:\/\/\S+$/i.test(trimmed);
}

export function typeForFile(file: IncomingFile): BookmarkType {
  const mime = file.mimeType?.toLowerCase() ?? '';
  const name = file.fileName?.toLowerCase() ?? file.path.toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|avif)$/.test(name)) return 'image';
  if (mime.startsWith('text/') && !mime.includes('html')) return 'text';
  return 'file';
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function firstLine(text: string, max = 80): string {
  const line = text.trim().split(/\r?\n/)[0] ?? '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/**
 * Turn a raw share payload into one or more drafts.
 *
 * Rules:
 * - PROCESS_TEXT (text selected in another app) is always a highlight.
 * - Every file becomes its own bookmark.
 * - A message that is just a URL becomes a link; a message that contains a URL plus
 *   other text becomes a link whose title is the surrounding text (common for apps that
 *   share "Article title https://…").
 * - Any other text becomes a text snippet.
 */
export function normalizeShare(share: IncomingShare): CaptureDraft[] {
  const sourceApp = share.sourceApp ?? undefined;

  if (share.processText?.trim()) {
    return [{ kind: 'highlight', text: share.processText.trim(), sourceApp }];
  }

  const drafts: CaptureDraft[] = [];

  for (const file of share.files ?? []) {
    const type = typeForFile(file);
    drafts.push({
      kind: 'bookmark',
      type,
      title: file.fileName ?? (type === 'pdf' ? 'Untitled PDF' : 'Untitled file'),
      file,
      sourceApp,
    });
  }

  const text = share.text?.trim() ?? '';
  const url = share.webUrl ?? extractUrl(text);

  if (url) {
    const rest = text.replace(url, '').trim();
    drafts.push({
      kind: 'bookmark',
      type: 'link',
      url,
      title: rest ? firstLine(rest, 120) : hostOf(url),
      sourceApp,
    });
  } else if (text) {
    drafts.push({ kind: 'bookmark', type: 'text', title: firstLine(text), content: text, sourceApp });
  }

  return drafts;
}
