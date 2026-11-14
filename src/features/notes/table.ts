/** Column sizing for Markdown tables (pure, so it is testable without rendering). */

export type ColumnOptions = { min?: number; max?: number; charWidth?: number; padding?: number };

/**
 * Width (dp) per column from its longest cell, clamped so short columns stay readable and long
 * ones wrap instead of growing forever. A column is never narrower than its longest word.
 */
export function tableColumnWidths(rows: string[][], { min = 64, max = 240, charWidth = 8.4, padding = 32 }: ColumnOptions = {}): number[] {
  const cols = Math.max(0, ...rows.map((r) => r.length));
  const out: number[] = [];
  for (let k = 0; k < cols; k++) {
    let longest = 0;
    let word = 0;
    for (const r of rows) {
      const text = (r[k] ?? '').trim();
      longest = Math.max(longest, text.length);
      for (const w of text.split(/\s+/)) word = Math.max(word, w.length);
    }
    const want = longest * charWidth + padding;
    const floor = Math.min(word * charWidth + padding, max * 1.25);
    out.push(Math.round(Math.max(min, floor, Math.min(want, max))));
  }
  return out;
}

/** Stretches widths to fill `available` when the table is narrower; otherwise leaves them. */
export function fitColumns(widths: number[], available: number): number[] {
  const total = widths.reduce((a, b) => a + b, 0);
  if (!total || available <= total) return widths;
  const k = available / total;
  return widths.map((w) => Math.floor(w * k));
}
