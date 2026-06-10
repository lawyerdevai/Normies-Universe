"use client";

import type { BurnerStar, HolderGroupStar } from "@/types/universe";

const BURNED_ORANGE = "#FF6B00";

interface StarTooltipProps {
  group: HolderGroupStar | null;
  burnerStar: BurnerStar | null;
  showCore: boolean;
  position: { x: number; y: number } | null;
  totalBurned?: number | null;
}

function BurnedSuffix({ count }: { count: number }) {
  return (
    <>
      {" · "}
      <span style={{ color: BURNED_ORANGE }}>
        {count.toLocaleString()} Burned
      </span>
    </>
  );
}

function RankedHolderTooltip({ group }: { group: HolderGroupStar }) {
  const rank = group.collectionRank ?? group.rankStart;
  const wallet = group.walletDisplay ?? group.label;
  const normies = group.totalNormies.toLocaleString();

  return (
    <p className="text-xs font-medium tracking-wide text-amber-50/90">
      #{rank} · {wallet} · {normies} Normies
      {group.burnedCount ? <BurnedSuffix count={group.burnedCount} /> : null}
    </p>
  );
}

function BurnerStarTooltip({ star }: { star: BurnerStar }) {
  const wallet = star.walletDisplay;

  if (star.collectionRank !== undefined) {
    return (
      <p className="text-xs font-medium tracking-wide text-amber-50/90">
        #{star.collectionRank} · {wallet} · {star.normieCount.toLocaleString()}{" "}
        Normies
        <BurnedSuffix count={star.burnedCount} />
      </p>
    );
  }

  return (
    <p className="text-xs font-medium tracking-wide text-amber-50/90">
      {wallet}
      <BurnedSuffix count={star.burnedCount} />
    </p>
  );
}

export default function StarTooltip({
  group,
  burnerStar,
  showCore,
  position,
  totalBurned = null,
}: StarTooltipProps) {
  if (!position || (!group && !burnerStar && !showCore)) return null;

  if (showCore && !group && !burnerStar) {
    return (
      <div
        className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-black/65 px-3 py-2 shadow-xl backdrop-blur-md"
        style={{ left: position.x, top: position.y - 12 }}
      >
        <p className="text-xs font-medium text-amber-50/90">
          {totalBurned != null
            ? `The Pyre · ${totalBurned.toLocaleString()} Normies burned`
            : "The Pyre"}
        </p>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-black/65 px-3 py-2.5 shadow-xl backdrop-blur-md"
      style={{ left: position.x, top: position.y - 12 }}
    >
      {burnerStar ? (
        <BurnerStarTooltip star={burnerStar} />
      ) : group ? (
        <RankedHolderTooltip group={group} />
      ) : null}
    </div>
  );
}
