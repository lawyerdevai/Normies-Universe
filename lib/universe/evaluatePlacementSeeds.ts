import { assignHoldersToStars } from "./assignHoldersToStars";
import { evaluateAngularBalance } from "./angularBalance";
import { getHolderGroups } from "./mockUniverseData";
import { verifyHolderBandPlacement } from "./verifyHolderBandPlacement";
import { verifyPyreScreenExclusion } from "./pyreScreenExclusion";

const MOCK_HOLDERS = Array.from({ length: 75 }, (_, i) => ({
  address: `0x${(i + 1).toString(16).padStart(40, "0")}`,
  count: 200 - i,
  rank: i + 1,
}));

export type SeedEvaluation = {
  seed: number;
  quadrants: [number, number, number, number];
  spread: number;
  imbalance: number;
  bandValid: boolean;
  screenClear: boolean;
  score: number;
};

export function evaluatePlacementSeed(seed: number): SeedEvaluation {
  const stars = assignHoldersToStars(getHolderGroups(), MOCK_HOLDERS, seed);
  const placed = stars
    .filter((s) => s.collectionRank !== undefined)
    .map((s) => ({
      collectionRank: s.collectionRank!,
      position: s.position,
      distanceFromCenter: s.distanceFromCenter,
    }));

  const angular = evaluateAngularBalance(placed);
  const band = verifyHolderBandPlacement(placed);
  const screen = verifyPyreScreenExclusion(placed);

  const valid = band.allValid && screen.allClear;
  const score = valid
    ? angular.imbalance + angular.spread * 4
    : Number.POSITIVE_INFINITY;

  return {
    seed,
    quadrants: angular.counts,
    spread: angular.spread,
    imbalance: angular.imbalance,
    bandValid: band.allValid,
    screenClear: screen.allClear,
    score,
  };
}

export function evaluatePlacementSeeds(
  seeds: number[],
): { results: SeedEvaluation[]; best: SeedEvaluation | null } {
  const results = seeds.map(evaluatePlacementSeed).sort((a, b) => a.score - b.score);
  const best = results.find((r) => Number.isFinite(r.score)) ?? null;
  return { results, best };
}
