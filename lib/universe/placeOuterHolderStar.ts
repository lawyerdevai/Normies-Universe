import type { StarPlacement } from "./generateStarPositions";
import { clamp01, createRng, gaussian } from "./seededRandom";

const R_MIN = 78;
const R_SPREAD = 320;

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function sampleRadius(rng: () => number) {
  const u = clamp01(rng() + gaussian(rng) * 0.04);
  const core = Math.pow(u, 0.36);
  const tail = Math.pow(rng(), 2.4) * 0.58;
  const r = R_MIN + R_SPREAD * (core * 0.74 + tail * 0.26);
  return r * (0.9 + rng() * 0.2);
}

/** Deterministic world-space placement — dense near galaxy, thinning outward. */
export function placeOuterHolderStar(wallet: string): StarPlacement {
  const hash = hashSeed(wallet.toLowerCase());
  const rng = createRng(hash ^ 0x9e3779b9);

  const r = sampleRadius(rng);
  const cluster = Math.sin((hash % 10000) * 0.0011) * 0.11;
  const theta =
    (hash % 100000) / 100000 * Math.PI * 2 +
    gaussian(rng) * 0.18 +
    cluster;
  const phi = Math.acos(2 * rng() - 1);

  const verticalWarp = 0.45 + rng() * 0.35;
  const x = r * Math.sin(phi) * Math.cos(theta) + gaussian(rng) * 5;
  const y =
    r * Math.sin(phi) * Math.sin(theta) * verticalWarp +
    gaussian(rng) * (7 + r * 0.035);
  const z = r * Math.cos(phi) + gaussian(rng) * 5;

  return {
    position: [x, y, z],
    distanceFromCenter: Math.sqrt(x * x + y * y + z * z),
  };
}
