import { NextResponse } from "next/server";

const NORMIES_API = "https://api.normies.art";
const CACHE_SECONDS = 3600;

type OwnerResponse = {
  tokenId?: string;
  owner?: string;
};

type BurnedResponse = {
  tokenId?: string | number;
  timestamp?: number | string;
  commitment?: {
    timestamp?: number | string;
  };
};

function parseNormieId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 0 || id > 9999) return null;
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = parseNormieId(rawId);

  if (id === null) {
    return NextResponse.json({ error: "Invalid Normie ID" }, { status: 400 });
  }

  try {
    const ownerRes = await fetch(`${NORMIES_API}/normie/${id}/owner`, {
      next: { revalidate: CACHE_SECONDS },
    });

    if (ownerRes.ok) {
      const data = (await ownerRes.json()) as OwnerResponse;
      if (data.owner) {
        return NextResponse.json({
          status: "owned" as const,
          tokenId: String(id),
          owner: data.owner,
        });
      }
    }
  } catch {
    // Fall through to burned lookup.
  }

  const burnedRes = await fetch(`${NORMIES_API}/history/burned/${id}`, {
    next: { revalidate: CACHE_SECONDS },
  });

  if (burnedRes.ok) {
    const burned = (await burnedRes.json()) as BurnedResponse;
    const rawTimestamp =
      burned.commitment?.timestamp ?? burned.timestamp;
    const burnedAt = Number(rawTimestamp);

    return NextResponse.json({
      status: "burned" as const,
      tokenId: String(burned.tokenId ?? id),
      burnedAt: Number.isFinite(burnedAt) ? burnedAt : 0,
    });
  }

  if (burnedRes.status === 404) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await burnedRes.text();
  return NextResponse.json(
    { error: `Burn history lookup failed (${burnedRes.status}): ${body}` },
    { status: 502 },
  );
}
