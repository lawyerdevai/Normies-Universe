import type { StarPlacement } from "./generateStarPositions";
import { createRng, gaussian } from "./seededRandom";
import { hashSeed } from "./outerSkyMath";

const R_INNER = 82;
const R_OUTER = 360;

/**
 * Deterministic full-sky placement from wallet hash — surrounds the
 * galaxy on all sides with natural density variation, no ring shape.
 */
export function placeOuterHolderStar(wallet: string): StarPlacement {
  const hash = hashSeed(wallet.toLowerCase());
  const rng = createRng(hash ^ 0x9e3779b9);

  const clusterTheta = ((hash % 997) / 997) * Math.PI * 2;
  const clusterPhi = Math.acos(clamp11((hash >> 10) % 2000, 1000));
  const personalTheta = ((hash >> 3) % 100000) / 100000 * Math.PI * 2;
  const personalPhi = Math.acos(clamp11((hash >> 17) % 2000, 1000));

  const theta =
    personalTheta * 0.62 +
    clusterTheta * 0.28 +
    gaussian(rng) * 0.22;
  const phi =
    personalPhi * 0.58 +
    clusterPhi * 0.3 +
    gaussian(rng) * 0.28;

  const patch =
    Math.sin(theta * 6.1 + phi * 4.7) * 0.5 +
    Math.cos(theta * 3.3 - phi * 2.1) * 0.35;
  const radialBias = 0.42 + patch * 0.18 + rng() * 0.4;
  const r = R_INNER + Math.pow(radialBias, 0.72) * (R_OUTER - R_INNER);

  const flatten = 0.38 + rng() * 0.28;
  const x = r * Math.sin(phi) * Math.cos(theta) + gaussian(rng) * 8;
  const y =
    r * Math.sin(phi) * Math.sin(theta) * flatten +
    gaussian(rng) * (10 + r * 0.025);
  const z = r * Math.cos(phi) + gaussian(rng) * 8;

  return {
    position: [x, y, z],
    distanceFromCenter: Math.sqrt(x * x + y * y + z * z),
  };
}

function clamp11(value: number, scale: number) {
  return Math.max(-1, Math.min(1, (value / scale) * 2 - 1));
}
