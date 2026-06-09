"use client";

import { tierLabel } from "@/lib/universe";
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

  return (
    <div
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-black/65 px-3 py-2.5 shadow-xl backdrop-blur-md"
      style={{ left: position.x, top: position.y - 12 }}
    >
      <p className="text-xs font-medium tracking-wide text-amber-50/90">
        {group.label}
      </p>
      <div className="mt-1.5 space-y-0.5 text-[10px] text-white/50">
        <p>
          Ranks {group.rankStart}–{group.rankEnd}
        </p>
        <p>
          {group.holderCount} holders · {group.totalNormies.toLocaleString()}{" "}
          Normies
        </p>
        <p>{tierLabel(group.tier)} tier</p>
      </div>
    </div>
  );
}
