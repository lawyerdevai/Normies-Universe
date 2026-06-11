"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AbsorbedBurnOverlay from "@/components/starform/AbsorbedBurnOverlay";
import type { AbsorbedHoverPayload } from "@/components/starform/AbsorbedBurnStars";
import NormieProfilePanel from "@/components/starform/NormieProfilePanel";
import StarformScene from "@/components/starform/StarformScene";
import { GALAXY_ARRIVAL_ACTIVE } from "@/lib/universe/galaxyArrival";
import { generateConstellation } from "@/lib/universe/generateConstellation";

const INTRO_REVEAL_MS = 2000;

interface StarformViewProps {
  tokenId: number;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; constellation: ReturnType<typeof generateConstellation> };

export default function StarformView({ tokenId }: StarformViewProps) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [departing, setDeparting] = useState(false);
  const [absorbedHover, setAbsorbedHover] = useState<number | null>(null);
  const [absorbedHoverScreen, setAbsorbedHoverScreen] =
    useState<AbsorbedHoverPayload | null>(null);
  const [absorbedSelectedTokenId, setAbsorbedSelectedTokenId] = useState<
    number | null
  >(null);
  const [showAbsorbed, setShowAbsorbed] = useState(false);
  const [totalAbsorbed, setTotalAbsorbed] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [isSkyMode, setIsSkyMode] = useState(true);
  const backgroundColor = isSkyMode ? "#000000" : "#050a15";
  const [introReveal, setIntroReveal] = useState(false);

  const handleAbsorbedHover = useCallback(
    (payload: AbsorbedHoverPayload | null) => {
      setAbsorbedHover(payload?.tokenId ?? null);
      setAbsorbedHoverScreen(payload);
    },
    [],
  );

  const handleAbsorbedSelect = useCallback((absorbedTokenId: number) => {
    setAbsorbedSelectedTokenId(absorbedTokenId);
    setAbsorbedHover(null);
    setAbsorbedHoverScreen(null);
  }, []);

  useEffect(() => {
    setIntroReveal(false);
    const timer = window.setTimeout(() => setIntroReveal(true), INTRO_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [tokenId]);

  useEffect(() => {
    setAbsorbedHover(null);
    setAbsorbedHoverScreen(null);
    setAbsorbedSelectedTokenId(null);
    setShowAbsorbed(false);
    setTotalAbsorbed(null);
    setFocusMode(false);
  }, [tokenId]);

  const enterFocusMode = useCallback(() => {
    setFocusMode(true);
    setAbsorbedHover(null);
    setAbsorbedHoverScreen(null);
    setAbsorbedSelectedTokenId(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/normie/${tokenId}/absorbed`)
      .then(async (res) => {
        if (!res.ok) return 0;
        const data = (await res.json()) as { totalAbsorbed?: number };
        return typeof data.totalAbsorbed === "number" ? data.totalAbsorbed : 0;
      })
      .then((count) => {
        if (!cancelled) setTotalAbsorbed(count);
      })
      .catch(() => {
        if (!cancelled) setTotalAbsorbed(0);
      });

    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/normie/${tokenId}/pixels`)
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? `Request failed (${res.status})`);
        }
        return res.json() as Promise<{ pixels: string }>;
      })
      .then((data) => {
        if (cancelled) return;
        setState({
          status: "ready",
          constellation: generateConstellation(data.pixels, tokenId),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load pixels",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  const constellationReveal = state.status === "ready";

  const handleReturn = useCallback(() => {
    if (departing) return;
    setDeparting(true);
  }, [departing]);

  const handleDepartureComplete = useCallback(() => {
    sessionStorage.setItem(GALAXY_ARRIVAL_ACTIVE, "1");
    router.push("/");
  }, [router]);

  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      style={{
        backgroundColor,
        transition: "background-color 0.8s ease",
      }}
    >
      <StarformScene
        tokenId={tokenId}
        backgroundColor={backgroundColor}
        constellation={
          state.status === "ready" ? state.constellation : undefined
        }
        constellationReveal={constellationReveal}
        departing={departing}
        onDepartureComplete={handleDepartureComplete}
        showAbsorbed={showAbsorbed}
        absorbedHoverTokenId={absorbedHover}
        absorbedSelectedTokenId={absorbedSelectedTokenId}
        onAbsorbedHover={handleAbsorbedHover}
        onAbsorbedSelect={handleAbsorbedSelect}
      />

      {focusMode && state.status === "ready" ? (
        <button
          type="button"
          className="fixed inset-0 z-20 cursor-default"
          aria-label="Show controls"
          onClick={() => setFocusMode(false)}
        />
      ) : null}

      <div
        className={`transition-opacity duration-300 ${
          introReveal
            ? focusMode
              ? "pointer-events-none opacity-0"
              : "pointer-events-none opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        {showAbsorbed ? (
          <AbsorbedBurnOverlay
            receiverTokenId={tokenId}
            hover={absorbedHoverScreen}
            selectedTokenId={absorbedSelectedTokenId}
            onClose={() => setAbsorbedSelectedTokenId(null)}
          />
        ) : null}

        <div className="fixed inset-0 z-10">
          <button
            type="button"
            onClick={handleReturn}
            disabled={departing}
            className="normie-universe-title pointer-events-auto absolute left-6 top-6 text-sm text-white/50 transition hover:text-white/75 disabled:opacity-30"
          >
            ← Normies Universe
          </button>
          {state.status === "ready" ? (
            <div className="pointer-events-auto absolute right-6 top-6 flex items-center gap-4">
              <button
                type="button"
                onClick={enterFocusMode}
                className="text-sm text-white/50 transition hover:text-white/75"
              >
                ✦ Focus
              </button>
              <button
                type="button"
                onClick={() => setIsSkyMode((on) => !on)}
                className="text-sm text-white/50 transition hover:text-white/75"
              >
                {isSkyMode ? "✦ Sky" : "✦ Space"}
              </button>
              {totalAbsorbed !== null && totalAbsorbed > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowAbsorbed((on) => {
                      if (on) {
                        setAbsorbedHover(null);
                        setAbsorbedHoverScreen(null);
                        setAbsorbedSelectedTokenId(null);
                      }
                      return !on;
                    });
                  }}
                  className={`text-sm transition hover:text-white/75 ${
                    showAbsorbed ? "text-white/75" : "text-white/50"
                  }`}
                >
                  ✦ Absorbed
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <NormieProfilePanel
          tokenId={tokenId}
          totalAbsorbed={totalAbsorbed}
          focusMode={focusMode}
        />
      </div>

      {state.status === "error" && introReveal ? (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <p className="text-center text-sm text-white/45">{state.message}</p>
        </div>
      ) : null}
    </div>
  );
}
