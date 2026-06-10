import type { HolderGroupStar } from "@/types/universe";
import { clamp01, lerp } from "./seededRandom";

export type HolderStarVisual = {
  coreSize: number;
  glowSize: number;
  glowOpacity: number;
  sparkle: number;
  brightness: number;
};

/** Rank 5 anchor sizes — rank 75 floors at 60% of these. */
const RANK5_CORE = 8.8;
const RANK5_GLOW = 15;
const RANK5_BRIGHT = 1.16;

const RANK75_CORE = RANK5_CORE * 0.6;
const RANK75_GLOW = RANK5_GLOW * 0.6;
const RANK75_BRIGHT = 0.98;

export function normieHoldingsT(count: number, min: number, max: number) {
  if (max <= min) return 1;
  return clamp01(
    (Math.log(count) - Math.log(min)) / (Math.log(max) - Math.log(min)),
  );
}

/**
 * Tight rank-driven scale — position is primary hierarchy, holdings nudge ±5%.
 * Every star stays clearly above spiral arm particle size.
 */
export function visualFromHoldings(
  count: number,
  min: number,
  max: number,
  rank = 75,
): HolderStarVisual {
  let core: number;
  let glow: number;
  let brightness: number;
  let glowOpacity: number;
  let sparkle: number;

  if (rank === 1) {
    core = 11.8;
    glow = 24;
    brightness = 1.5;
    glowOpacity = 0.48;
    sparkle = 0.72;
  } else if (rank <= 5) {
    const t = (rank - 1) / 4;
    core = lerp(10.4, RANK5_CORE, t);
    glow = lerp(19, RANK5_GLOW, t);
    brightness = lerp(1.38, RANK5_BRIGHT, t);
    glowOpacity = lerp(0.42, 0.36, t);
    sparkle = lerp(0.66, 0.56, t);
  } else {
    const t = (rank - 5) / 70;
    core = lerp(RANK5_CORE, RANK75_CORE, t);
    glow = lerp(RANK5_GLOW, RANK75_GLOW, t);
    brightness = lerp(RANK5_BRIGHT, RANK75_BRIGHT, t);
    glowOpacity = lerp(0.34, 0.26, t);
    sparkle = lerp(0.54, 0.38, t);
  }

  const holdingsNudge = (normieHoldingsT(count, min, max) - 0.5) * 0.1;
  const nudge = 1 + holdingsNudge;

  return {
    coreSize: core * nudge,
    glowSize: glow * nudge,
    glowOpacity,
    sparkle,
    brightness: brightness * nudge,
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

export function hitRadiusForVisual(visual: HolderStarVisual) {
  return Math.max(10, visual.coreSize * 1.35 + visual.glowSize * 0.45);
}
