/**
 * Pure helpers for files saved into Stash: which ones we can show as text, labels, a small
 * UTF-8 decoder and the chunking the viewer uses. No React, no native modules (unit-tested).
 */

/** Files Stash can show in its own viewer: rendered Markdown, or plain text. */
export type TextFileKind = 'markdown' | 'text';

const MARKDOWN_EXT = new Set(['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdx']);

/** Extensions that are plain text even when the sender gives no (or a generic) mime type. */
const TEXT_EXT = new Set([
  'txt', 'text', 'log', 'csv', 'tsv', 'json', 'jsonl', 'ndjson', 'xml', 'yaml', 'yml', 'toml', 'ini',
  'cfg', 'conf', 'env', 'properties', 'srt', 'vtt', 'rst', 'adoc', 'org', 'tex', 'bib', 'diff', 'patch',
  'sql', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'py', 'rb',
  'go', 'rs', 'java', 'kt', 'kts', 'swift', 'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'php', 'lua', 'dart',
  'css', 'scss', 'gradle', 'gitignore', 'dockerfile', 'makefile',
]);

const TEXT_MIME = new Set([
  'application/json', 'application/ld+json', 'application/xml', 'application/x-yaml', 'application/yaml',
  'application/toml', 'application/x-sh', 'application/x-subrip', 'application/javascript',
  'application/x-javascript', 'application/sql', 'application/x-ndjson',
]);

/** Lower-case extension of a file name or path ("notes.MD" → "md"), or "" when there is none. */
export function fileExt(name: string | null | undefined): string {
  if (!name) return '';
  const base = name.split(/[/\\]/).pop() ?? '';
  const m = base.match(/\.([a-z0-9+_-]{1,12})$/i);
  if (m) return m[1].toLowerCase();
  // Extension-less names that are text by convention (Dockerfile, Makefile).
  const lower = base.toLowerCase();
  return lower === 'dockerfile' || lower === 'makefile' ? lower : '';
}

type FileLike = { mimeType?: string | null; fileName?: string | null; filePath?: string | null; title?: string | null };

/** The extension that best describes a saved file: the stored copy's, then the title's. */
function extOf(f: FileLike): string {
  const fromPath = fileExt(f.filePath);
  if (fromPath && fromPath !== 'bin') return fromPath;
  return fileExt(f.fileName) || fileExt(f.title);
}

/**
 * Markdown / plain text, or null for anything else (PDFs, images, archives, HTML).
 * The extension wins over the mime type: Android often shares `.md` files as text/plain.
 */
export function textFileKind(f: FileLike): TextFileKind | null {
  const ext = extOf(f);
  const mime = f.mimeType?.toLowerCase().split(';')[0].trim() ?? '';
  if (MARKDOWN_EXT.has(ext) || mime === 'text/markdown' || mime === 'text/x-markdown') return 'markdown';
  if (ext === 'pdf' || ext === 'html' || ext === 'htm' || mime.includes('html')) return null;
  if (TEXT_EXT.has(ext) || TEXT_MIME.has(mime)) return 'text';
  if (mime.startsWith('text/')) return 'text';
  return null;
}

/** Extension to store a copied file under when the name has none (mime → ext). */
export function extForMime(mime: string | null | undefined): string | null {
  const m = mime?.toLowerCase().split(';')[0].trim();
  if (!m) return null;
  const known: Record<string, string> = {
    'application/pdf': 'pdf',
    'text/markdown': 'md',
    'text/x-markdown': 'md',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'text/tab-separated-values': 'tsv',
    'application/json': 'json',
    'application/xml': 'xml',
    'text/xml': 'xml',
    'application/x-yaml': 'yaml',
    'application/yaml': 'yaml',
  };
  if (known[m]) return known[m];
  if (m.startsWith('image/')) return m.slice(6).replace('jpeg', 'jpg').replace(/\+.*$/, '');
  return null;
}

/** "Markdown", "Text", or the extension for anything more specific (".csv", ".json"). */
export function fileLabel(f: FileLike): string {
  const kind = textFileKind(f);
  if (kind === 'markdown') return 'Markdown';
  const ext = extOf(f);
  if (kind === 'text') return !ext || ext === 'txt' || ext === 'text' ? 'Text' : `.${ext}`;
  if (ext === 'pdf') return 'PDF';
  return ext && ext !== 'bin' ? `.${ext}` : 'File';
}

