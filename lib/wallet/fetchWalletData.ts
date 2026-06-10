const NORMIES_API = "https://api.normies.art";
const CACHE_SECONDS = 3600;

type HolderResponse = {
  address?: string;
  tokenIds?: string[];
};

type BurnCommitment = {
  tokenCount?: number | string;
};

export function isValidWalletAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function fetchHolderTokenIds(address: string): Promise<string[]> {
  const res = await fetch(`${NORMIES_API}/holders/${address}`, {
    next: { revalidate: CACHE_SECONDS },
  });

  if (res.status === 404) return [];

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Normies holders ${res.status}: ${body}`);
  }

  const data = (await res.json()) as HolderResponse;
  return data.tokenIds ?? [];
}

async function fetchBurnedCount(address: string): Promise<number> {
  try {
    let total = 0;
    let offset = 0;
    const limit = 100;

    while (true) {
      const res = await fetch(
        `${NORMIES_API}/history/burns/address/${address}?limit=${limit}&offset=${offset}`,
        { next: { revalidate: CACHE_SECONDS } },
      );

      if (!res.ok) return 0;

      const commits = (await res.json()) as BurnCommitment[];
      if (!Array.isArray(commits) || commits.length === 0) break;

      for (const commit of commits) {
        const count = Number(commit.tokenCount);
        if (Number.isFinite(count) && count > 0) total += count;
      }

      if (commits.length < limit) break;
      offset += limit;
    }

    return total;
  } catch {
    return 0;
  }
}

export async function fetchWalletData(address: string) {
  const [tokenIds, burnedCount] = await Promise.all([
    fetchHolderTokenIds(address),
    fetchBurnedCount(address),
  ]);

  return { address, tokenIds, burnedCount };
}
