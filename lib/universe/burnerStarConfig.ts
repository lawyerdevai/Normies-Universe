export const BURNER_TIER1_COLOR = "#FF6B00";
/** ~20% less saturation/brightness than prior tier 2 — dark cooling ember. */
export const BURNER_TIER2_COLOR = "#8F2E12";

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
