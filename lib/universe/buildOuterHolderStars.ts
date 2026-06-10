import type { RankedHolder } from "@/lib/opensea/holders";
import { truncateWallet } from "@/lib/opensea/holders";
import type { OuterHolderStar } from "@/types/universe";
import { hashSeed, skyVisualFromHash } from "./outerSkyMath";
import { placeOuterHolderStar } from "./placeOuterHolderStar";

export function buildOuterHolderStars(
  rankedHolders: RankedHolder[],
): OuterHolderStar[] {
  return rankedHolders.slice(75).map((holder) => {
    const wallet = holder.address.toLowerCase();
    const hash = hashSeed(wallet);
    const visual = skyVisualFromHash(hash, (hash >> 20) % 100);

    const placement = placeOuterHolderStar(holder.address);

    return {
      id: `outer-${wallet}`,
      wallet: holder.address,
      walletDisplay: truncateWallet(holder.address),
      collectionRank: holder.rank,
      normieCount: holder.count,
      position: placement.position,
      distanceFromCenter: placement.distanceFromCenter,
      screenPixels: visual.screenPixels,
      opacity: visual.opacity,
      color: visual.color,
      twinklePhase: visual.twinklePhase,
      twinkleSpeed: visual.twinkleSpeed,
      twinkles: visual.twinkles,
      tier: visual.tier,
    };
  });
}