/** Short glyph for an art tile: "MD", "TXT", "CSV". */
export function fileGlyph(f: FileLike): string {
  if (textFileKind(f) === 'markdown') return 'MD';
  const ext = extOf(f);
  return ext && ext !== 'bin' ? ext.slice(0, 4).toUpperCase() : 'FILE';
}

/** Code-ish and tabular text reads best in monospace; prose (.txt, .log) in the body font. */
export function prefersMonospace(f: FileLike): boolean {
  const ext = extOf(f);
  return !!ext && !['txt', 'text', 'rst', 'adoc', 'org', 'srt', 'vtt'].includes(ext);
}

// --- Decoding --------------------------------------------------------------------------------

/**
 * UTF-8 → string. A multi-byte sequence cut off at the end (we read capped chunks) is dropped
 * instead of becoming garbage; invalid bytes become U+FFFD. A leading BOM is removed.
 */
export function decodeUtf8(bytes: Uint8Array): string {
  let end = bytes.length;
  // Back off from a truncated trailing sequence.
  for (let i = 1; i <= 3 && end - i >= 0; i++) {
    const b = bytes[end - i];
    if ((b & 0xc0) === 0x80) continue; // continuation byte, keep looking for the lead
    const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 1;
    if (need > i) end -= i;
    break;
  }
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;

  const Decoder = (globalThis as { TextDecoder?: new (label?: string) => { decode(b: Uint8Array): string } }).TextDecoder;
  if (Decoder) {
    try {
      return new Decoder('utf-8').decode(bytes.subarray(start, end));
    } catch {
      // fall through to the manual decoder
    }
  }

  const out: string[] = [];
  let buf: number[] = [];
  const flush = () => {
    out.push(String.fromCharCode(...buf));
    buf = [];
  };
  let i = start;
  while (i < end) {
    const b = bytes[i];
    let cp = 0xfffd;
    let len = 1;
    if (b < 0x80) cp = b;
    else if (b >= 0xc2 && b < 0xe0 && i + 1 < end) {
      cp = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      len = 2;
    } else if (b >= 0xe0 && b < 0xf0 && i + 2 < end) {
      cp = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      len = 3;
    } else if (b >= 0xf0 && b < 0xf5 && i + 3 < end) {
      cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      len = 4;
    }
    if (cp > 0xffff) {
      cp -= 0x10000;
      buf.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else buf.push(cp);
    i += len;
    if (buf.length > 4096) flush();
  }
  flush();
  return out.join('');
}

/** True when the bytes look binary (NUL bytes in the first KB): don't show those as text. */
export function looksBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 1024);
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return true;
  return false;
}

// --- Excerpts and chunks ---------------------------------------------------------------------

/** First `maxLines` lines (each capped) of a text, for card and item-page previews. */
export function headLines(text: string, maxLines: number, maxChars = 160): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n', maxLines + 1)
    .slice(0, maxLines)
    .map((l) => (l.length > maxChars ? `${l.slice(0, maxChars - 1)}…` : l))
    .join('\n')
    .trimEnd();
}

/** A one-paragraph plain-text preview of Markdown (no markup), for compact cards. */
export function markdownPlain(md: string, max = 220): string {
  const plain = md
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}

/**
 * Splits plain text into list rows of about `lines` lines each, so a long file renders as a
 * virtualized list instead of one huge Text.
 */
export function chunkText(text: string, lines = 60): string[] {
  const all = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  for (let i = 0; i < all.length; i += lines) out.push(all.slice(i, i + lines).join('\n'));
  return out.length ? out : [''];
}

/**
 * Splits Markdown into blocks of roughly `target` characters, cutting only at blank lines
 * outside fenced code blocks so each chunk still parses on its own.
 */
export function chunkMarkdown(md: string, target = 3000): string[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let cur: string[] = [];
  let size = 0;
  let fence: string | null = null;
  for (const line of lines) {
    const f = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
    }
    cur.push(line);
    size += line.length + 1;
    if (!fence && line.trim() === '' && size >= target) {
      out.push(cur.join('\n').trim());
      cur = [];
      size = 0;
    }
  }
  const rest = cur.join('\n').trim();
  if (rest || !out.length) out.push(rest);
  return out.filter((c, i) => c || i === 0);
}

export function formatBytes(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
