import { NextResponse } from "next/server";
import { truncateWallet } from "@/lib/opensea/holders";
import { fetchOpenSeaAccountUsernames } from "@/lib/opensea/accounts";
import {
  fetchRecursiveBurnHolders,
  RECURSIVE_BURN_CACHE_SECONDS,
} from "@/lib/recursiveBurn/fetchRecursiveBurnHolders";

export async function GET() {
  try {
    const apiKey = process.env.OPENSEA_API_KEY;

    if (!apiKey) {
      throw new Error("OPENSEA_API_KEY is not configured");
    }

    const holders = await fetchRecursiveBurnHolders(50);
    const addresses = holders.items.map((item) => item.wallet);
    const usernames = await fetchOpenSeaAccountUsernames(addresses, apiKey);

    const items = holders.items.map((item, index) => ({
      rank: index + 1,
      wallet: item.wallet,
      walletDisplay: truncateWallet(item.wallet),
      username: usernames[item.wallet] ?? null,
      totalRecursiveBurnCount: item.totalRecursiveBurnCount,
    }));

    return NextResponse.json(
      {
        updatedAt: holders.updatedAt,
        totalWallets: holders.totalWallets,
        items,
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${RECURSIVE_BURN_CACHE_SECONDS}, stale-while-revalidate=60`,
        },
      },
    );
  } catch (error) {
    console.error("[recursive-burn-leaderboard]", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch recursive burn leaderboard";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
