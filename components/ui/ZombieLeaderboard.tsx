"use client";

import { useEffect, useState } from "react";
import {
  panelBody,
  panelCloseButton,
  panelEmpty,
  panelHeader,
  panelShell,
} from "@/components/ui/panelStyles";

type LeaderboardItem = {
  rank: number;
  wallet: string;
  walletDisplay: string;
  username: string | null;
  totalRecursiveBurnCount: number;
};

type LeaderboardResponse = {
  updatedAt: number;
  totalWallets: number;
  items: LeaderboardItem[];
};

interface ZombieLeaderboardProps {
  open: boolean;
  onClose: () => void;
}

function formatUpdatedAt(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ZombieLeaderboard({
  open,
  onClose,
}: ZombieLeaderboardProps) {
  const [rows, setRows] = useState<LeaderboardItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch("/api/recursive-burn-leaderboard")
      .then((res) => res.json())
      .then((data: LeaderboardResponse) => {
        if (cancelled) return;
        setRows(data.items ?? []);
        setUpdatedAt(data.updatedAt ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setUpdatedAt(null);
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const updatedLabel = updatedAt != null ? formatUpdatedAt(updatedAt) : null;

  return (
    <aside aria-hidden={!open} className={panelShell(open)}>
      <div className={panelHeader}>
        <div className="min-w-0 flex-1">
          <p className="normie-universe-title text-[15px] tracking-wide text-[#E8F4FF]/90">
            ZOMBIE LEADERBOARD
          </p>
          <p className="mt-1 text-[10px] text-white/35">
            Wallets ranked by total recursive burn power.
          </p>
          {updatedLabel ? (
            <p className="mt-1 text-[10px] text-white/30">
              Last updated {updatedLabel}
            </p>
          ) : null}
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
        {loading && rows.length === 0 ? (
          <p className={panelEmpty}>Loading leaderboard…</p>
        ) : null}

        {!loading && error ? (
          <p className={panelEmpty}>Could not load leaderboard.</p>
        ) : null}

        {!loading && !error && rows.length === 0 ? (
          <p className={panelEmpty}>No recursive burn data yet.</p>
        ) : null}

        {rows.length > 0 ? (
          <>
            <div className="mb-1 flex items-center gap-2 px-2 text-[9px] uppercase tracking-wide text-white/30">
              <span className="w-6 shrink-0">#</span>
              <span className="min-w-0 flex-1">Wallet</span>
              <span className="shrink-0">Recursive Burns</span>
              <span className="w-[11px] shrink-0" aria-hidden />
            </div>
            <ul className="flex flex-col gap-1">
              {rows.map((row) => (
                <li
                  key={row.wallet}
                  className="flex items-center gap-2 rounded bg-[rgba(90,138,94,0.14)] px-2 py-1.5"
                >
                  <span className="w-6 shrink-0 text-[10px] tabular-nums text-white/40">
                    #{row.rank}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-[10px] ${
                      row.username
                        ? "text-white/72"
                        : "font-mono text-white/55"
                    }`}
                  >
                    {row.username ?? row.walletDisplay}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-white/50">
                    {row.totalRecursiveBurnCount.toLocaleString()}
                  </span>
                  <span className="shrink-0 text-[11px] leading-none">🧟</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </aside>
  );
}
