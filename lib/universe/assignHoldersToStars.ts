import type { RankedHolder } from "@/lib/opensea/holders";
import { truncateWallet } from "@/lib/opensea/holders";
import type { HolderGroupStar } from "@/types/universe";
import {
  normieRangeFromStars,
  visualFromHoldings,
} from "./holderStarVisual";
import { placeTopHolderStar } from "./placeTopHolderStar";

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

  return mapped.map((star) => {
    if (star.collectionRank === undefined) return star;

    const visual = visualFromHoldings(
      star.totalNormies,
      range.min,
      range.max,
      star.collectionRank,
    );
    const placement = placeTopHolderStar(
      star.collectionRank,
      star.wallet ?? star.id,
    );

    return {
      ...star,
      position: placement.position,
      distanceFromCenter: placement.distanceFromCenter,
      size: visual.coreSize,
      brightness: visual.brightness,
    };
  });
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
