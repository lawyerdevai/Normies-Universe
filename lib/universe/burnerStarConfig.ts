export const BURNER_TIER1_COLOR = "#FF8C00";
export const BURNER_TIER2_COLOR = "#FFD700";

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
