import { worldToLocal } from "./holderStarBands";

export type QuadrantCounts = [number, number, number, number];

/** Galaxy-disc quadrant from local XZ angle (0 = +X, counter-clockwise). */
export function positionQuadrant(
  position: [number, number, number],
): 0 | 1 | 2 | 3 {
  const [lx, , lz] = worldToLocal(...position);
  const angle = Math.atan2(lz, lx);
  if (angle >= 0 && angle < Math.PI / 2) return 0;
  if (angle >= Math.PI / 2) return 1;
  if (angle < -Math.PI / 2) return 2;
  return 3;
}

export function countQuadrants(
  positions: [number, number, number][],
): QuadrantCounts {
  const counts: QuadrantCounts = [0, 0, 0, 0];
  for (const pos of positions) {
    counts[positionQuadrant(pos)]++;
  }
  return counts;
}

/** Lower is better — sum of squared deviation from mean count. */
export function angularImbalanceScore(counts: QuadrantCounts): number {
  const total = counts.reduce((a, b) => a + b, 0);
  const mean = total / counts.length;
  return counts.reduce((sum, c) => sum + (c - mean) ** 2, 0);
}

export function quadrantSpread(counts: QuadrantCounts): number {
  return Math.max(...counts) - Math.min(...counts);
}

export type AngularBalanceReport = {
  counts: QuadrantCounts;
  imbalance: number;
  spread: number;
};

export function evaluateAngularBalance(
  stars: { position: [number, number, number] }[],
): AngularBalanceReport {
  const counts = countQuadrants(stars.map((s) => s.position));
  return {
    counts,
    imbalance: angularImbalanceScore(counts),
    spread: quadrantSpread(counts),
  };
}
