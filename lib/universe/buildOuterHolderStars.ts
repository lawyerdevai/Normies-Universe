import type { RankedHolder } from "@/lib/opensea/holders";
import { truncateWallet } from "@/lib/opensea/holders";
import type { OuterHolderStar } from "@/types/universe";
import { placeOuterHolderStar } from "./placeOuterHolderStar";
import { createRng, lerp } from "./seededRandom";

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Pale blue-white — cool tint without strong blue saturation. */
function coolBlueColor(rng: () => number): [number, number, number] {
  const t = rng();
  return [
    lerp(128 / 255, 168 / 255, t),
    lerp(172 / 255, 198 / 255, t),
    lerp(224 / 255, 238 / 255, t),
  ];
}

function outerStarVisual(wallet: string) {
  const hash = hashSeed(wallet.toLowerCase());
  const rng = createRng(hash ^ 0xc0ffee);

  const sizeClass = hash % 3;
  const classPixels = [2.0, 2.5, 3.0] as const;
  const screenPixels = classPixels[sizeClass] * (0.94 + rng() * 0.12);
  const opacity = 0.6 + rng() * 0.2;

  return {
    screenPixels,
    opacity,
    color: coolBlueColor(rng),
    twinklePhase: ((hash % 6283) / 1000) * Math.PI * 2,
    twinkleSpeed: 0.3 + ((hash >> 8) % 1000) / 1000 * 0.55,
  };
}

export function buildOuterHolderStars(
  rankedHolders: RankedHolder[],
): OuterHolderStar[] {
  return rankedHolders.slice(75).map((holder) => {
    const placement = placeOuterHolderStar(holder.address);
    const visual = outerStarVisual(holder.address);

    return {
      id: `outer-${holder.address.toLowerCase()}`,
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
    };
  });
}
