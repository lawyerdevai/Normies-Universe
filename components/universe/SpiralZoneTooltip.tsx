"use client";

import { SPIRAL_ZONES, type SpiralZoneKey } from "@/lib/universe/spiralZones";

interface SpiralZoneTooltipProps {
  zone: SpiralZoneKey | null;
  position: { x: number; y: number } | null;
}

export default function SpiralZoneTooltip({
  zone,
  position,
}: SpiralZoneTooltipProps) {
  if (!zone || !position) return null;

  const spec = SPIRAL_ZONES.find((z) => z.key === zone);
  if (!spec) return null;

  return (
    <div
      className="pointer-events-none fixed z-40 -translate-x-1/2 rounded-lg border border-white/8 bg-black/55 px-3 py-2 shadow-lg backdrop-blur-sm"
      style={{ left: position.x, top: position.y - 14, transform: "translateX(-50%) translateY(-100%)" }}
    >
      <p className="text-[10px] text-white/50">{spec.label}</p>
    </div>
  );
}
