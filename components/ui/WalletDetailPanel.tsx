"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  PANEL_ACCENT,
  panelAccentLine,
  panelBody,
  panelCloseButton,
  panelEmpty,
  panelHeader,
  panelMetaButton,
  panelShell,
  panelTitle,
} from "@/components/ui/panelStyles";
import type { WalletSelection } from "@/types/universe";

type WalletData = {
  address: string;
  tokenIds: string[];
  burnedCount: number;
};

interface WalletDetailPanelProps {
  selection: WalletSelection | null;
  open: boolean;
  onClose: () => void;
}

function NormieThumbnail({
  id,
  onActivate,
}: {
  id: string;
  onActivate: (id: string, event: MouseEvent<HTMLAnchorElement>) => void;
}) {
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
    <a
      href={`/starform/${id}`}
      onClick={(event) => onActivate(id, event)}
      className="group flex cursor-pointer flex-col items-center gap-0.5"
    >
      <div
        ref={ref}
        className="relative aspect-square w-full overflow-hidden rounded-[4px] bg-white/[0.03]"
      >
        {inView ? (
          <>
            {!loaded ? (
              <div className="absolute inset-0 animate-pulse rounded-[4px] bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-white/[0.05]" />
            ) : null}
            <img
              src={`https://api.normies.art/normie/${id}/image.png`}
              alt={`Normie #${id}`}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              className={`h-full w-full rounded-[4px] object-cover transition duration-300 group-hover:brightness-110 ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </>
        ) : (
          <div className="absolute inset-0 animate-pulse rounded-[4px] bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-white/[0.05]" />
        )}
      </div>
      <span className="text-[9px] tabular-nums text-white/40">#{id}</span>
    </a>
  );
}

export default function WalletDetailPanel({
  selection,
  open,
  onClose,
}: WalletDetailPanelProps) {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleThumbnailActivate = useCallback(
    (id: string, event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      router.push(`/starform/${id}`);
    },
    [router],
  );

  const wallet = selection?.wallet ?? "";
  const walletDisplay = selection?.walletDisplay ?? "";
  const rank = selection?.rank;
  const normieCount = selection?.normieCount ?? 0;

  useEffect(() => {
    if (!open || !wallet) {
      setWalletData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/wallet?address=${encodeURIComponent(wallet)}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as WalletData;
        if (!Array.isArray(data.tokenIds)) return null;
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setWalletData(data);
      })
      .catch(() => {
        if (cancelled) return;
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

  const burnedCount = walletData?.burnedCount ?? 0;

  return (
    <aside aria-hidden={!open} className={panelShell(open)}>
      <div className={panelHeader}>
        <div className="min-w-0 flex-1">
          <p className={panelTitle}>
            {rank !== undefined ? `#${rank} · ` : ""}
            {normieCount.toLocaleString()} Normies
          </p>
          {!loading && burnedCount >= 1 ? (
            <p className={panelAccentLine}>
              <span style={{ color: PANEL_ACCENT }}>
                {burnedCount.toLocaleString()} Burned
              </span>
            </p>
          ) : null}
          <div className="mt-2 flex items-center gap-1.5">
            <p className="truncate font-mono text-[10px] text-white/35">
              {walletDisplay}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy wallet address"
              className={panelMetaButton}
            >
              {copied ? "Copied" : "Copy"}
            </button>
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
        {loading && !walletData ? (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-[4px] bg-white/[0.04]"
              />
            ))}
          </div>
        ) : null}

        {!loading && walletData && sortedTokenIds.length === 0 ? (
          <p className={panelEmpty}>No Normies in this wallet.</p>
        ) : null}

        {sortedTokenIds.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5">
            {sortedTokenIds.map((id) => (
              <NormieThumbnail
                key={id}
                id={id}
                onActivate={handleThumbnailActivate}
              />
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
