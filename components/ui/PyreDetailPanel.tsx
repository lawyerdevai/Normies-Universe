"use client";

import { useEffect, useRef, useState } from "react";
import {
  PANEL_ACCENT,
  panelAccentLine,
  panelBody,
  panelCloseButton,
  panelEmpty,
  panelHeader,
  panelLabel,
  panelSectionTitle,
  panelShell,
  panelStatValue,
  panelTitle,
} from "@/components/ui/panelStyles";

type PyreData = {
  totalBurned: number;
  floorEth: number;
  largestBurn: { count: number; timestamp: number };
  recentBurns: { tokenId: string; timestamp: number }[];
};

type SearchedBurn = {
  tokenId: string;
  burnedAt: number;
};

interface PyreDetailPanelProps {
  open: boolean;
  searchedBurn?: SearchedBurn | null;
  onClose: () => void;
}

function formatDate(timestamp: number) {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(timestamp: number) {
  if (!timestamp) return "—";
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(timestamp);
}

function formatEth(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function BurnThumbnail({ tokenId }: { tokenId: string }) {
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
    <div
      ref={ref}
      className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-white/8 bg-white/[0.03]"
    >
      {inView ? (
        <>
          {!loaded ? (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-white/[0.05]" />
          ) : null}
          <img
            src={`https://api.normies.art/history/burned/${tokenId}/image.png`}
            alt={`Burned Normie #${tokenId}`}
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
  );
}

function SearchedBurnHeader({ tokenId, burnedAt }: SearchedBurn) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="px-3 py-3">
      <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-[4px] bg-white/[0.03]">
        {!loaded ? (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-white/[0.05]" />
        ) : null}
        <img
          src={`https://api.normies.art/history/burned/${tokenId}/image.png`}
          alt={`Burned Normie #${tokenId}`}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
      <p className="mt-3 text-center text-sm tabular-nums text-white/85">
        #{tokenId}
      </p>
      <p className="mt-1 text-center text-xs text-white/55">
        Burned · {formatDate(burnedAt)}
      </p>
    </div>
  );
}

export default function PyreDetailPanel({
  open,
  searchedBurn = null,
  onClose,
}: PyreDetailPanelProps) {
  const [data, setData] = useState<PyreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/pyre")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return res.json() as Promise<PyreData>;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load Pyre data");
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const ethAtFloor =
    data && data.floorEth > 0
      ? data.totalBurned * data.floorEth
      : null;

  return (
    <aside aria-hidden={!open} className={panelShell(open)}>
      {searchedBurn ? (
        <SearchedBurnHeader
          tokenId={searchedBurn.tokenId}
          burnedAt={searchedBurn.burnedAt}
        />
      ) : null}

      <div className={panelHeader}>
        <div className="min-w-0 flex-1">
          <h2 className={panelTitle}>The Core</h2>
          <p className={panelAccentLine}>
            {loading && !data ? (
              <span className="inline-block h-3.5 w-28 animate-pulse rounded bg-white/10" />
            ) : (
              <span style={{ color: PANEL_ACCENT }}>
                {(data?.totalBurned ?? 0).toLocaleString()} Normies burned
              </span>
            )}
          </p>
          <div className="mt-2 space-y-1">
            <div>
              <p className={panelLabel}>ETH at current floor</p>
              <p className={panelStatValue}>
                {loading && !data ? (
                  <span className="inline-block h-2.5 w-16 animate-pulse rounded bg-white/10" />
                ) : ethAtFloor !== null ? (
                  `≈ ${formatEth(ethAtFloor)} ETH`
                ) : (
                  "—"
                )}
              </p>
            </div>
            <div>
              <p className={panelLabel}>Largest single burn</p>
              <p className={panelStatValue}>
                {loading && !data ? (
                  <span className="inline-block h-2.5 w-24 animate-pulse rounded bg-white/10" />
                ) : data?.largestBurn.count ? (
                  <>
                    <span style={{ color: PANEL_ACCENT }}>
                      {data.largestBurn.count.toLocaleString()} Normies
                    </span>
                    <span className="text-white/35">
                      {" "}
                      · {formatDate(data.largestBurn.timestamp)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-white/35">0 Normies · —</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className={panelCloseButton}
        >
          ×
        </button>
      </div>

      <div className={panelBody}>
        <h3 className={panelSectionTitle}>Recent burns</h3>

        {error ? <p className="text-xs text-red-300/70">{error}</p> : null}

        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border border-white/5 p-2"
              >
                <div className="h-10 w-10 animate-pulse rounded bg-white/[0.04]" />
                <div className="h-3 w-20 animate-pulse rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && data && data.recentBurns.length === 0 ? (
          <p className={panelEmpty}>No recent burns.</p>
        ) : null}

        {data && data.recentBurns.length > 0 ? (
          <ul className="space-y-2">
            {data.recentBurns.map((burn) => (
              <li
                key={`${burn.tokenId}-${burn.timestamp}`}
                className="flex items-center gap-3 rounded-md border border-white/5 px-2 py-2"
              >
                <BurnThumbnail tokenId={burn.tokenId} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm tabular-nums text-white/80">
                    #{burn.tokenId}
                  </p>
                  <p className={panelLabel}>
                    {formatRelativeTime(burn.timestamp)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
