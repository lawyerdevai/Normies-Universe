/** Set to false when zombie competition ends */
export const ZOMBIE_TIER_ACTIVE = true;

export const BURNER_TIER1_COLOR = "#FF6B00";
/** ~20% less saturation/brightness than prior tier 2 — dark cooling ember. */
export const BURNER_TIER2_COLOR = "#8F2E12";
/** Muted zombie green for top burners — eerie, not neon. */
export const BURNER_ZOMBIE_COLOR = "#5a8a5e";

const ZOMBIE_TIER_COUNT = 21;

export type BurnerWalletEntry = {
  address: string;
  burnedCount: number;
  tier: 1 | 2;
};

export type BurnersApiResponse = {
  totalBurners: number;
  distribution: Record<string, number>;
  top20: { address: string; burnedCount: number }[];
  burners: BurnerWalletEntry[];
};

export function burnerColor(tier: 1 | 2) {
  return tier === 1 ? BURNER_TIER1_COLOR : BURNER_TIER2_COLOR;
}

export function zombieWalletSet(burners: BurnerWalletEntry[]): Set<string> {
  if (!ZOMBIE_TIER_ACTIVE || burners.length === 0) return new Set();

  const sorted = [...burners].sort((a, b) => b.burnedCount - a.burnedCount);
  return new Set(
    sorted
      .slice(0, ZOMBIE_TIER_COUNT)
      .map((burner) => burner.address.trim().toLowerCase()),
  );
}

export function resolveBurnerStarColor(
  wallet: string,
  tier: 1 | 2,
  zombies: Set<string>,
): string {
  if (ZOMBIE_TIER_ACTIVE && zombies.has(wallet.trim().toLowerCase())) {
    return BURNER_ZOMBIE_COLOR;
  }
  return burnerColor(tier);
}
