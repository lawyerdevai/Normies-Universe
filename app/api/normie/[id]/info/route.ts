import { NextResponse } from "next/server";

const NORMIES_API = "https://api.normies.art";
const CACHE_SECONDS = 3600;

type NormieInfoResponse = {
  tokenId: string;
  type: string;
  level: number;
  actionPoints: number;
};

type MetadataAttribute = {
  trait_type?: string;
  value?: string | number;
};

type CanvasInfoResponse = {
  actionPoints?: number;
  level?: number;
};

function parseNormieId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 0 || id > 9999) return null;
  return id;
}

function typeFromMetadata(attributes: MetadataAttribute[]): string | null {
  const typeAttr = attributes.find((attr) => attr.trait_type === "Type");
  if (!typeAttr?.value) return null;
  return String(typeAttr.value);
}

async function fetchFromInfoEndpoint(
  id: number,
): Promise<NormieInfoResponse | null> {
  const res = await fetch(`${NORMIES_API}/normie/${id}/info`, {
    next: { revalidate: CACHE_SECONDS },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as Record<string, unknown>;
  const type = data.type ?? data.normieType;
  const level = Number(data.level);
  const actionPoints = Number(
    data.actionPoints ?? data.action_points ?? data.actionpoints,
  );

  if (typeof type !== "string" || !Number.isFinite(level) || !Number.isFinite(actionPoints)) {
    return null;
  }

  return {
    tokenId: String(id),
    type,
    level,
    actionPoints,
  };
}

async function fetchFromCanvasAndMetadata(
  id: number,
): Promise<NormieInfoResponse | null> {
  const [canvasRes, metadataRes] = await Promise.all([
    fetch(`${NORMIES_API}/normie/${id}/canvas/info`, {
      next: { revalidate: CACHE_SECONDS },
    }),
    fetch(`${NORMIES_API}/normie/${id}/metadata`, {
      next: { revalidate: CACHE_SECONDS },
    }),
  ]);

  if (!canvasRes.ok || !metadataRes.ok) return null;

  const canvas = (await canvasRes.json()) as CanvasInfoResponse;
  const metadata = (await metadataRes.json()) as {
    attributes?: MetadataAttribute[];
  };

  const type = typeFromMetadata(metadata.attributes ?? []);
  const level = Number(canvas.level);
  const actionPoints = Number(canvas.actionPoints);

  if (!type || !Number.isFinite(level) || !Number.isFinite(actionPoints)) {
    return null;
  }

  return {
    tokenId: String(id),
    type,
    level,
    actionPoints,
  };
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
    const direct = await fetchFromInfoEndpoint(id);
    if (direct) return NextResponse.json(direct);

    const composed = await fetchFromCanvasAndMetadata(id);
    if (composed) return NextResponse.json(composed);

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Normie info lookup failed" }, { status: 502 });
  }
}
