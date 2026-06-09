import { NextResponse } from "next/server";
import { fetchNormiesHoldersSummary } from "@/lib/opensea/holders";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.OPENSEA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENSEA_API_KEY is not configured" },
      { status: 500 },
    );
  }

  try {
    const summary = await fetchNormiesHoldersSummary(apiKey);
    return NextResponse.json(summary);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch holders";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
