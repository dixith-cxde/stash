import { textKindForFile, typeForFile } from '@/features/capture/normalize';
import {
  chunkMarkdown,
  chunkText,
  decodeUtf8,
  extForMime,
  fileExt,
  fileGlyph,
  fileLabel,
  headLines,
  looksBinary,
  markdownPlain,
  textFileKind,
} from '@/features/files/kinds';
import { cardKind, kindIcon, kindLabel, sourceLabel } from '@/features/stash/model';

const utf8 = (s: string) => new TextEncoder().encode(s);

describe('text file detection', () => {
  it('detects Markdown by extension even when shared as text/plain', () => {
    expect(textFileKind({ fileName: 'README.md', mimeType: 'text/plain' })).toBe('markdown');
    expect(textFileKind({ fileName: 'notes.markdown' })).toBe('markdown');
    expect(textFileKind({ fileName: 'x', mimeType: 'text/markdown' })).toBe('markdown');
  });

  it('detects plain text by mime or extension', () => {
    expect(textFileKind({ fileName: 'a.txt' })).toBe('text');
    expect(textFileKind({ fileName: 'server.log', mimeType: 'application/octet-stream' })).toBe('text');
    expect(textFileKind({ fileName: 'data.csv', mimeType: 'text/csv' })).toBe('text');
    expect(textFileKind({ fileName: 'package.json', mimeType: 'application/json' })).toBe('text');
    expect(textFileKind({ fileName: 'Dockerfile' })).toBe('text');
    expect(textFileKind({ mimeType: 'text/x-python' })).toBe('text');
  });

  it('leaves PDFs, images, HTML and binaries alone', () => {
    expect(textFileKind({ fileName: 'a.pdf', mimeType: 'application/pdf' })).toBeNull();
    expect(textFileKind({ fileName: 'a.png', mimeType: 'image/png' })).toBeNull();
    expect(textFileKind({ fileName: 'page.html', mimeType: 'text/html' })).toBeNull();
    expect(textFileKind({ fileName: 'a.zip', mimeType: 'application/zip' })).toBeNull();
  });

  it('prefers the stored copy’s extension, then the title', () => {
    expect(textFileKind({ filePath: 'file:///docs/files/abc.md', title: 'My notes' })).toBe('markdown');
    expect(textFileKind({ filePath: 'file:///docs/files/abc.bin', title: 'log.txt' })).toBe('text');
  });

  it('labels and glyphs', () => {
    expect(fileLabel({ fileName: 'a.md' })).toBe('Markdown');
    expect(fileLabel({ fileName: 'a.txt' })).toBe('Text');
    expect(fileLabel({ fileName: 'a.csv' })).toBe('.csv');
    expect(fileLabel({ fileName: 'a.zip' })).toBe('.zip');
    expect(fileLabel({ filePath: 'file:///x/abc.bin' })).toBe('File');
    expect(fileGlyph({ fileName: 'a.md' })).toBe('MD');
    expect(fileGlyph({ fileName: 'a.json' })).toBe('JSON');
    expect(fileExt('/a/b/C.TXT')).toBe('txt');
    expect(extForMime('text/markdown; charset=utf-8')).toBe('md');
    expect(extForMime('image/jpeg')).toBe('jpg');
    expect(extForMime('application/zip')).toBeNull();
  });

  it('keeps shared text files as files, not notes', () => {
    const f = { path: 'content://x', fileName: 'todo.md', mimeType: 'text/plain' };
    expect(typeForFile(f)).toBe('file');
    expect(textKindForFile(f)).toBe('markdown');
  });
});

describe('card kinds for files', () => {
  const row = (filePath: string, extra: object = {}) => ({ type: 'file' as const, url: null, filePath, mimeType: null, title: 't', ...extra });

  it('maps text files to markdown / textfile cards', () => {
    expect(cardKind(row('file:///f/1.md'))).toBe('markdown');
    expect(cardKind(row('file:///f/1.csv'))).toBe('textfile');
    expect(cardKind(row('file:///f/1.zip'))).toBe('file');
    // Text files saved by older builds as type "text" with a file.
    expect(cardKind({ ...row('file:///f/1.txt'), type: 'text' })).toBe('textfile');
    expect(cardKind({ type: 'text', url: null })).toBe('note');
  });

  it('labels and icons', () => {
    expect(kindLabel(row('file:///f/1.md'))).toBe('Markdown');
    expect(kindIcon(row('file:///f/1.csv'))).toBe('tableChart');
    expect(kindIcon(row('file:///f/1.json'))).toBe('dataObject');
    expect(kindIcon(row('file:///f/1.txt'))).toBe('textSnippet');
    expect(sourceLabel({ ...row('file:///f/1.csv'), siteName: null, sourceApp: 'Files' })).toBe('.csv');
    expect(kindLabel({ type: 'link', url: 'https://github.com/a/b' })).toBe('Repo · a/b');
    expect(kindIcon({ type: 'link', url: 'https://play.google.com/store/apps/details?id=x' })).toBe('apps');
    expect(kindLabel({ type: 'link', url: 'https://example.com/post' })).toBeNull();
  });
});

describe('decoding and chunks', () => {
  it('decodes UTF-8, drops a cut-off trailing sequence and the BOM', () => {
    expect(decodeUtf8(utf8('héllo — 世界 😀'))).toBe('héllo — 世界 😀');
    const bytes = utf8('ab世');
    expect(decodeUtf8(bytes.subarray(0, bytes.length - 1))).toBe('ab');
    expect(decodeUtf8(new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69]))).toBe('hi');
  });

  it('decodes without a global TextDecoder too', () => {
    const g = globalThis as { TextDecoder?: unknown };
    const saved = g.TextDecoder;
    g.TextDecoder = undefined;
    try {
      expect(decodeUtf8(utf8('héllo — 世界 😀'))).toBe('héllo — 世界 😀');
      const bytes = utf8('x😀');
      expect(decodeUtf8(bytes.subarray(0, bytes.length - 2))).toBe('x');
    } finally {
      g.TextDecoder = saved;
    }
  });

  it('spots binary data', () => {
    expect(looksBinary(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe(true);
    expect(looksBinary(utf8('plain text'))).toBe(false);
  });

  it('chunks text by lines and Markdown at blank lines outside code fences', () => {
    const text = Array.from({ length: 130 }, (_, i) => `line ${i}`).join('\n');
    const parts = chunkText(text, 60);
    expect(parts).toHaveLength(3);
    expect(parts.join('\n')).toBe(text);

    const fence = '```\ncode\n\nmore code\n```';
    const md = ['# A', 'para one', '', fence, '', 'para two', '', 'para three'].join('\n');
    const chunks = chunkMarkdown(md, 5);
    expect(chunks.some((c) => c.includes('code\n\nmore code'))).toBe(true);
    expect(chunks.every((c) => (c.match(/```/g) ?? []).length % 2 === 0)).toBe(true);
    expect(chunkMarkdown('')).toEqual(['']);
  });

  it('makes short previews', () => {
    expect(headLines('a\r\nb\nc\nd', 2)).toBe('a\nb');
    expect(markdownPlain('# Title\n\nSome **bold** [link](http://x) text\n\n```\ncode\n```')).toBe('Title Some bold link text');
  });
});
