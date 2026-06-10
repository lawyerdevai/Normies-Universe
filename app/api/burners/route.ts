import { NextResponse } from "next/server";

const NORMIES_API = "https://api.normies.art";
const CACHE_SECONDS = 3600;
const PAGE_LIMIT = 100;

type BurnCommitment = {
  owner?: string;
  tokenCount?: number | string;
};

type DistributionBucket =
  | "1"
  | "2-5"
  | "6-10"
  | "11-20"
  | "21-50"
  | "50+";

type Distribution = Record<DistributionBucket, number>;

function emptyDistribution(): Distribution {
  return {
    "1": 0,
    "2-5": 0,
    "6-10": 0,
    "11-20": 0,
    "21-50": 0,
    "50+": 0,
  };
}

function bucketForTotal(total: number): DistributionBucket {
  if (total === 1) return "1";
  if (total <= 5) return "2-5";
  if (total <= 10) return "6-10";
  if (total <= 20) return "11-20";
  if (total <= 50) return "21-50";
  return "50+";
}

async function fetchAllBurnCommitments(): Promise<BurnCommitment[]> {
  const all: BurnCommitment[] = [];
  let offset = 0;

  while (true) {
    const res = await fetch(
      `${NORMIES_API}/history/burns?limit=${PAGE_LIMIT}&offset=${offset}`,
      { next: { revalidate: CACHE_SECONDS } },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Normies burns ${res.status}: ${body}`);
    }

    const page = (await res.json()) as BurnCommitment[];
    if (!Array.isArray(page) || page.length === 0) break;

    all.push(...page);
    if (page.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }

  return all;
}

function aggregateBurners(commits: BurnCommitment[]) {
  const totals = new Map<string, number>();

  for (const commit of commits) {
    const owner = commit.owner?.trim().toLowerCase();
    const count = Number(commit.tokenCount);
    if (!owner || !/^0x[a-f0-9]{40}$/.test(owner)) continue;
    if (!Number.isFinite(count) || count <= 0) continue;
    totals.set(owner, (totals.get(owner) ?? 0) + count);
  }

  const distribution = emptyDistribution();
  for (const total of totals.values()) {
    distribution[bucketForTotal(total)] += 1;
  }

  const top20 = [...totals.entries()]
    .map(([address, burnedCount]) => ({ address, burnedCount }))
    .sort((a, b) => b.burnedCount - a.burnedCount)
    .slice(0, 20);

  const burners = [...totals.entries()]
    .filter(([, burnedCount]) => burnedCount >= 11)
    .map(([address, burnedCount]) => ({
      address,
      burnedCount,
      tier: (burnedCount >= 50 ? 1 : 2) as 1 | 2,
    }))
    .sort((a, b) => b.burnedCount - a.burnedCount);

  return {
    totalBurners: totals.size,
    distribution,
    top20,
    burners,
  };
}

export async function GET() {
  try {
    const commits = await fetchAllBurnCommitments();
    const summary = aggregateBurners(commits);

    return NextResponse.json(summary);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch burner data";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
