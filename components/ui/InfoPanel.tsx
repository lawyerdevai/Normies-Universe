"use client";

import type { HolderGroupStar } from "@/types/universe";

interface InfoPanelProps {
  group: HolderGroupStar | null;
  onBack: () => void;
}

export default function InfoPanel({ group, onBack }: InfoPanelProps) {
  if (!group) return null;

  return (
    <div className="pointer-events-auto fixed right-6 top-1/2 z-40 w-72 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/55 p-5 shadow-2xl backdrop-blur-xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white/80"
      >
        <span aria-hidden>←</span> Back to universe
      </button>

      <h2 className="text-lg font-medium tracking-tight text-amber-50">
        {group.walletDisplay ?? group.label}
      </h2>
      <p className="mt-1 text-xs text-violet-300/70">
        Rank #{group.collectionRank ?? group.rankStart}
      </p>

      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between border-b border-white/5 pb-2">
          <dt className="text-white/40">Normies held</dt>
          <dd className="text-white/80">
            {group.totalNormies.toLocaleString()}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-white/40">Distance</dt>
          <dd className="text-white/80">
            {group.distanceFromCenter.toFixed(1)} ly
          </dd>
        </div>
      </dl>
    </div>
  );
}
