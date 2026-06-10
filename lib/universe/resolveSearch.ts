import type { HolderGroupStar, LocatorTarget, OuterHolderStar } from "@/types/universe";
import { visualFromHoldings, normieRangeFromStars } from "./holderStarVisual";
import { findHolderByWallet } from "./searchHolderStars";

export type ParsedSearchQuery =
  | { type: "wallet"; address: string }
  | { type: "normieId"; id: number }
  | { type: "invalid" };

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const trimmed = query.trim();
  if (!trimmed) return { type: "invalid" };

  const normieMatch = trimmed.match(/^#?(\d{1,4})$/);
  if (normieMatch) {
    const id = Number.parseInt(normieMatch[1], 10);
    if (id >= 0 && id <= 9999) return { type: "normieId", id };
  }

  if (/^0x[a-fA-F0-9]+$/i.test(trimmed)) {
    return { type: "wallet", address: trimmed };
  }

  return { type: "invalid" };
}

/** Mid-tier holder star screen-pixel target for outer sky locator enlargement. */
export const OUTER_LOCATOR_SCREEN_PX = 10;
export const TOP75_LOCATOR_SCALE = 1.5;

export function locatorFromHolderMatch(
  match: ReturnType<typeof findHolderByWallet>,
  holderGroups: HolderGroupStar[],
): LocatorTarget | null {
  if (!match) return null;

  if (match.kind === "top75") {
    const star = match.star;
    const normieRange = normieRangeFromStars(holderGroups);
    const rank = star.collectionRank ?? star.rankStart;
    const visual = visualFromHoldings(
      star.totalNormies,
      normieRange?.min ?? 1,
      normieRange?.max ?? star.totalNormies,
      rank,
    );

    return {
      kind: "holder",
      starKind: "top75",
      wallet: star.wallet ?? star.id,
      walletDisplay: star.walletDisplay ?? star.label,
      normieCount: star.totalNormies,
      rank: star.collectionRank ?? star.rankStart,
      position: star.position,
      baseCoreSize: visual.coreSize,
      baseGlowSize: visual.glowSize,
      baseGlowOpacity: visual.glowOpacity,
      color: star.color,
    };
  }

  const star = match.star;
  return {
    kind: "holder",
    starKind: "outer",
    wallet: star.wallet,
    walletDisplay: star.walletDisplay,
    normieCount: star.normieCount,
    rank: star.collectionRank,
    position: star.position,
    baseScreenPixels: star.screenPixels,
    color: `rgb(${Math.round(star.color[0] * 255)}, ${Math.round(star.color[1] * 255)}, ${Math.round(star.color[2] * 255)})`,
  };
}

export function locatorLabelText(target: LocatorTarget): string {
  if (target.kind === "pyre") return target.label;
  const count = target.normieCount.toLocaleString();
  return `${target.walletDisplay} · ${count} Normies`;
}
