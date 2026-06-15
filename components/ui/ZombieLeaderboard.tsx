"use client";

import { useEffect, useState } from "react";
import {
  panelBody,
  panelCloseButton,
  panelEmpty,
  panelHeader,
  panelShell,
} from "@/components/ui/panelStyles";

type LeaderboardRow = {
  rank: number;
  wallet: string;
  walletDisplay: string;
  username: string | null;
  totalRecursiveBurnCount: number;
};

function formatUpdatedAt(value: string | number): string {
  const date =
    typeof value === "number"
      ? new Date(value < 1e12 ? value * 1000 : value)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseLeaderboardResponse(data: unknown): {
  rows: LeaderboardRow[];
  updatedAt: string | number | null;
} {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid leaderboard response");
  }

  const payload = data as Record<string, unknown>;

  if (typeof payload.error === "string") {
    throw new Error(payload.error);
  }

  if (!Array.isArray(payload.items)) {
    throw new Error("Invalid leaderboard items");
  }

  const rows = payload.items.map((item, index) => {
    const row = item as Record<string, unknown>;
    const wallet = String(row.wallet ?? "");
    const burnCount = row.totalRecursiveBurnCount;

    return {
      rank: typeof row.rank === "number" ? row.rank : index + 1,
      wallet,
      walletDisplay: String(row.walletDisplay ?? wallet),
      username: typeof row.username === "string" ? row.username : null,
      totalRecursiveBurnCount:
        typeof burnCount === "number" ? burnCount : Number(burnCount ?? 0),
    };
  });

  const updatedAt =
    typeof payload.updatedAt === "number" || typeof payload.updatedAt === "string"
      ? payload.updatedAt
      : null;

  return { rows, updatedAt };
}

interface ZombieLeaderboardProps {
  open: boolean;
  onClose: () => void;
}

export default function ZombieLeaderboard({
  open,
  onClose,
}: ZombieLeaderboardProps) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch("/api/recursive-burn-leaderboard")
      .then(async (res) => {
        const data: unknown = await res.json();
        if (!res.ok) {
          const message =
            data &&
            typeof data === "object" &&
            typeof (data as { error?: unknown }).error === "string"
              ? (data as { error: string }).error
              : "Request failed";
          throw new Error(message);
        }
        return parseLeaderboardResponse(data);
      })
      .then(({ rows: nextRows, updatedAt: nextUpdatedAt }) => {
        if (cancelled) return;
        setRows(nextRows);
        setUpdatedAt(nextUpdatedAt);
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

  const updatedLabel = updatedAt ? formatUpdatedAt(updatedAt) : null;

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
