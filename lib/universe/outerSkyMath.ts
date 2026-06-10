import { clamp01, createRng, gaussian, lerp } from "./seededRandom";

export type SkyBrightnessTier = 0 | 1 | 2 | 3;

export type SkyStarVisual = {
  tier: SkyBrightnessTier;
  screenPixels: number;
  opacity: number;
  color: [number, number, number];
  twinklePhase: number;
  twinkleSpeed: number;
  twinkles: boolean;
};

export function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Power-law brightness mix: ~70 / 25 / 4 / 1 percent. */
export function brightnessTierFromHash(hash: number): SkyBrightnessTier {
  const bucket = hash % 10000;
  if (bucket < 7000) return 0;
  if (bucket < 9500) return 1;
  if (bucket < 9900) return 2;
  return 3;
}

function stellarColor(hash: number, rng: () => number): [number, number, number] {
  const bucket = hash % 100;
  const j = (rng() - 0.5) * 0.025;

  if (bucket < 8) {
    return [
      lerp(0.94, 0.99, rng()) + j,
      lerp(0.9, 0.96, rng()) + j,
      lerp(0.84, 0.9, rng()) + j,
    ];
  }
  if (bucket < 20) {
    return [
      lerp(0.9, 0.96, rng()) + j,
      lerp(0.92, 0.97, rng()) + j,
      lerp(0.97, 1.0, rng()) + j,
    ];
  }

  const t = rng();
  const v = lerp(0.88, 1.0, t);
  return [v + j, v + j, lerp(0.91, 1.0, t) + j];
}

export function skyVisualFromHash(hash: number, twinkleRoll: number): SkyStarVisual {
  const rng = createRng(hash ^ 0xc0ffee);
  const tier = brightnessTierFromHash(hash);

  let screenPixels: number;
  let opacity: number;

  switch (tier) {
    case 0:
      screenPixels = 1.0;
      opacity = 0.1 + rng() * 0.12;
      break;
    case 1:
      screenPixels = 1.15 + rng() * 0.35;
      opacity = 0.26 + rng() * 0.16;
      break;
    case 2:
      screenPixels = 1.85 + rng() * 0.55;
      opacity = 0.48 + rng() * 0.18;
      break;
    default:
      screenPixels = 2.4 + rng() * 1.5;
      opacity = 0.72 + rng() * 0.2;
      break;
  }

  return {
    tier,
    screenPixels,
    opacity,
    color: stellarColor(hash, rng),
    twinklePhase: ((hash % 6283) / 1000) * Math.PI * 2,
    twinkleSpeed: 0.18 + ((hash >> 8) % 1000) / 1000 * 0.35,
    twinkles: twinkleRoll < 7,
  };
}

export function decorativeSkyVisual(seed: number): SkyStarVisual {
  const rng = createRng(seed ^ 0xdec0de);
  const twinkleRoll = seed % 100;
  return {
    tier: 0,
    screenPixels: 1.12,
    opacity: 0.06 + rng() * 0.085,
    color: stellarColor(seed, rng),
    twinklePhase: ((seed % 6283) / 1000) * Math.PI * 2,
    twinkleSpeed: (Math.PI * 2) / (2 + (seed % 1000) / 1000),
    twinkles: twinkleRoll < 9,
  };
}
