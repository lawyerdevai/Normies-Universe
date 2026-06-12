"use client";

import { useMemo, useState } from "react";
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

function ZombieLeaderboardOrb({ onClick }: { onClick: () => void }) {
  return (
    <div className="group pointer-events-auto fixed right-5 top-4 z-[35]">
      <button
        type="button"
        onClick={onClick}
        aria-label="Open zombie leaderboard"
        className="zombie-planet-btn relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0"
      >
        <span aria-hidden className="zombie-planet-glow absolute inset-0 rounded-full" />
        <span aria-hidden className="zombie-planet-surface relative z-[1] h-14 w-14 rounded-full">
          <span aria-hidden className="zombie-planet-texture absolute inset-0 rounded-full" />
        </span>
      </button>
      <span className="pointer-events-none absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded border border-white/10 bg-black/70 px-2 py-1 text-[10px] text-white/70 opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100">
        Zombie Leaderboard
      </span>
      <style>{`
        .zombie-planet-surface {
          background:
            radial-gradient(
              circle at 24% 22%,
              #3a6e3a 0%,
              rgba(58, 110, 58, 0.42) 6%,
              transparent 18%
            ),
            radial-gradient(
              circle at 68% 72%,
              #0d1f0d 0%,
              #1a3d1a 52%,
              #0d1f0d 100%
            );
          box-shadow:
            inset -6px -7px 14px rgba(0, 0, 0, 0.72),
            inset 2px 2px 4px rgba(58, 110, 58, 0.12);
        }

        .zombie-planet-texture {
          background:
            radial-gradient(
              ellipse 32% 18% at 55% 62%,
              rgba(26, 61, 26, 0.35) 0%,
              transparent 72%
            ),
            radial-gradient(
              ellipse 22% 12% at 72% 38%,
              rgba(13, 31, 13, 0.5) 0%,
              transparent 68%
            );
          opacity: 0.7;
        }

        .zombie-planet-glow {
          animation: zombie-planet-pulse 4s ease-in-out infinite;
          box-shadow:
            0 0 8px 4px rgba(42, 90, 42, 0.6),
            0 0 20px 10px rgba(26, 58, 26, 0.35),
            0 0 45px 18px rgba(10, 42, 10, 0.15);
          transition: box-shadow 0.4s ease;
        }

        .zombie-planet-btn:hover .zombie-planet-glow {
          box-shadow:
            0 0 10px 5px rgba(42, 90, 42, 0.72),
            0 0 24px 12px rgba(26, 58, 26, 0.45),
            0 0 52px 22px rgba(10, 42, 10, 0.22);
        }

        @keyframes zombie-planet-pulse {
          0%,
          100% {
            opacity: 0.78;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }
      `}</style>
    </div>
  );
}

function ZombieLeaderboardPanel({
  open,
  rows,
  onClose,
}: {
  open: boolean;
  rows: LeaderboardRow[];
  onClose: () => void;
}) {
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
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-white/55">
                  {row.walletDisplay}
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

export default function ZombieLeaderboard({ burners }: ZombieLeaderboardProps) {
  const [open, setOpen] = useState(false);

  const rows = useMemo(
    () => (burners?.length ? buildLeaderboardRows(burners) : []),
    [burners],
  );

  return (
    <>
      <ZombieLeaderboardOrb onClick={() => setOpen(true)} />
      <ZombieLeaderboardPanel
        open={open}
        rows={rows}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
