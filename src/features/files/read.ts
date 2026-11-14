import { File, FileMode } from 'expo-file-system';

import { decodeUtf8, looksBinary } from './kinds';

/** The viewer shows at most this much of a file; more stays a tap away in another app. */
export const VIEWER_MAX_BYTES = 200 * 1024;
/** Saved with the bookmark so cards, the item page and search have something to show. */
export const EXCERPT_MAX_BYTES = 16 * 1024;

export type TextHead = { text: string; truncated: boolean; size: number; binary: boolean };

/**
 * Reads the first `maxBytes` of a local file as UTF-8, asynchronously (the native side does
 * the I/O, so the JS thread only decodes a capped buffer).
 */
export async function readTextHead(uri: string, maxBytes = VIEWER_MAX_BYTES): Promise<TextHead> {
  const file = new File(uri);
  const handle = file.open(FileMode.ReadOnly);
  try {
    const size = handle.size ?? file.size ?? 0;
    const bytes = await handle.readBytes(Math.min(maxBytes, Math.max(size, 1)));
    if (looksBinary(bytes)) return { text: '', truncated: size > bytes.length, size, binary: true };
    return { text: decodeUtf8(bytes), truncated: size > bytes.length, size, binary: false };
  } finally {
    handle.close();
  }
}
