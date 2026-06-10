import type { RankedHolder } from "@/lib/opensea/holders";
import { truncateWallet } from "@/lib/opensea/holders";
import type { HolderGroupStar } from "@/types/universe";
import {
  normieRangeFromStars,
  visualFromHoldings,
} from "./holderStarVisual";
import { evaluateAngularBalance } from "./angularBalance";
import { PLACEMENT_SEED } from "./holderStarScatter";
import {
  holderStarCollisionRadius,
  resolveHolderStarSpacing,
} from "./resolveHolderStarSpacing";
import { verifyPyreScreenExclusion } from "./pyreScreenExclusion";
import { verifyHolderBandPlacement } from "./verifyHolderBandPlacement";

export function countClickableStars(stars: HolderGroupStar[]) {
  return stars.filter((s) => s.clickable).length;
}

/**
 * Map top-N holders to star slots, place by collection rank on spiral arms,
 * size/brightness follow Normie count. Color and tier stay unchanged.
 */
export function assignHoldersToStars(
  stars: HolderGroupStar[],
  rankedHolders: RankedHolder[],
  placementSeed: number = PLACEMENT_SEED,
): HolderGroupStar[] {
  const clickable = stars.filter((s) => s.clickable);
  const n = Math.min(clickable.length, rankedHolders.length);
  const top = rankedHolders.slice(0, n);

  const byDistance = [...clickable]
    .sort((a, b) => a.distanceFromCenter - b.distanceFromCenter)
    .slice(0, n);

  const assignments = new Map<string, RankedHolder>();
  byDistance.forEach((star, i) => {
    assignments.set(star.id, top[i]);
  });

  const mapped = stars.map((star) => {
    const holder = assignments.get(star.id);
    if (!holder) return star;

    return {
      ...star,
      id: `holder-${holder.address.toLowerCase()}`,
      label: truncateWallet(holder.address),
      wallet: holder.address,
      walletDisplay: truncateWallet(holder.address),
      collectionRank: holder.rank,
      totalNormies: holder.count,
      holderCount: 1,
    };
  });

  const range = normieRangeFromStars(mapped);
  if (!range) return mapped;

  const assigned = mapped
    .filter((star) => star.collectionRank !== undefined)
    .sort((a, b) => a.collectionRank! - b.collectionRank!);

  const placed: { position: [number, number, number]; radius: number }[] = [];
  const placementById = new Map<string, ReturnType<typeof resolveHolderStarSpacing>>();
  const quadrantCounts: [number, number, number, number] = [0, 0, 0, 0];

  for (const star of assigned) {
    const visual = visualFromHoldings(
      star.totalNormies,
      range.min,
      range.max,
      star.collectionRank!,
    );
    const placement = resolveHolderStarSpacing(
      star.collectionRank!,
      star.wallet ?? star.id,
      visual,
      placed,
      quadrantCounts,
      placementSeed,
    );
    placementById.set(star.id, placement);
    placed.push({
      position: placement.position,
      radius: holderStarCollisionRadius(visual, star.collectionRank!),
    });
  }

  const result = mapped.map((star) => {
    const placement = placementById.get(star.id);
    if (!placement) return star;

    const visual = visualFromHoldings(
      star.totalNormies,
      range.min,
      range.max,
      star.collectionRank!,
    );

    return {
      ...star,
      position: placement.position,
      distanceFromCenter: placement.distanceFromCenter,
      size: visual.coreSize,
      brightness: visual.brightness,
    };
  });

  if (process.env.NODE_ENV === "development") {
    const placed = result.filter((s) => s.collectionRank !== undefined);
    const placedForVerify = placed.map((s) => ({
      collectionRank: s.collectionRank!,
      position: s.position,
      distanceFromCenter: s.distanceFromCenter,
    }));
    const bandCheck = verifyHolderBandPlacement(placedForVerify);
    const screenCheck = verifyPyreScreenExclusion(placedForVerify);
    const angular = evaluateAngularBalance(placedForVerify);
    console.info(
      "[Normie Universe] Holder band placement verify",
      {
        allValid: bandCheck.allValid,
        bandViolations: bandCheck.bandViolations.length,
        pyreViolations: bandCheck.pyreViolations.length,
        orderingOk: bandCheck.orderingOk,
        screenClear: screenCheck.allClear,
        screenViolations: screenCheck.violations.length,
        quadrants: angular.counts,
        angularSpread: angular.spread,
      },
      bandCheck.checks.map((c) => ({
        rank: c.rank,
        dist: Number(c.distance.toFixed(2)),
        band: `${c.bandMin.toFixed(1)}-${c.bandMax.toFixed(1)}`,
        ok: c.inBand && !c.inPyreZone,
      })),
    );
  }

  return result;
}

export function verifyAssignment(stars: HolderGroupStar[]) {
  const assigned = stars.filter((s) => s.collectionRank !== undefined);
  const byDistance = [...assigned].sort(
    (a, b) => a.distanceFromCenter - b.distanceFromCenter,
  );
  const ranks = byDistance.map((s) => s.collectionRank!);
  const monotonic = ranks.every((r, i) => i === 0 || r >= ranks[i - 1]);

  return {
    count: assigned.length,
    rankMonotonicByDistance: monotonic,
    closest: byDistance[0]
      ? {
          rank: byDistance[0].collectionRank,
          wallet: byDistance[0].walletDisplay,
          distance: byDistance[0].distanceFromCenter,
        }
      : null,
    farthest: byDistance[byDistance.length - 1]
      ? {
          rank: byDistance[byDistance.length - 1].collectionRank,
          wallet: byDistance[byDistance.length - 1].walletDisplay,
          distance: byDistance[byDistance.length - 1].distanceFromCenter,
        }
      : null,
  };
}
