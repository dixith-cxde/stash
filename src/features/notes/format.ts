import { type ComponentRef, type RefObject, useEffect, useRef } from 'react';
import type { TextInput } from 'react-native';

export type Selection = { start: number; end: number };

/** A formatting action: wrap the selection in markers, or prefix the current line. */
export type MdFormat = { wrap?: [string, string]; line?: string };

/**
 * Applies a Markdown format to `text` at `sel`. Returns the new text and where the caret
 * should go: inside the markers (around the wrapped words, if any), or after a line prefix.
 */
export function applyFormat(text: string, sel: Selection, f: MdFormat): { text: string; selection: Selection } {
  const start = Math.max(0, Math.min(sel.start, sel.end, text.length));
  const end = Math.min(text.length, Math.max(sel.start, sel.end));
  if (f.wrap) {
    const [open, close] = f.wrap;
    const inner = text.slice(start, end);
    return {
      text: text.slice(0, start) + open + inner + close + text.slice(end),
      selection: { start: start + open.length, end: start + open.length + inner.length },
    };
  }
  if (f.line) {
    const lineStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
    return {
      text: text.slice(0, lineStart) + f.line + text.slice(lineStart),
      selection: { start: start + f.line.length, end: end + f.line.length },
    };
  }
  return { text, selection: { start, end } };
}

/**
 * Puts the caret where a programmatic edit wants it. Call the returned function right
 * before setting the new text; the caret moves once the input has the new value.
 */
export function useCaretAfterEdit(input: RefObject<ComponentRef<typeof TextInput> | null>, value: string) {
  const pending = useRef<Selection | null>(null);
  useEffect(() => {
    const s = pending.current;
    if (!s) return;
    pending.current = null;
    input.current?.setSelection(s.start, s.end);
  }, [value, input]);
  return (s: Selection) => {
    pending.current = s;
  };
}
