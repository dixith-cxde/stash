/** Pages to have ready around the one on screen, nearest first (the next page before the previous). */
export function pagesAround(current: number, pageCount: number, ahead = 2, behind = 1): number[] {
  const out: number[] = [current];
  for (let d = 1; d <= Math.max(ahead, behind); d++) {
    if (d <= ahead && current + d < pageCount) out.push(current + d);
    if (d <= behind && current - d >= 0) out.push(current - d);
  }
  return out.filter((p) => p >= 0 && p < pageCount);
}
