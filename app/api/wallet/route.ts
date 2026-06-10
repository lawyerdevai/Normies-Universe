import { NextResponse } from "next/server";
import {
  fetchWalletData,
  isValidWalletAddress,
} from "@/lib/wallet/fetchWalletData";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams
    .get("address")
    ?.trim()
    .toLowerCase();

  if (!address || !isValidWalletAddress(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  try {
    return NextResponse.json(await fetchWalletData(address));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch wallet data";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
