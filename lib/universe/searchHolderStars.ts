import type { HolderGroupStar, OuterHolderStar } from "@/types/universe";
import { normalizeWalletAddress } from "./normalizeWalletAddress";

export { normalizeWalletAddress } from "./normalizeWalletAddress";

export type HolderSearchMatch =
  | { kind: "top75"; star: HolderGroupStar }
  | { kind: "outer"; star: OuterHolderStar };

function walletKey(wallet: string | undefined): string | null {
  if (!wallet) return null;
  const key = normalizeWalletAddress(wallet);
  return key.length > 0 ? key : null;
}

function walletMatchesQuery(queryKey: string, starKey: string): boolean {
  if (queryKey === starKey) return true;
  if (queryKey.startsWith("0x") && starKey.startsWith(queryKey)) return true;
  return false;
}

export function findHolderByWallet(
  query: string,
  holderGroups: HolderGroupStar[],
  outerStars: OuterHolderStar[],
): HolderSearchMatch | null {
  const queryKey = normalizeWalletAddress(query);
  if (!queryKey) return null;

  for (const star of holderGroups) {
    const key = walletKey(star.wallet ?? star.id);
    if (key && walletMatchesQuery(queryKey, key)) {
      return { kind: "top75", star };
    }
  }

  for (const star of outerStars) {
    const key = walletKey(star.wallet ?? star.id);
    if (key && walletMatchesQuery(queryKey, key)) {
      return { kind: "outer", star };
    }
  }

  return null;
}
