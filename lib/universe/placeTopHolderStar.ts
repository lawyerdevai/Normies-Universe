import { PYRE_RX, PYRE_RY, PYRE_RZ } from "./generatePyre";
import type { StarPlacement } from "./generateStarPositions";
import { scatterForRank } from "./holderStarScatter";
import {
  localToWorldPlacement,
  ringForRank,
} from "./holderStarBands";
import { createRng, gaussian, lerp } from "./seededRandom";

export { PLACEMENT_SEED } from "./holderStarScatter";

const ARM_SWEEP = Math.PI * 3;
const CORE_RADIUS = 14;
const MAX_RADIUS = 95;
const SPIRAL_K = Math.log(MAX_RADIUS / CORE_RADIUS) / ARM_SWEEP;

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function angleDistance(a: number, b: number) {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(d, Math.PI * 2 - d);
}

type PlacementMode = "onArm" | "gap" | "fringe";

function placementMode(hash: number): PlacementMode {
  const bucket = (hash >> 12) % 100;
  if (bucket < 33) return "onArm";
  if (bucket < 66) return "gap";
  return "fringe";
}

function nearestArmAngle(armT: number, angle: number) {
  const arm0 = armT * ARM_SWEEP;
  const arm1 = Math.PI + armT * ARM_SWEEP;
  return angleDistance(angle, arm0) < angleDistance(angle, arm1) ? arm0 : arm1;
}

/**
 * Place a top-75 holder star by rank ring — inner rings near Pyre,
 * outer rings at the galaxy edge, full 360° organic scatter.
 */
export function placeTopHolderStar(
  rank: number,
  seed: string,
  angleOffset = 0,
): StarPlacement {
  const hash = hashSeed(seed);
  const rng = createRng(hash + rank * 1597);
  const ring = ringForRank(rank);
  const bandScatter = scatterForRank(rank);

  const armT = lerp(ring.tMin, ring.tMax, bandScatter.slotT);
  const r = CORE_RADIUS * Math.exp(SPIRAL_K * armT * ARM_SWEEP);

  let angle = bandScatter.angle + angleOffset;
  const mode = placementMode(hash);

  const armWidth = (1.1 + (1 - armT) * 2.6) * Math.exp(-r / 88);
  const perp = angle + Math.PI / 2;
  let scatter = 0;

  let bridgeX = 0;
  let bridgeZ = 0;

  if (mode === "onArm") {
    const armAngle = nearestArmAngle(armT, angle);
    angle = armAngle + gaussian(rng) * 0.05;
    scatter = gaussian(rng) * armWidth * 0.2;
  } else if (mode === "gap") {
    scatter = gaussian(rng) * armWidth * 0.5;
    const bridge = gaussian(rng) * armWidth * 0.36;
    bridgeX = Math.cos(angle + 0.55) * bridge;
    bridgeZ = Math.sin(angle + 0.55) * bridge;
  } else {
    const armAngle = nearestArmAngle(armT, angle);
    const side = ((hash >> 16) % 2 === 0 ? 1 : -1) as 1 | -1;
    angle = armAngle + side * (0.12 + rng() * 0.1) + gaussian(rng) * 0.06;
    scatter = side * armWidth * (0.42 + rng() * 0.22) + gaussian(rng) * armWidth * 0.12;
  }

  let lx = r * Math.cos(angle) + Math.cos(perp) * scatter + bridgeX;
  let lz = r * Math.sin(angle) + Math.sin(perp) * scatter + bridgeZ;
  let ly = gaussian(rng) * (0.65 + (1 - armT) * 1.05);

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

  return localToWorldPlacement(lx, ly, lz);
}

export function rotatePlacementY(
  placement: StarPlacement,
  delta: number,
): StarPlacement {
  const [x, y, z] = placement.position;
  const c = Math.cos(delta);
  const s = Math.sin(delta);
  const nx = x * c - z * s;
  const nz = x * s + z * c;
  return {
    position: [nx, y, nz],
    distanceFromCenter: Math.sqrt(nx * nx + y * y + nz * nz),
  };
}
