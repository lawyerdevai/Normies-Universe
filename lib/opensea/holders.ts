const OPENSEA_BASE = "https://api.opensea.io/api/v2";
const NORMIES_CONTRACT = "0x9Eb6E2025B64f340691e424b7fe7022fFDE12438";
const CHAIN = "ethereum";

export type HolderDistribution = {
  "100plus": number;
  "50to99": number;
  "20to49": number;
  "10to19": number;
  "5to9": number;
  "3to4": number;
  "2": number;
  "1": number;
};

export type RankedHolder = {
  address: string;
  count: number;
  rank: number;
};

export type HoldersSummary = {
  totalHolders: number;
  distribution: HolderDistribution;
  top20: { wallet: string; count: number }[];
  rankedHolders: RankedHolder[];
};

type OpenSeaHolder = {
  address: string;
  quantity: number;
  percentage: number;
};

type OpenSeaHoldersPage = {
  holders: OpenSeaHolder[];
  next?: string;
};

type OpenSeaContract = {
  collection: string;
};

function emptyDistribution(): HolderDistribution {
  return {
    "100plus": 0,
    "50to99": 0,
    "20to49": 0,
    "10to19": 0,
    "5to9": 0,
    "3to4": 0,
    "2": 0,
    "1": 0,
  };
}

export function bucketHolderCount(count: number): keyof HolderDistribution {
  if (count >= 100) return "100plus";
  if (count >= 50) return "50to99";
  if (count >= 20) return "20to49";
  if (count >= 10) return "10to19";
  if (count >= 5) return "5to9";
  if (count >= 3) return "3to4";
  if (count === 2) return "2";
  return "1";
}

export function truncateWallet(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function openseaFetch<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${OPENSEA_BASE}${path}`, {
    headers: {
      accept: "application/json",
      "x-api-key": apiKey,
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenSea ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

async function resolveCollectionSlug(apiKey: string): Promise<string> {
  const contract = await openseaFetch<OpenSeaContract>(
    `/chain/${CHAIN}/contract/${NORMIES_CONTRACT}`,
    apiKey,
  );
  return contract.collection;
}

async function fetchAllHolders(
  slug: string,
  apiKey: string,
): Promise<OpenSeaHolder[]> {
  const holders: OpenSeaHolder[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      limit: "100",
      sort_direction: "desc",
    });
    if (cursor) params.set("cursor", cursor);

    const page = await openseaFetch<OpenSeaHoldersPage>(
      `/collections/${slug}/holders?${params}`,
      apiKey,
    );

    holders.push(...page.holders);
    cursor = page.next;
  } while (cursor);

  return holders;
}

export async function fetchNormiesHoldersSummary(
  apiKey: string,
): Promise<HoldersSummary> {
  const slug = await resolveCollectionSlug(apiKey);
  const holders = await fetchAllHolders(slug, apiKey);

  const distribution = emptyDistribution();
  for (const holder of holders) {
    distribution[bucketHolderCount(holder.quantity)] += 1;
  }

  const rankedHolders = holders.map((holder, index) => ({
    address: holder.address,
    count: holder.quantity,
    rank: index + 1,
  }));

  const top20 = rankedHolders.slice(0, 20).map((holder) => ({
    wallet: truncateWallet(holder.address),
    count: holder.count,
  }));

  return {
    totalHolders: holders.length,
    distribution,
    top20,
    rankedHolders,
  };
}
