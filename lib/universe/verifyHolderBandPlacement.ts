import {
  HOLDER_STAR_BANDS,
  PYRE_EXCLUSION_MARGIN,
  worldBoundsForRank,
  worldToLocal,
} from "./holderStarBands";
import { PYRE_RX, PYRE_RY, PYRE_RZ } from "./generatePyre";

export type PlacedHolderCheck = {
  rank: number;
  distance: number;
  bandMin: number;
  bandMax: number;
  inBand: boolean;
  inPyreZone: boolean;
};

export function verifyHolderBandPlacement(
  stars: {
    collectionRank: number;
    position: [number, number, number];
    distanceFromCenter: number;
  }[],
) {
  const sorted = [...stars].sort((a, b) => a.collectionRank - b.collectionRank);
  const checks: PlacedHolderCheck[] = sorted.map((star) => {
    const bounds = worldBoundsForRank(star.collectionRank);
    const dist = star.distanceFromCenter;
    const [lx, ly, lz] = worldToLocal(...star.position);
    const pyreNorm =
      (lx / PYRE_RX) ** 2 + (ly / PYRE_RY) ** 2 + (lz / PYRE_RZ) ** 2;
    const inPyreZone = pyreNorm < PYRE_EXCLUSION_MARGIN * PYRE_EXCLUSION_MARGIN;
    const inBand = dist >= bounds.min - 0.05 && dist <= bounds.max + 0.05;

    return {
      rank: star.collectionRank,
      distance: dist,
      bandMin: bounds.min,
      bandMax: bounds.max,
      inBand,
      inPyreZone,
    };
  });

  const bandViolations = checks.filter((c) => !c.inBand);
  const pyreViolations = checks.filter((c) => c.inPyreZone);

  let orderingOk = true;
  for (let i = 1; i < HOLDER_STAR_BANDS.length; i++) {
    const inner = HOLDER_STAR_BANDS[i - 1];
    const outer = HOLDER_STAR_BANDS[i];
    const innerMax = Math.max(
      ...checks
        .filter((c) => c.rank >= inner.rankLo && c.rank <= inner.rankHi)
        .map((c) => c.distance),
    );
    const outerMin = Math.min(
      ...checks
        .filter((c) => c.rank >= outer.rankLo && c.rank <= outer.rankHi)
        .map((c) => c.distance),
    );
    if (outerMin < innerMax - 0.05) orderingOk = false;
  }

  return {
    checks,
    bandViolations,
    pyreViolations,
    orderingOk,
    allValid:
      bandViolations.length === 0 &&
      pyreViolations.length === 0 &&
      orderingOk,
  };
}
