import { NextResponse } from "next/server";
import { fetchOpenSeaAccountUsernames } from "@/lib/opensea/accounts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiKey = process.env.OPENSEA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENSEA_API_KEY is not configured" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const addresses = (body as { addresses?: unknown }).addresses;
  if (!Array.isArray(addresses)) {
    return NextResponse.json(
      { error: "addresses must be an array" },
      { status: 400 },
    );
  }

  try {
    const usernames = await fetchOpenSeaAccountUsernames(
      addresses.slice(0, 50),
      apiKey,
    );

    return NextResponse.json(usernames, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch OpenSea accounts";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
