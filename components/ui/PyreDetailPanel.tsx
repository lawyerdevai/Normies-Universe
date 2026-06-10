"use client";

import { useEffect, useRef, useState } from "react";

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
    <div className="border-b border-white/8 px-4 py-4">
      <div className="relative mx-auto h-24 w-24 overflow-hidden rounded border border-white/10 bg-white/[0.03]">
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
    <aside
      aria-hidden={!open}
      className={`pointer-events-auto fixed right-0 top-0 z-40 flex h-full w-[320px] flex-col border-l border-white/10 bg-black/55 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {searchedBurn ? (
        <SearchedBurnHeader
          tokenId={searchedBurn.tokenId}
          burnedAt={searchedBurn.burnedAt}
        />
      ) : null}

      <div className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-white/85">The Pyre</h2>
          <dl className="mt-3 space-y-2 text-xs text-white/55">
            <div>
              <dt className="text-white/40">Total burned</dt>
              <dd className="mt-0.5 tabular-nums text-white/80">
                {loading && !data ? (
                  <span className="inline-block h-3 w-12 animate-pulse rounded bg-white/10" />
                ) : (
                  (data?.totalBurned ?? 0).toLocaleString()
                )}
              </dd>
            </div>
            <div>
              <dt className="text-white/40">ETH at current floor</dt>
              <dd className="mt-0.5 tabular-nums text-white/80">
                {loading && !data ? (
                  <span className="inline-block h-3 w-16 animate-pulse rounded bg-white/10" />
                ) : ethAtFloor !== null ? (
                  `≈ ${formatEth(ethAtFloor)} ETH`
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-white/40">Largest single burn</dt>
              <dd className="mt-0.5 text-white/80">
                {loading && !data ? (
                  <span className="inline-block h-3 w-24 animate-pulse rounded bg-white/10" />
                ) : data?.largestBurn.count ? (
                  <>
                    {data.largestBurn.count.toLocaleString()} Normies ·{" "}
                    {formatDate(data.largestBurn.timestamp)}
                  </>
                ) : (
                  "0 Normies · —"
                )}
              </dd>
            </div>
          </dl>
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
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/40">
          Recent burns
        </h3>

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
          <p className="text-xs text-white/35">No recent burns.</p>
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
                  <p className="text-xs tabular-nums text-white/75">
                    #{burn.tokenId}
                  </p>
                  <p className="text-[10px] text-white/40">
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
