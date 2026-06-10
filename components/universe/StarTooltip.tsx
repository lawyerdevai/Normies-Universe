"use client";

import type { BurnerStar, HolderGroupStar } from "@/types/universe";

interface StarTooltipProps {
  group: HolderGroupStar | null;
  burnerStar: BurnerStar | null;
  showCore: boolean;
  position: { x: number; y: number } | null;
  totalBurned?: number | null;
}

export default function StarTooltip({
  group,
  burnerStar,
  showCore,
  position,
  totalBurned = null,
}: StarTooltipProps) {
  if (!position || (!group && !burnerStar && !showCore)) return null;

  if (showCore && !group) {
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

  if (burnerStar) {
    return (
      <div
        className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-black/65 px-3 py-2.5 shadow-xl backdrop-blur-md"
        style={{ left: position.x, top: position.y - 12 }}
      >
        <p className="text-xs font-medium tracking-wide text-amber-50/90">
          🔥 {burnerStar.walletDisplay} ·{" "}
          {burnerStar.burnedCount.toLocaleString()} Normies burned
        </p>
      </div>
    );
  }

  if (!group) return null;

  const rank = group.collectionRank ?? group.rankStart;
  const wallet = group.walletDisplay ?? group.label;

  if (group.burnedCount) {
    return (
      <div
        className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-black/65 px-3 py-2.5 shadow-xl backdrop-blur-md"
        style={{ left: position.x, top: position.y - 12 }}
      >
        <p className="text-xs font-medium tracking-wide text-amber-50/90">
          🔥 {wallet} · {group.burnedCount.toLocaleString()} Normies burned
        </p>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-black/65 px-3 py-2.5 shadow-xl backdrop-blur-md"
      style={{ left: position.x, top: position.y - 12 }}
    >
      <p className="text-xs font-medium tracking-wide text-amber-50/90">
        #{rank} · {wallet} · {group.totalNormies.toLocaleString()} Normies
      </p>
    </div>
  );
}
