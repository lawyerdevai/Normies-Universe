const RECURSIVE_BURN_API =
  "https://rarity.normies.art/api/recursive-burn-holders";

export const RECURSIVE_BURN_CACHE_SECONDS = 300;

export type RecursiveBurnHolderItem = {
  wallet: string;
  totalRecursiveBurnCount: number;
};

export type RecursiveBurnHoldersResponse = {
  updatedAt: string;
  totalWallets: number;
  items: RecursiveBurnHolderItem[];
};

export async function fetchRecursiveBurnHolders(
  limit = 50,
): Promise<RecursiveBurnHoldersResponse> {
  const res = await fetch(`${RECURSIVE_BURN_API}?limit=${limit}`, {
    next: { revalidate: RECURSIVE_BURN_CACHE_SECONDS },
  });

  if (!res.ok) {
    throw new Error(
      `Recursive burn holders request failed (${res.status})`,
    );
  }

  const data = (await res.json()) as RecursiveBurnHoldersResponse;

  if (!Array.isArray(data.items)) {
    throw new Error("Invalid recursive burn holders response");
  }

  return {
    updatedAt: data.updatedAt ?? "",
    totalWallets:
      typeof data.totalWallets === "number" ? data.totalWallets : data.items.length,
    items: data.items.map((item) => ({
      wallet: item.wallet.trim().toLowerCase(),
      totalRecursiveBurnCount: item.totalRecursiveBurnCount,
    })),
  };
}
