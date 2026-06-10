import { NextResponse } from "next/server";

const NORMIES_API = "https://api.normies.art";
const OPENSEA_BASE = "https://api.opensea.io/api/v2";
const NORMIES_CONTRACT = "0x9Eb6E2025B64f340691e424b7fe7022fFDE12438";
const CHAIN = "ethereum";
const CACHE_SECONDS = 3600;

type StatsResponse = {
  totalBurnedTokens?: number | string;
};

type BurnCommitment = {
  tokenCount?: number | string;
  timestamp?: number | string;
};

type BurnedToken = {
  tokenId?: string | number;
  timestamp?: number | string;
};

type OpenSeaContract = {
  collection: string;
};

type OpenSeaStats = {
  total?: {
    floor_price?: number;
  };
};

async function normiesFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${NORMIES_API}${path}`, {
    next: { revalidate: CACHE_SECONDS },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Normies ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function openseaFetch<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${OPENSEA_BASE}${path}`, {
    headers: {
      accept: "application/json",
      "x-api-key": apiKey,
    },
    next: { revalidate: CACHE_SECONDS },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenSea ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function fetchTotalBurned(): Promise<number> {
  try {
    const stats = await normiesFetch<StatsResponse>("/history/stats");
    const total = Number(stats.totalBurnedTokens);
    return Number.isFinite(total) && total >= 0 ? total : 0;
  } catch {
    return 0;
  }
}

async function fetchLargestBurn(): Promise<{ count: number; timestamp: number }> {
  try {
    const commits = await normiesFetch<BurnCommitment[]>(
      "/history/burns?limit=100",
    );
    if (!Array.isArray(commits) || commits.length === 0) {
      return { count: 0, timestamp: 0 };
    }

    let best = { count: 0, timestamp: 0 };
    for (const commit of commits) {
      const count = Number(commit.tokenCount);
      const timestamp = Number(commit.timestamp);
      if (!Number.isFinite(count) || count <= best.count) continue;
      best = {
        count,
        timestamp: Number.isFinite(timestamp) ? timestamp : 0,
      };
    }
    return best;
  } catch {
    return { count: 0, timestamp: 0 };
  }
}

async function fetchRecentBurns(): Promise<{ tokenId: string; timestamp: number }[]> {
  try {
    const tokens = await normiesFetch<BurnedToken[]>(
      "/history/burned-tokens?limit=20",
    );
    if (!Array.isArray(tokens)) return [];

    return tokens.map((token) => {
      const timestamp = Number(token.timestamp);
      return {
        tokenId: String(token.tokenId ?? ""),
        timestamp: Number.isFinite(timestamp) ? timestamp : 0,
      };
    }).filter((t) => t.tokenId.length > 0);
  } catch {
    return [];
  }
}

async function fetchFloorEth(apiKey: string): Promise<number> {
  try {
    const contract = await openseaFetch<OpenSeaContract>(
      `/chain/${CHAIN}/contract/${NORMIES_CONTRACT}`,
      apiKey,
    );
    const stats = await openseaFetch<OpenSeaStats>(
      `/collections/${contract.collection}/stats`,
      apiKey,
    );
    const floor = Number(stats.total?.floor_price);
    return Number.isFinite(floor) && floor >= 0 ? floor : 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const apiKey = process.env.OPENSEA_API_KEY;

  const [totalBurned, largestBurn, recentBurns, floorEth] = await Promise.all([
    fetchTotalBurned(),
    fetchLargestBurn(),
    fetchRecentBurns(),
    apiKey ? fetchFloorEth(apiKey) : Promise.resolve(0),
  ]);

  return NextResponse.json({
    totalBurned,
    floorEth,
    largestBurn,
    recentBurns,
  });
}
