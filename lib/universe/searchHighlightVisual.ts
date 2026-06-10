/** Rank-1 holder star — search highlight target for every holder star. */
export const SEARCH_HIGHLIGHT_RANK1 = {
  coreSize: 11.8,
  glowSize: 24,
  glowOpacity: 0.48,
  brightness: 1.5,
  sparkle: 0.72,
} as const;

export function searchHighlightGlimmer(elapsedTime: number): number {
  return (
    0.86 +
    0.09 * Math.sin(elapsedTime * 2.1) +
    0.06 * Math.sin(elapsedTime * 3.4 + 1.2)
  );
}

export function searchHighlightSparkle(elapsedTime: number, baseSparkle: number) {
  return baseSparkle * (0.82 + 0.18 * Math.sin(elapsedTime * 2.4 + 0.6));
}

export function lerpSearchHighlight(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
