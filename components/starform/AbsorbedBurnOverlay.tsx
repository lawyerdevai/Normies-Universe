"use client";

import { burnedNormieImageUrl } from "@/lib/starform/generateAbsorbedBurnStars";
import type { AbsorbedHoverPayload } from "@/components/starform/AbsorbedBurnStars";

interface AbsorbedBurnOverlayProps {
  receiverTokenId: number;
  hover: AbsorbedHoverPayload | null;
  selectedTokenId: number | null;
  onClose: () => void;
}

export default function AbsorbedBurnOverlay({
  receiverTokenId,
  hover,
  selectedTokenId,
  onClose,
}: AbsorbedBurnOverlayProps) {
  return (
    <>
      {hover && !selectedTokenId ? (
        <div
          className="pointer-events-none fixed z-30 flex items-center gap-2 rounded border border-[#FF6B00]/25 bg-[rgba(5,10,21,0.92)] px-2.5 py-2 shadow-lg backdrop-blur-sm"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <img
            src={burnedNormieImageUrl(hover.tokenId)}
            alt={`Burned Normie #${hover.tokenId}`}
            className="h-10 w-10 rounded border border-white/10 object-cover"
          />
          <span className="text-xs text-amber-50/85">
            #{hover.tokenId} · Absorbed
          </span>
        </div>
      ) : null}

      {selectedTokenId !== null ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-6">
          <div
            className="pointer-events-auto w-full max-w-[280px] rounded-lg border border-[#FF6B00]/20 bg-[rgba(5,10,21,0.94)] p-4 shadow-2xl backdrop-blur-sm"
            role="dialog"
            aria-label={`Absorbed Normie #${selectedTokenId}`}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="text-sm text-amber-50/90">
                #{selectedTokenId} Absorbed by Normie #{receiverTokenId}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 text-lg leading-none text-white/40 transition hover:text-white/70"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <img
              src={burnedNormieImageUrl(selectedTokenId)}
              alt={`Burned Normie #${selectedTokenId}`}
              className="mx-auto w-full max-w-[200px] rounded border border-white/10 object-cover"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
