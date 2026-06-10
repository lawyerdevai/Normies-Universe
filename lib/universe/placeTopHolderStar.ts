import * as THREE from "three";
import { PYRE_RX, PYRE_RY, PYRE_RZ } from "./generatePyre";
import type { StarPlacement } from "./generateStarPositions";
import { clamp01, createRng, gaussian, lerp } from "./seededRandom";

const ARM_SWEEP = Math.PI * 3;
const CORE_RADIUS = 14;
const MAX_RADIUS = 95;
const SPIRAL_K = Math.log(MAX_RADIUS / CORE_RADIUS) / ARM_SWEEP;
const GALAXY_EULER = new THREE.Euler(0.28, 0.15, 0.35, "XYZ");
const GALAXY_SCALE = 1.15;

const _local = new THREE.Vector3();

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

type RankRing = {
  tMin: number;
  tMax: number;
  count: number;
  index0: number;
};

/** Rank → galactic ring band — spans Pyre to outer arm tips. */
function ringForRank(rank: number): RankRing {
  if (rank <= 5) return { tMin: 0.05, tMax: 0.17, count: 5, index0: 1 };
  if (rank <= 20) return { tMin: 0.18, tMax: 0.34, count: 15, index0: 6 };
  if (rank <= 45) return { tMin: 0.3, tMax: 0.56, count: 25, index0: 21 };
  return { tMin: 0.48, tMax: 0.93, count: 30, index0: 46 };
}

function rankTInRing(rank: number, ring: RankRing) {
  return clamp01((rank - ring.index0) / Math.max(1, ring.count - 1));
}

function angleDistance(a: number, b: number) {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(d, Math.PI * 2 - d);
}

/** Full 360° sector per rank + wallet-hash offset for organic scatter. */
function angleForPlacement(rank: number, ring: RankRing, seed: string, rng: () => number) {
  const tierIndex = rank - ring.index0;
  const sector = (Math.PI * 2) / ring.count;
  const sectorCenter = tierIndex * sector + sector * 0.5;

  const hash = hashSeed(seed);
  const walletT = (hash % 100000) / 100000;
  const walletOffset = (walletT - 0.5) * sector * 0.85;

  return sectorCenter + walletOffset + gaussian(rng) * sector * 0.08;
}

/**
 * Place a top-75 holder star by rank ring — inner rings near Pyre,
 * outer rings at the galaxy edge, full 360° organic scatter.
 */
export function placeTopHolderStar(
  rank: number,
  seed: string,
): StarPlacement {
  const hash = hashSeed(seed);
  const rng = createRng(hash + rank * 1597);
  const ring = ringForRank(rank);
  const rankT = rankTInRing(rank, ring);

  const armT =
    lerp(ring.tMin, ring.tMax, rankT * 0.45 + rng() * 0.55) +
    gaussian(rng) * 0.012;
  const r = CORE_RADIUS * Math.exp(SPIRAL_K * armT * ARM_SWEEP);

  let angle = angleForPlacement(rank, ring, seed, rng);
  const onArm = (hash >> 12) % 100 < 48;

  const armWidth = (1.1 + (1 - armT) * 2.6) * Math.exp(-r / 88);
  const perp = angle + Math.PI / 2;
  let scatter = gaussian(rng) * armWidth * 0.3;

  if (onArm) {
    const arm0 = armT * ARM_SWEEP;
    const arm1 = Math.PI + armT * ARM_SWEEP;
    angle =
      (angleDistance(angle, arm0) < angleDistance(angle, arm1) ? arm0 : arm1) +
      gaussian(rng) * 0.055;
    scatter = gaussian(rng) * armWidth * 0.24;
  }

  let lx = r * Math.cos(angle) + Math.cos(perp) * scatter;
  let lz = r * Math.sin(angle) + Math.sin(perp) * scatter;
  let ly = gaussian(rng) * (0.65 + (1 - armT) * 1.05);

  if (!onArm) {
    const bridge = gaussian(rng) * armWidth * 0.34;
    lx += Math.cos(angle + 0.55) * bridge;
    lz += Math.sin(angle + 0.55) * bridge;
  }

  if (rank <= 5) {
    const norm =
      (lx / PYRE_RX) ** 2 + (ly / PYRE_RY) ** 2 + (lz / PYRE_RZ) ** 2;
    if (norm < 1.18) {
      const push = 1.22 / Math.sqrt(norm);
      lx *= push;
      ly *= push * 0.85;
      lz *= push;
    }
  }

  _local.set(lx * GALAXY_SCALE, ly * GALAXY_SCALE, lz * GALAXY_SCALE);
  _local.applyEuler(GALAXY_EULER);

  return {
    position: [_local.x, _local.y, _local.z],
    distanceFromCenter: Math.sqrt(
      _local.x * _local.x + _local.y * _local.y + _local.z * _local.z,
    ),
  };
}
