"use client";

import type { HolderGroupStar } from "@/types/universe";

interface StarTooltipProps {
  group: HolderGroupStar | null;
  showCore: boolean;
  position: { x: number; y: number } | null;
}

export default function StarTooltip({
  group,
  showCore,
  position,
}: StarTooltipProps) {
  if (!position || (!group && !showCore)) return null;

  if (showCore && !group) {
    return (
      <div
        className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-black/65 px-3 py-2 shadow-xl backdrop-blur-md"
        style={{ left: position.x, top: position.y - 12 }}
      >
        <p className="text-xs font-medium text-amber-50/90">
          The Pyre · 1,839 Normies burned
        </p>
      </div>
    );
  }

  if (!group) return null;

  const rank = group.collectionRank ?? group.rankStart;
  const wallet = group.walletDisplay ?? group.label;

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
