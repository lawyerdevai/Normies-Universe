import { NextResponse } from "next/server";

const NORMIES_API = "https://api.normies.art";
const CACHE_SECONDS = 3600;

type ReceiverCommit = {
  commitId?: string | number;
};

type BurnedTokenEntry = {
  tokenId?: string | number;
};

type BurnCommitDetail = {
  burnedTokens?: Array<BurnedTokenEntry | number>;
};

function parseNormieId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 0 || id > 9999) return null;
  return id;
}

function parseBurnedTokenId(entry: BurnedTokenEntry | number): number | null {
  const raw = typeof entry === "number" ? entry : entry.tokenId;
  const id = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(id) || id < 0 || id > 9999) return null;
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const tokenId = parseNormieId(rawId);

  if (tokenId === null) {
    return NextResponse.json({ error: "Invalid Normie ID" }, { status: 400 });
  }

  try {
    const receiverRes = await fetch(
      `${NORMIES_API}/history/burns/receiver/${tokenId}`,
      { next: { revalidate: CACHE_SECONDS } },
    );

    if (!receiverRes.ok) {
      if (receiverRes.status === 404) {
        return NextResponse.json({
          tokenId: String(tokenId),
          absorbedTokenIds: [],
          totalAbsorbed: 0,
        });
      }
      const body = await receiverRes.text();
      return NextResponse.json(
        { error: `Receiver burn lookup failed (${receiverRes.status}): ${body}` },
        { status: 502 },
      );
    }

    const commits = (await receiverRes.json()) as ReceiverCommit[];
    if (!Array.isArray(commits) || commits.length === 0) {
      return NextResponse.json({
        tokenId: String(tokenId),
        absorbedTokenIds: [],
        totalAbsorbed: 0,
      });
    }

    const commitIds = commits
      .map((commit) => String(commit.commitId ?? "").trim())
      .filter(Boolean);

    if (commitIds.length === 0) {
      return NextResponse.json({
        tokenId: String(tokenId),
        absorbedTokenIds: [],
        totalAbsorbed: 0,
      });
    }

    const details = await Promise.all(
      commitIds.map(async (commitId) => {
        const res = await fetch(`${NORMIES_API}/history/burns/${commitId}`, {
          next: { revalidate: CACHE_SECONDS },
        });
        if (!res.ok) return null;
        return res.json() as Promise<BurnCommitDetail>;
      }),
    );

    const absorbed = new Set<number>();
    for (const detail of details) {
      if (!detail?.burnedTokens) continue;
      for (const entry of detail.burnedTokens) {
        const burnedId = parseBurnedTokenId(entry);
        if (burnedId !== null) absorbed.add(burnedId);
      }
    }

    const absorbedTokenIds = [...absorbed].sort((a, b) => a - b);

    return NextResponse.json({
      tokenId: String(tokenId),
      absorbedTokenIds,
      totalAbsorbed: absorbedTokenIds.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Absorbed burn lookup failed" },
      { status: 502 },
    );
  }
}
