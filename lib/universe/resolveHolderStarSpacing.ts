import { type QuadrantCounts, positionQuadrant } from "./angularBalance";
import { enforceHolderStarPlacement } from "./enforceHolderStarPlacement";
import type { StarPlacement } from "./generateStarPositions";
import type { HolderStarVisual } from "./holderStarVisual";
import { PLACEMENT_SEED } from "./holderStarScatter";
import { clearPyreScreenOverlap } from "./pyreScreenExclusion";
import { placeTopHolderStar, rotatePlacementY } from "./placeTopHolderStar";

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function holderStarCollisionRadius(
  visual: HolderStarVisual,
  rank: number,
) {
  const base = 2.6 + (visual.coreSize + visual.glowSize * visual.glowOpacity) * 0.24;
  return rank <= 5 ? base * 1.3 : base;
}

function dist3(
  a: [number, number, number],
  b: [number, number, number],
) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

type PlacedStar = {
  position: [number, number, number];
  radius: number;
};

function hasCollision(
  position: [number, number, number],
  radius: number,
  placed: PlacedStar[],
) {
  for (const other of placed) {
    const minGap = 2 * Math.max(radius, other.radius);
    if (dist3(position, other.position) < minGap) return true;
  }
  return false;
}

/** Deterministic ring-band nudge until minimum spacing clears. */
export function resolveHolderStarSpacing(
  rank: number,
  seed: string,
  visual: HolderStarVisual,
  placed: PlacedStar[],
  quadrantCounts: QuadrantCounts,
  placementSeed: number = PLACEMENT_SEED,
): StarPlacement {
  const radius = holderStarCollisionRadius(visual, rank);
  const hash = hashSeed(seed.toLowerCase());

  for (let attempt = 0; attempt < 28; attempt++) {
    const dir = ((hash + attempt * 7919) % 2 === 0 ? 1 : -1) as 1 | -1;
    const angleOffset =
      attempt === 0
        ? 0
        : dir * (0.14 + attempt * 0.11 + ((hash >> (attempt % 8)) % 100) * 0.002);

    let placement = placeTopHolderStar(rank, seed, angleOffset, placementSeed);
    if (attempt > 0) {
      const rotStep = dir * (0.09 + attempt * 0.06);
      placement = rotatePlacementY(placement, rotStep);
    }

    if (!hasCollision(placement.position, radius, placed)) {
      return finalizeHolderPlacement(rank, seed, placement, quadrantCounts);
    }
  }

  const fallback = rotatePlacementY(
    placeTopHolderStar(rank, seed, 0, placementSeed),
    (((hash >> 6) % 1000) / 1000) * Math.PI * 0.5,
  );
  return finalizeHolderPlacement(rank, seed, fallback, quadrantCounts);
}

function finalizeHolderPlacement(
  rank: number,
  seed: string,
  placement: StarPlacement,
  quadrantCounts: QuadrantCounts,
): StarPlacement {
  let result = enforceHolderStarPlacement(rank, placement);
  const cleared = clearPyreScreenOverlap(
    result.position,
    rank,
    seed,
    quadrantCounts,
  );
  if (
    cleared[0] !== result.position[0] ||
    cleared[1] !== result.position[1] ||
    cleared[2] !== result.position[2]
  ) {
    const dist = Math.sqrt(cleared[0] ** 2 + cleared[1] ** 2 + cleared[2] ** 2);
    result = enforceHolderStarPlacement(rank, {
      position: cleared,
      distanceFromCenter: dist,
    });
  }

  quadrantCounts[positionQuadrant(result.position)]++;
  return result;
}
