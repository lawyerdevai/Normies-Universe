"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StarformScene from "@/components/starform/StarformScene";
import { generateConstellation } from "@/lib/universe/generateConstellation";

interface StarformViewProps {
  tokenId: number;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; constellation: ReturnType<typeof generateConstellation> };

export default function StarformView({ tokenId }: StarformViewProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050a15]">
      {state.status === "ready" ? (
        <StarformScene constellation={state.constellation} tokenId={tokenId} />
      ) : null}

      <div className="pointer-events-none fixed inset-0 z-10">
        <Link
          href="/"
          className="pointer-events-auto absolute left-6 top-6 text-sm text-white/50 transition hover:text-white/75"
        >
          ← Normies Universe
        </Link>
      </div>

      {state.status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-white/35">Loading constellation…</p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <p className="text-center text-sm text-white/45">{state.message}</p>
        </div>
      ) : null}
    </div>
  );
}
