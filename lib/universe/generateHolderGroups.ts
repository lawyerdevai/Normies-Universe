import type { HolderGroupTier } from "@/types/universe";
import { clamp01, createRng, lerp } from "./seededRandom";
import { generateStarPosition, tierFromRank } from "./generateStarPositions";

export const TOTAL_HOLDERS = 1891;
const DATA_SEED = 77231;

export type RankRange = { rankStart: number; rankEnd: number };

function pushBatches(
  ranges: RankRange[],
  start: number,
  end: number,
  batchSize: number,
) {
  let cursor = start;
  while (cursor <= end) {
    ranges.push({
      rankStart: cursor,
      rankEnd: Math.min(cursor + batchSize - 1, end),
    });
    cursor += batchSize;
  }
}

/**
 * ~75 landmark groups: tight ranges at the top, wider batches in the long tail.
 */
export function buildRankRanges(totalHolders = TOTAL_HOLDERS): RankRange[] {
  const ranges: RankRange[] = [
    { rankStart: 1, rankEnd: 5 },
    { rankStart: 6, rankEnd: 15 },
    { rankStart: 16, rankEnd: 30 },
    { rankStart: 31, rankEnd: 50 },
  ];

  pushBatches(ranges, 51, Math.min(100, totalHolders), 10);
  if (totalHolders > 100) {
    pushBatches(ranges, 101, Math.min(300, totalHolders), 15);
  }
  if (totalHolders > 300) {
    pushBatches(ranges, 301, Math.min(800, totalHolders), 25);
  }
  if (totalHolders > 800) {
    pushBatches(ranges, 801, totalHolders, 35);
  }

  return ranges;
}

function computeTotalNormies(
  rankStart: number,
  index: number,
  holderCount: number,
  rng: () => number,
): number {
  const rankWeight = 1 - clamp01((rankStart - 1) / TOTAL_HOLDERS);
  const basePerHolder = lerp(4, 42, rankWeight);
  const whaleBonus = index < 12 ? lerp(18, 4, index / 12) : 0;
  const jitter = 0.85 + rng() * 0.35;
  return Math.max(
    holderCount,
    Math.round((basePerHolder + whaleBonus) * holderCount * jitter),
  );
}

function visualFromNormies(
  totalNormies: number,
  minNormies: number,
  maxNormies: number,
  tier: HolderGroupTier,
  rng: () => number,
) {
  const t = clamp01((totalNormies - minNormies) / Math.max(maxNormies - minNormies, 1));
  const tierFloor: Record<HolderGroupTier, number> = {
    core: 0.72,
    inner: 0.52,
    middle: 0.34,
    outer: 0.18,
  };

  const normieT = Math.max(t, tierFloor[tier]);

  return {
    size: lerp(0.28, 1.55, normieT) + rng() * 0.06,
    brightness: lerp(0.32, 1.0, normieT) + rng() * 0.04,
  };
}

/** Band-based starlight temperature: amber core → cool white outer. */
function holderStarColor(rankStart: number, rng: () => number): string {
  let hue: number;
  let sat: number;
  let light: number;

  if (rankStart <= 50) {
    hue = 38 + rng() * 4;
    sat = 20 + rng() * 4;
    light = 86 + rng() * 4;
  } else if (rankStart <= 100) {
    hue = 46 + rng() * 5;
    sat = 14 + rng() * 4;
    light = 87 + rng() * 4;
  } else if (rankStart <= 300) {
    hue = 54 + rng() * 6;
    sat = 9 + rng() * 3;
    light = 88 + rng() * 3;
  } else if (rankStart <= 800) {
    hue = 200 + rng() * 8;
    sat = 7 + rng() * 3;
    light = 86 + rng() * 3;
  } else {
    hue = 212 + rng() * 6;
    sat = 5 + rng() * 2;
    light = 84 + rng() * 3;
  }

  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

export function generateHolderGroupStats() {
  const rng = createRng(DATA_SEED);
  const ranges = buildRankRanges();

  const normieCounts = ranges.map((range, index) =>
    computeTotalNormies(
      range.rankStart,
      index,
      range.rankEnd - range.rankStart + 1,
      rng,
    ),
  );

  const minNormies = Math.min(...normieCounts);
  const maxNormies = Math.max(...normieCounts);

  return ranges.map((range, index) => {
    const tier = tierFromRank(range.rankStart);
    const holderCount = range.rankEnd - range.rankStart + 1;
    const totalNormies = normieCounts[index];
    const placement = generateStarPosition(index, tier, range.rankStart);
    const visuals = visualFromNormies(
      totalNormies,
      minNormies,
      maxNormies,
      tier,
      rng,
    );

    return {
      id: `group-${index + 1}`,
      label: `Holder Group ${index + 1}`,
      rankStart: range.rankStart,
      rankEnd: range.rankEnd,
      holderCount,
      totalNormies,
      tier,
      ...visuals,
      color: holderStarColor(range.rankStart, rng),
      position: placement.position,
      distanceFromCenter: placement.distanceFromCenter,
      clickable: true as const,
    };
  });
}
