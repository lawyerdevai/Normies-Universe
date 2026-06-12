"use client";

import { useEffect, useMemo, useState } from "react";
import { truncateWallet } from "@/lib/opensea/holders";
import {
  BURNER_TIER2_COLOR,
  ZOMBIE_TIER_ACTIVE,
  zombieWalletSet,
  type BurnerWalletEntry,
} from "@/lib/universe/burnerStarConfig";
import {
  panelBody,
  panelCloseButton,
  panelEmpty,
  panelHeader,
  panelShell,
} from "@/components/ui/panelStyles";

type LeaderboardRow = {
  rank: number;
  address: string;
  walletDisplay: string;
  burnedCount: number;
  tier: "zombie" | 1 | 2;
};

interface ZombieLeaderboardProps {
  burners: BurnerWalletEntry[] | null;
  open: boolean;
  onClose: () => void;
}

function buildLeaderboardRows(burners: BurnerWalletEntry[]): LeaderboardRow[] {
  const zombies = zombieWalletSet(burners);

  return [...burners]
    .sort((a, b) => b.burnedCount - a.burnedCount)
    .slice(0, 50)
    .map((burner, index) => {
      const address = burner.address.trim().toLowerCase();
      const isZombie = ZOMBIE_TIER_ACTIVE && zombies.has(address);

      return {
        rank: index + 1,
        address,
        walletDisplay: truncateWallet(address),
        burnedCount: burner.burnedCount,
        tier: isZombie ? "zombie" : burner.tier,
      };
    });
}

function TierBadge({ tier }: { tier: LeaderboardRow["tier"] }) {
  if (tier === "zombie") {
    return <span className="shrink-0 text-[11px] leading-none">🧟</span>;
  }
  if (tier === 1) {
    return <span className="shrink-0 text-[11px] leading-none">🔥</span>;
  }
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: BURNER_TIER2_COLOR }}
      aria-hidden
    />
  );
}

function rowTintClass(tier: LeaderboardRow["tier"]) {
  if (tier === "zombie") return "bg-[rgba(90,138,94,0.14)]";
  if (tier === 1) return "bg-[rgba(255,107,0,0.10)]";
  return "bg-[rgba(143,46,18,0.10)]";
}

export default function ZombieLeaderboard({
  burners,
  open,
  onClose,
}: ZombieLeaderboardProps) {
  const [usernames, setUsernames] = useState<Record<string, string | null>>({});

  const rows = useMemo(
    () => (burners?.length ? buildLeaderboardRows(burners) : []),
    [burners],
  );

  useEffect(() => {
    if (!open || rows.length === 0) return;

    setUsernames({});
    let cancelled = false;

    fetch("/api/opensea/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses: rows.map((row) => row.address) }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<Record<string, string | null>>;
      })
      .then((data) => {
        if (cancelled || !data) return;
        setUsernames(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [open, rows]);

  return (
    <aside aria-hidden={!open} className={panelShell(open)}>
      <div className={panelHeader}>
        <div className="min-w-0 flex-1">
          <p className="normie-universe-title text-[15px] tracking-wide text-[#E8F4FF]/90">
            ZOMBIE LEADERBOARD
          </p>
          <p className="mt-1 text-[10px] text-white/35">Top 50 Burners</p>
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
        {rows.length === 0 ? (
          <p className={panelEmpty}>No burner data yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {rows.map((row) => (
              <li
                key={row.address}
                className={`flex items-center gap-2 rounded px-2 py-1.5 ${rowTintClass(row.tier)}`}
              >
                <span className="w-6 shrink-0 text-[10px] tabular-nums text-white/40">
                  #{row.rank}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-[10px] ${
                    usernames[row.address]
                      ? "text-white/72"
                      : "font-mono text-white/55"
                  }`}
                >
                  {usernames[row.address] ?? row.walletDisplay}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-white/50">
                  {row.burnedCount.toLocaleString()}
                </span>
                <TierBadge tier={row.tier} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
