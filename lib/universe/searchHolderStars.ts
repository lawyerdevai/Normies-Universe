import type { HolderGroupStar, OuterHolderStar } from "@/types/universe";

export type HolderSearchMatch =
  | { kind: "top75"; star: HolderGroupStar }
  | { kind: "outer"; star: OuterHolderStar };

function normalizeWallet(query: string) {
  return query.trim().toLowerCase();
}

function walletMatches(query: string, wallet: string) {
  const normalized = normalizeWallet(query);
  const target = wallet.toLowerCase();
  if (!normalized) return false;
  if (normalized === target) return true;
  if (normalized.startsWith("0x") && target.startsWith(normalized)) return true;
  return false;
}

export function findHolderByWallet(
  query: string,
  holderGroups: HolderGroupStar[],
  outerStars: OuterHolderStar[],
): HolderSearchMatch | null {
  const normalized = normalizeWallet(query);
  if (!normalized) return null;

  const top = holderGroups.find(
    (star) => star.wallet && walletMatches(normalized, star.wallet),
  );
  if (top) return { kind: "top75", star: top };

  const outer = outerStars.find((star) => walletMatches(normalized, star.wallet));
  if (outer) return { kind: "outer", star: outer };

  return null;
}
