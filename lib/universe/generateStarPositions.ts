import type { HolderGroupTier } from "@/types/universe";
import * as THREE from "three";
import { clamp01, createRng, gaussian, lerp } from "./seededRandom";

const UNIVERSE_SEED = 41891;

// Match GalaxyAtmosphere spiral parameters.
const ARM_SWEEP = Math.PI * 3;
const CORE_RADIUS = 14;
const MAX_RADIUS = 95;
const SPIRAL_K = Math.log(MAX_RADIUS / CORE_RADIUS) / ARM_SWEEP;
const GALAXY_EULER = new THREE.Euler(0.28, 0.15, 0.35, "XYZ");
const GALAXY_SCALE = 1.15;

// Progress along each arm (0 = inner, 1 = outer tip).
const TIER_ARM_T: Record<HolderGroupTier, [number, number]> = {
  core: [0.09, 0.17],
  inner: [0.17, 0.38],
  middle: [0.38, 0.66],
  outer: [0.66, 0.9],
};

const _local = new THREE.Vector3();

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
 * Place holder stars along the galaxy spiral arms by tier.
 * Top groups sit on the inner arms; lower tiers sweep outward.
 */
export function generateStarPosition(
  index: number,
  tier: HolderGroupTier,
  rankStart: number,
): StarPlacement {
  const rng = createRng(UNIVERSE_SEED + index * 9973);
  const [tMin, tMax] = TIER_ARM_T[tier];
  const rankT = clamp01(rankStart / 1891);
  const bandT = index / 188;
  const stagger = (index % 19) / 19;

  const armT =
    lerp(tMin, tMax, rankT * 0.5 + bandT * 0.3 + stagger * 0.2) +
    gaussian(rng) * 0.012;

  const arm = index % 2;
  const startAngle = arm * Math.PI;
  const theta = startAngle + armT * ARM_SWEEP;
  const r = CORE_RADIUS * Math.exp(SPIRAL_K * (theta - startAngle));
  const armWidth = (1.2 + (1 - armT) * 3.5) * Math.exp(-r / 85);
  const perp = theta + Math.PI / 2;
  const scatter = gaussian(rng) * armWidth * 0.32;

  const lx = r * Math.cos(theta) + Math.cos(perp) * scatter;
  const lz = r * Math.sin(theta) + Math.sin(perp) * scatter;
  const ly = gaussian(rng) * (0.9 + (1 - armT) * 1.4);

  _local.set(lx * GALAXY_SCALE, ly * GALAXY_SCALE, lz * GALAXY_SCALE);
  _local.applyEuler(GALAXY_EULER);

  return {
    position: [_local.x, _local.y, _local.z],
    distanceFromCenter: Math.sqrt(
      _local.x * _local.x + _local.y * _local.y + _local.z * _local.z,
    ),
  };
}
