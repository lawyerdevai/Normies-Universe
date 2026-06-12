"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { truncateWallet } from "@/lib/opensea/holders";
import {
  BURNER_TIER2_COLOR,
  ZOMBIE_TIER_ACTIVE,
  zombieWalletSet,
  type BurnerWalletEntry,
} from "@/lib/universe/burnerStarConfig";
import { DEFAULT_CAMERA_DISTANCE } from "@/lib/universe/cameraConfig";
import { HOLDER_STAR_MAX_POINT_PX } from "@/lib/universe/holderStarPointShader";
import { visualFromHoldings } from "@/lib/universe/holderStarVisual";
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

const ZOMBIE_LEADERBOARD_STAR_SCALE = 3;
const rank1Visual = visualFromHoldings(100, 1, 100, 1);
const biggestGalaxyStarPx = Math.min(
  HOLDER_STAR_MAX_POINT_PX,
  (rank1Visual.coreSize + rank1Visual.glowSize * rank1Visual.glowOpacity) *
    (235 / DEFAULT_CAMERA_DISTANCE),
);
/** 3× rank-1 holder star at default galaxy framing (same point-size formula as scene). */
const ZOMBIE_STAR_PX = Math.round(biggestGalaxyStarPx * ZOMBIE_LEADERBOARD_STAR_SCALE);
const ZOMBIE_STAR_CENTER = { r: 122, g: 255, b: 122 };
const ZOMBIE_STAR_EDGE = { r: 42, g: 90, b: 46 };
const ZOMBIE_STAR_GLOW = 0.48;
const ZOMBIE_STAR_BASE_BRIGHTNESS = 1.5;

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function drawZombieStarSprite(
  canvas: HTMLCanvasElement,
  pulse: number,
  hovered: boolean,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = ZOMBIE_STAR_PX;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const image = ctx.createImageData(canvas.width, canvas.height);
  const data = image.data;
  const glowMix = 10 * (1 - ZOMBIE_STAR_GLOW) + 4.5 * ZOMBIE_STAR_GLOW;
  const brightness =
    ZOMBIE_STAR_BASE_BRIGHTNESS + pulse * 0.32 + (hovered ? 0.18 : 0);

  for (let py = 0; py < canvas.height; py++) {
    for (let px = 0; px < canvas.width; px++) {
      const ux = (px + 0.5) / canvas.width - 0.5;
      const uy = (py + 0.5) / canvas.height - 0.5;
      const dist = Math.hypot(ux, uy);
      const idx = (py * canvas.width + px) * 4;

      if (dist > 0.47) {
        data[idx + 3] = 0;
        continue;
      }

      const circleMask = 1 - smoothstep(0.34, 0.47, dist);
      const skewX = ux * 1.08;
      const skewY = uy * 0.92;
      const core = Math.exp(-(skewX * skewX + skewY * skewY) * 72);
      const glow =
        Math.exp(-dist * dist * glowMix) * ZOMBIE_STAR_GLOW * 0.62;
      const alpha = (core * 1.15 + glow) * brightness * circleMask;

      if (alpha < 0.001) {
        data[idx + 3] = 0;
        continue;
      }

      const colorMix = Math.min(1, core * 1.35 + glow * 0.5 + 0.2);
      const edgeWeight = Math.min(1, dist / 0.47);
      const tint = colorMix * (1 - edgeWeight * 0.35);
      const r =
        (ZOMBIE_STAR_EDGE.r +
          (ZOMBIE_STAR_CENTER.r - ZOMBIE_STAR_EDGE.r) * tint) /
        255;
      const g =
        (ZOMBIE_STAR_EDGE.g +
          (ZOMBIE_STAR_CENTER.g - ZOMBIE_STAR_EDGE.g) * tint) /
        255;
      const b =
        (ZOMBIE_STAR_EDGE.b +
          (ZOMBIE_STAR_CENTER.b - ZOMBIE_STAR_EDGE.b) * tint) /
        255;
      const litR = Math.min(r * (core * 1.35 + glow * 0.5 + 0.2), 1);
      const litG = Math.min(g * (core * 1.35 + glow * 0.5 + 0.2), 1);
      const litB = Math.min(b * (core * 1.35 + glow * 0.5 + 0.2), 1);

      data[idx] = Math.round(litR * 255);
      data[idx + 1] = Math.round(litG * 255);
      data[idx + 2] = Math.round(litB * 255);
      data[idx + 3] = Math.round(Math.min(alpha, 1) * 255);
    }
  }

  ctx.putImageData(image, 0, 0);
}

function ZombieLeaderboardOrb({ onClick }: { onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;
    const loop = (time: number) => {
      const pulse = (Math.sin((time / 1000) * (Math.PI * 2 / 4)) + 1) * 0.5;
      drawZombieStarSprite(canvas, pulse, hoverRef.current);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="group pointer-events-auto fixed top-[12%] right-[8%] z-[35]">
      <button
        type="button"
        onClick={onClick}
        aria-label="Open zombie leaderboard"
        onMouseEnter={() => {
          hoverRef.current = true;
        }}
        onMouseLeave={() => {
          hoverRef.current = false;
        }}
        className="block cursor-pointer border-0 bg-transparent p-0"
        style={{ width: ZOMBIE_STAR_PX, height: ZOMBIE_STAR_PX }}
      >
        <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded border border-white/10 bg-black/70 px-2 py-1 text-[10px] text-white/70 opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100">
        Zombie Leaderboard
      </span>
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
