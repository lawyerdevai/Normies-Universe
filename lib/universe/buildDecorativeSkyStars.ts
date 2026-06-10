import type { DecorativeSkyStar } from "@/types/universe";
import { decorativeSkyVisual } from "./outerSkyMath";
import { createRng, gaussian } from "./seededRandom";

const DECORATIVE_COUNT = 2800;
const DECORATIVE_SEED = 44021;
const R_INNER = 75;
const R_OUTER = 380;

export function buildDecorativeSkyStars(): DecorativeSkyStar[] {
  const rng = createRng(DECORATIVE_SEED);
  const stars: DecorativeSkyStar[] = [];

  for (let i = 0; i < DECORATIVE_COUNT; i++) {
    const seed = DECORATIVE_SEED + i * 104729;
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const patch =
      Math.sin(theta * 5.3 + phi * 3.9) * 0.5 +
      Math.cos(theta * 2.7) * 0.3;
    const radialT = 0.35 + patch * 0.15 + Math.pow(rng(), 0.65) * 0.5;
    const r = R_INNER + radialT * (R_OUTER - R_INNER);

    const flatten = 0.35 + rng() * 0.3;
    const x = r * Math.sin(phi) * Math.cos(theta) + gaussian(rng) * 6;
    const y =
      r * Math.sin(phi) * Math.sin(theta) * flatten +
      gaussian(rng) * 8;
    const z = r * Math.cos(phi) + gaussian(rng) * 6;

    const visual = decorativeSkyVisual(seed);

    stars.push({
      id: `sky-deco-${i}`,
      position: [x, y, z],
      screenPixels: visual.screenPixels,
      opacity: visual.opacity,
      color: visual.color,
      twinklePhase: visual.twinklePhase,
      twinkleSpeed: visual.twinkleSpeed,
      twinkles: visual.twinkles,
      tier: visual.tier,
    });
  }

  return stars;
}
