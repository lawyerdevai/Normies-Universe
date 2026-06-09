import type { HolderGroupTier } from "@/types/universe";
import * as THREE from "three";
import { clamp01, createRng, gaussian, lerp } from "./seededRandom";

const UNIVERSE_SEED = 41891;
const TOTAL_HOLDERS = 1891;

// Match GalaxyAtmosphere spiral parameters.
const ARM_SWEEP = Math.PI * 3;
const CORE_RADIUS = 14;
const MAX_RADIUS = 95;
const SPIRAL_K = Math.log(MAX_RADIUS / CORE_RADIUS) / ARM_SWEEP;
const GALAXY_EULER = new THREE.Euler(0.28, 0.15, 0.35, "XYZ");
const GALAXY_SCALE = 1.15;

const _local = new THREE.Vector3();

type RankBand = { tMin: number; tMax: number; rankLo: number; rankHi: number };

const RANK_BANDS: RankBand[] = [
  { tMin: 0.11, tMax: 0.25, rankLo: 1, rankHi: 50 },
  { tMin: 0.23, tMax: 0.52, rankLo: 51, rankHi: 300 },
  { tMin: 0.48, tMax: 0.76, rankLo: 301, rankHi: 800 },
  { tMin: 0.72, tMax: 0.94, rankLo: 801, rankHi: TOTAL_HOLDERS },
];

function bandForRank(rankStart: number): RankBand {
  return (
    RANK_BANDS.find((b) => rankStart >= b.rankLo && rankStart <= b.rankHi) ??
    RANK_BANDS[RANK_BANDS.length - 1]
  );
}

export function tierFromRank(rankStart: number): HolderGroupTier {
  if (rankStart <= 10) return "core";
  if (rankStart <= 100) return "inner";
  if (rankStart <= 500) return "middle";
  return "outer";
}

export function tierLabel(tier: HolderGroupTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export type StarPlacement = {
  position: [number, number, number];
  distanceFromCenter: number;
};

/**
 * Place holder stars along spiral arms with rank-driven radius and organic spacing.
 */
export function generateStarPosition(
  index: number,
  _tier: HolderGroupTier,
  rankStart: number,
): StarPlacement {
  const rng = createRng(UNIVERSE_SEED + index * 9973 + rankStart * 131);
  const band = bandForRank(rankStart);
  const bandSpan = Math.max(band.rankHi - band.rankLo, 1);
  const rankInBand = clamp01((rankStart - band.rankLo) / bandSpan);

  // Golden-ratio stagger avoids even bead spacing along the arms.
  const golden = (index * 0.6180339887 + rankStart * 0.037) % 1;
  const wobble = Math.sin(index * 1.71 + rankStart * 0.11) * 0.016;
  const armT =
    lerp(band.tMin, band.tMax, rankInBand * 0.42 + golden * 0.58) +
    wobble +
    gaussian(rng) * 0.014;

  const arm = (index + Math.floor(rankStart / 23)) % 2;
  const startAngle = arm * Math.PI;
  const theta = startAngle + armT * ARM_SWEEP;
  const r = CORE_RADIUS * Math.exp(SPIRAL_K * (theta - startAngle));
  const armWidth = (1.0 + (1 - armT) * 3.2) * Math.exp(-r / 85);
  const perp = theta + Math.PI / 2;
  const scatter = gaussian(rng) * armWidth * 0.24;

  const lx = r * Math.cos(theta) + Math.cos(perp) * scatter;
  const lz = r * Math.sin(theta) + Math.sin(perp) * scatter;
  const ly = gaussian(rng) * (0.75 + (1 - armT) * 1.2);

  _local.set(lx * GALAXY_SCALE, ly * GALAXY_SCALE, lz * GALAXY_SCALE);
  _local.applyEuler(GALAXY_EULER);

  return {
    position: [_local.x, _local.y, _local.z],
    distanceFromCenter: Math.sqrt(
      _local.x * _local.x + _local.y * _local.y + _local.z * _local.z,
    ),
  };
}
