import { truncateWallet } from "@/lib/opensea/holders";
import type { RankedHolder } from "@/lib/opensea/holders";
import type { BurnerStar, HolderGroupStar, OuterHolderStar } from "@/types/universe";
import {
  burnerColor,
  type BurnerWalletEntry,
} from "./burnerStarConfig";
import { visualFromHoldings } from "./holderStarVisual";
import { normalizeWalletAddress } from "./normalizeWalletAddress";
import { placeBurnerStar } from "./placeBurnerStar";

function burnerVisual(tier: 1 | 2) {
  if (tier === 1) {
    const visual = visualFromHoldings(40, 1, 100, 35);
    return {
      ...visual,
      glowOpacity: visual.glowOpacity * 1.15,
      brightness: visual.brightness * 1.08,
    };
  }

  const visual = visualFromHoldings(30, 1, 100, 55);
  return {
    ...visual,
    glowOpacity: visual.glowOpacity * 0.85,
    brightness: visual.brightness * 0.95,
  };
}

export function top75WalletSet(groups: HolderGroupStar[]) {
  const set = new Set<string>();
  for (const group of groups) {
    if (group.collectionRank === undefined) continue;
    const wallet = normalizeWalletAddress(group.wallet ?? group.id);
    if (wallet) set.add(wallet);
  }
  return set;
}

export function applyBurnerColorsToTop75(
  groups: HolderGroupStar[],
  burners: BurnerWalletEntry[],
): HolderGroupStar[] {
  const burnerByWallet = new Map(
    burners.map((b) => [normalizeWalletAddress(b.address), b]),
  );

  return groups.map((group) => {
    const wallet = normalizeWalletAddress(group.wallet ?? group.id);
    const burner = burnerByWallet.get(wallet);
    if (!burner || group.collectionRank === undefined) return group;

    return {
      ...group,
      color: burnerColor(burner.tier),
      burnedCount: burner.burnedCount,
      burnerTier: burner.tier,
    };
  });
}

export function filterBurnersFromOuterStars(
  outerStars: OuterHolderStar[],
  burners: BurnerWalletEntry[],
): OuterHolderStar[] {
  const burnerWallets = new Set(
    burners.map((b) => normalizeWalletAddress(b.address)),
  );

  return outerStars.filter(
    (star) => !burnerWallets.has(normalizeWalletAddress(star.wallet ?? star.id)),
  );
}

export function buildDedicatedBurnerStars(
  burners: BurnerWalletEntry[],
  top75Wallets: Set<string>,
  rankedHolders: RankedHolder[],
): BurnerStar[] {
  const holderByWallet = new Map(
    rankedHolders.map((h) => [normalizeWalletAddress(h.address), h]),
  );
  const nonTop75 = burners.filter(
    (b) => !top75Wallets.has(normalizeWalletAddress(b.address)),
  );

  const quadrantCounts: [number, number, number, number] = [0, 0, 0, 0];
  const total = nonTop75.length;

  return nonTop75.map((burner) => {
    const wallet = normalizeWalletAddress(burner.address);
    const holder = holderByWallet.get(wallet);
    const placement = placeBurnerStar(wallet, quadrantCounts, total);
    const visual = burnerVisual(burner.tier);

    return {
      id: `burner-${wallet}`,
      wallet,
      walletDisplay: truncateWallet(wallet),
      burnedCount: burner.burnedCount,
      tier: burner.tier,
      normieCount: holder?.count ?? 0,
      collectionRank: holder?.rank,
      position: placement.position,
      color: burnerColor(burner.tier),
      coreSize: visual.coreSize,
      glowSize: visual.glowSize,
      glowOpacity: visual.glowOpacity,
      sparkle: visual.sparkle,
      brightness: visual.brightness,
    };
  });
}
