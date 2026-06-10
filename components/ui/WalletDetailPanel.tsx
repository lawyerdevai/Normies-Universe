"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HolderGroupStar } from "@/types/universe";

type WalletData = {
  address: string;
  tokenIds: string[];
  burnedCount: number;
};

interface WalletDetailPanelProps {
  group: HolderGroupStar | null;
  open: boolean;
  onClose: () => void;
}

function NormieThumbnail({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <div className="relative aspect-square w-full overflow-hidden rounded-md border border-white/8 bg-white/[0.03]">
        {inView ? (
          <>
            {!loaded ? (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-white/[0.05]" />
            ) : null}
            <img
              src={`https://api.normies.art/normie/${id}/image.png`}
              alt={`Normie #${id}`}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              className={`h-full w-full object-cover transition-opacity duration-300 ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </>
        ) : (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-white/[0.05]" />
        )}
      </div>
      <span className="text-[10px] tabular-nums text-white/45">#{id}</span>
    </div>
  );
}

export default function WalletDetailPanel({
  group,
  open,
  onClose,
}: WalletDetailPanelProps) {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const wallet = group?.wallet ?? group?.id.replace(/^holder-/, "") ?? "";
  const walletDisplay = group?.walletDisplay ?? group?.label ?? "";
  const rank = group?.collectionRank ?? group?.rankStart ?? 0;
  const normieCount = group?.totalNormies ?? 0;

  useEffect(() => {
    if (!open || !wallet) {
      setWalletData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/wallet/${wallet}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return res.json() as Promise<WalletData>;
      })
      .then((data) => {
        if (cancelled) return;
        setWalletData(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load wallet");
        setWalletData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, wallet]);

  const sortedTokenIds = useMemo(() => {
    if (!walletData?.tokenIds.length) return [];
    return [...walletData.tokenIds].sort(
      (a, b) => Number(a) - Number(b) || a.localeCompare(b),
    );
  }, [walletData?.tokenIds]);

  const handleCopy = useCallback(async () => {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — ignore.
    }
  }, [wallet]);

  return (
    <aside
      aria-hidden={!open}
      className={`pointer-events-auto fixed right-0 top-0 z-40 flex h-full w-[320px] flex-col border-l border-white/10 bg-black/55 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-mono text-sm text-white/85">
              {walletDisplay}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy wallet address"
              className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-white/50 transition-colors hover:border-white/20 hover:text-white/75"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-sm font-medium text-amber-50/90">
            #{rank} · {normieCount.toLocaleString()} Normies
          </p>
          <p className="mt-1 text-xs text-white/45">
            Burned:{" "}
            {loading ? (
              <span className="inline-block h-3 w-8 animate-pulse rounded bg-white/10" />
            ) : (
              (walletData?.burnedCount ?? 0).toLocaleString()
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-sm text-white/50 transition-colors hover:border-white/20 hover:text-white/80"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && !walletData ? (
          <div className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-md bg-white/[0.04]"
              />
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="text-xs text-red-300/70">{error}</p>
        ) : null}

        {!loading && walletData && sortedTokenIds.length === 0 ? (
          <p className="text-xs text-white/35">No Normies in this wallet.</p>
        ) : null}

        {sortedTokenIds.length > 0 ? (
          <div className="grid grid-cols-3 gap-2.5">
            {sortedTokenIds.map((id) => (
              <NormieThumbnail key={id} id={id} />
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
