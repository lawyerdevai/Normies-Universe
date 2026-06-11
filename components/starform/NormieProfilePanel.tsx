"use client";

import { useEffect, useRef, useState } from "react";
import {
  PANEL_ACCENT,
  panelLabel,
  panelValue,
} from "@/components/ui/panelStyles";

type NormieInfo = {
  tokenId: string;
  type: string;
  level: number;
  actionPoints: number;
};

interface NormieProfilePanelProps {
  tokenId: number;
  totalAbsorbed: number | null;
  focusMode?: boolean;
}

export default function NormieProfilePanel({
  tokenId,
  totalAbsorbed,
  focusMode = false,
}: NormieProfilePanelProps) {
  const [info, setInfo] = useState<NormieInfo | null>(null);
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setInfo(null);
    setExpanded(false);

    fetch(`/api/normie/${tokenId}/info`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<NormieInfo>;
      })
      .then((data) => {
        if (!cancelled && data) setInfo(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  useEffect(() => {
    if (focusMode) setExpanded(false);
  }, [focusMode]);

  useEffect(() => {
    if (!expanded) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setExpanded(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [expanded]);

  const ready = info !== null && totalAbsorbed !== null;

  return (
    <div ref={rootRef} className="pointer-events-none fixed bottom-6 left-6 z-10">
      {expanded && ready ? (
        <div className="pointer-events-auto mb-2 flex max-w-[240px] gap-3 rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.75)] p-3 shadow-2xl backdrop-blur-sm">
          <img
            src={`https://api.normies.art/normie/${tokenId}/image.png`}
            alt={`Normie #${tokenId}`}
            className="h-14 w-14 shrink-0 rounded-[4px] border border-white/8 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="space-y-1.5">
              <div>
                <p className={panelLabel}>Type</p>
                <p className={panelValue}>{info.type}</p>
              </div>
              <div>
                <p className={panelLabel}>Level</p>
                <p className={panelValue}>{info.level}</p>
              </div>
              <div>
                <p className={panelLabel}>Action Points</p>
                <p className={panelValue}>{info.actionPoints}</p>
              </div>
              {totalAbsorbed > 0 ? (
                <div>
                  <p className={panelLabel}>Absorbed</p>
                  <p className={panelValue} style={{ color: PANEL_ACCENT }}>
                    {totalAbsorbed.toLocaleString()} Normies
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="normie-universe-title pointer-events-auto rounded-full px-2.5 py-1 text-sm text-white/50 transition hover:text-white/75"
      >
        #{tokenId}
      </button>
    </div>
  );
}
