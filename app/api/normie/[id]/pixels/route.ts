import { NextResponse } from "next/server";

const NORMIES_API = "https://api.normies.art";
const CACHE_SECONDS = 86_400;

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
    const res = await fetch(`${NORMIES_API}/normie/${id}/pixels`, {
      next: { revalidate: CACHE_SECONDS },
    });

    if (res.status === 404) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Pixel lookup failed (${res.status}): ${body}` },
        { status: 502 },
      );
    }

    const pixels = (await res.text()).trim();

    if (pixels.length !== 1600 || !/^[01]+$/.test(pixels)) {
      return NextResponse.json(
        { error: "Invalid pixel data from upstream" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      tokenId: String(id),
      pixels,
    });
  } catch {
    return NextResponse.json(
      { error: "Pixel lookup failed" },
      { status: 502 },
    );
  }
}
