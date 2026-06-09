import type { HolderGroupStar } from "@/types/universe";
import { clamp01, lerp } from "./seededRandom";

export type HolderStarVisual = {
  coreSize: number;
  glowSize: number;
  glowOpacity: number;
  sparkle: number;
  brightness: number;
};

/** Visual range for top-holder stars — matches scene aesthetic, driven by Normie count. */
const HOLDINGS_VISUAL = {
  coreMin: 3.35,
  coreMax: 9.5,
  glowMin: 5.2,
  glowMax: 20,
  glowOpMin: 0.2,
  glowOpMax: 0.5,
  sparkleMin: 0.3,
  sparkleMax: 0.72,
  brightMin: 0.8,
  brightMax: 1.42,
};

export function normieHoldingsT(count: number, min: number, max: number) {
  if (max <= min) return 1;
  return clamp01(
    (Math.log(count) - Math.log(min)) / (Math.log(max) - Math.log(min)),
  );
}

export function visualFromHoldings(
  count: number,
  min: number,
  max: number,
  rank?: number,
): HolderStarVisual {
  const t = normieHoldingsT(count, min, max);
  const rankBoost = rank === 1 ? 1.08 : 1;

  return {
    coreSize: lerp(HOLDINGS_VISUAL.coreMin, HOLDINGS_VISUAL.coreMax, t) * rankBoost,
    glowSize: lerp(HOLDINGS_VISUAL.glowMin, HOLDINGS_VISUAL.glowMax, t) * rankBoost,
    glowOpacity: lerp(HOLDINGS_VISUAL.glowOpMin, HOLDINGS_VISUAL.glowOpMax, t),
    sparkle: lerp(HOLDINGS_VISUAL.sparkleMin, HOLDINGS_VISUAL.sparkleMax, t),
    brightness: lerp(HOLDINGS_VISUAL.brightMin, HOLDINGS_VISUAL.brightMax, t) * rankBoost,
  };
}

export function normieRangeFromStars(stars: HolderGroupStar[]) {
  const assigned = stars.filter((s) => s.collectionRank !== undefined);
  if (!assigned.length) return null;

  const counts = assigned.map((s) => s.totalNormies);
  return {
    min: Math.min(...counts),
    max: Math.max(...counts),
  };
}
