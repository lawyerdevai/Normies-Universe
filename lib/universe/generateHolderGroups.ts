import type { HolderGroupTier } from "@/types/universe";
import { clamp01, createRng, lerp } from "./seededRandom";
import { generateStarPosition, tierFromRank } from "./generateStarPositions";

const TOTAL_HOLDERS = 1891;
const GROUP_COUNT = 189;
const DATA_SEED = 77231;

export type RankRange = { rankStart: number; rankEnd: number };

export function buildRankRanges(): RankRange[] {
  const ranges: RankRange[] = [
    { rankStart: 1, rankEnd: 3 },
    { rankStart: 4, rankEnd: 7 },
    { rankStart: 8, rankEnd: 10 },
  ];

  let cursor = 11;
  for (let g = 4; g <= GROUP_COUNT; g++) {
    const remaining = TOTAL_HOLDERS - cursor + 1;
    const groupsLeft = GROUP_COUNT - g + 1;
    const batch = Math.ceil(remaining / groupsLeft);
    ranges.push({
      rankStart: cursor,
      rankEnd: Math.min(cursor + batch - 1, TOTAL_HOLDERS),
    });
    cursor += batch;
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
  const lightness = 78 + normieT * 18 + rng() * 4;

  return {
    size: lerp(0.28, 1.55, normieT) + rng() * 0.06,
    brightness: lerp(0.32, 1.0, normieT) + rng() * 0.04,
    color: `hsl(220, 8%, ${lightness}%)`,
  };
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
      position: placement.position,
      distanceFromCenter: placement.distanceFromCenter,
      clickable: true as const,
    };
  });
}
