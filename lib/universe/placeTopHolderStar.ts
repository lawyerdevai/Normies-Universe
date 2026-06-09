import * as THREE from "three";
import { PYRE_RX, PYRE_RY, PYRE_RZ } from "./generatePyre";
import type { StarPlacement } from "./generateStarPositions";
import { clamp01, createRng, gaussian, lerp } from "./seededRandom";

const ARM_SWEEP = Math.PI * 3;
const CORE_RADIUS = 14;
const SPIRAL_K = Math.log(95 / CORE_RADIUS) / ARM_SWEEP;
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

function zoneForRank(rank: number) {
  if (rank <= 7) return { tMin: 0.055, tMax: 0.17, count: 7, index0: 1 };
  if (rank <= 25) return { tMin: 0.14, tMax: 0.31, count: 18, index0: 8 };
  if (rank <= 50) return { tMin: 0.27, tMax: 0.47, count: 25, index0: 26 };
  return { tMin: 0.43, tMax: 0.62, count: 25, index0: 51 };
}

function rankTInZone(rank: number) {
  if (rank <= 7) return (rank - 1) / 6;
  if (rank <= 25) return (rank - 8) / 17;
  if (rank <= 50) return (rank - 26) / 24;
  return (rank - 51) / 24;
}

function angleDistance(a: number, b: number) {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(d, Math.PI * 2 - d);
}

/** Even sector per rank in tier + wallet-hash offset for deterministic organic angle. */
function angleForPlacement(rank: number, seed: string, rng: () => number) {
  const zone = zoneForRank(rank);
  const tierIndex = rank - zone.index0;
  const sector = (Math.PI * 2) / zone.count;
  const sectorCenter = tierIndex * sector + sector * 0.5;

  const hash = hashSeed(seed);
  const walletT = (hash % 100000) / 100000;
  const walletOffset = (walletT - 0.5) * sector * 0.82;

  return sectorCenter + walletOffset + gaussian(rng) * sector * 0.06;
}

/**
 * Place a top-75 holder star by collection rank — full 360° per tier.
 */
export function placeTopHolderStar(
  rank: number,
  seed: string,
): StarPlacement {
  const hash = hashSeed(seed);
  const rng = createRng(hash + rank * 1597);
  const zone = zoneForRank(rank);
  const rankT = clamp01(rankTInZone(rank));

  const armT =
    lerp(zone.tMin, zone.tMax, rankT * 0.5 + rng() * 0.5) +
    gaussian(rng) * 0.01;
  const r = CORE_RADIUS * Math.exp(SPIRAL_K * armT * ARM_SWEEP);

  let angle = angleForPlacement(rank, seed, rng);
  const onArm = (hash >> 12) % 100 < 48;

  const armWidth = (1.1 + (1 - armT) * 2.6) * Math.exp(-r / 88);
  const perp = angle + Math.PI / 2;
  let scatter = gaussian(rng) * armWidth * 0.28;

  if (onArm) {
    const arm0 = armT * ARM_SWEEP;
    const arm1 = Math.PI + armT * ARM_SWEEP;
    angle =
      (angleDistance(angle, arm0) < angleDistance(angle, arm1) ? arm0 : arm1) +
      gaussian(rng) * 0.05;
    scatter = gaussian(rng) * armWidth * 0.22;
  }

  let lx = r * Math.cos(angle) + Math.cos(perp) * scatter;
  let lz = r * Math.sin(angle) + Math.sin(perp) * scatter;
  let ly = gaussian(rng) * (0.65 + (1 - armT) * 1.05);

  if (!onArm) {
    const bridge = gaussian(rng) * armWidth * 0.32;
    lx += Math.cos(angle + 0.55) * bridge;
    lz += Math.sin(angle + 0.55) * bridge;
  }

  if (rank <= 7) {
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
