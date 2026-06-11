import { NextResponse } from "next/server";
import { fetchBurnersData } from "@/lib/universe/fetchBurnersData";

export async function GET() {
  try {
    const summary = await fetchBurnersData();
    return NextResponse.json(summary);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch burner data";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
