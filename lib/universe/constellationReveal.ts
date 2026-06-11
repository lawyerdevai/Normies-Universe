import { createRng } from "@/lib/universe/seededRandom";
import type { ConstellationStar } from "@/lib/universe/generateConstellation";

export const STAR_REVEAL_FADE_SECONDS = 0.3;
const BRIGHT_START_SECONDS = 0.5;
const MEDIUM_START_MIN = 1;
const MEDIUM_START_MAX = 3;
const FAINT_START_MIN = 2;
const FAINT_START_MAX = 5;

export function starRevealMultiplier(
  elapsed: number,
  startTime: number,
): number {
  if (elapsed < startTime) return 0;
  const t = (elapsed - startTime) / STAR_REVEAL_FADE_SECONDS;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

export function buildConstellationRevealSchedule(
  stars: ConstellationStar[],
  tokenId: number,
): Float32Array {
  const starts = new Float32Array(stars.length);
  const rng = createRng(tokenId * 73_291 + 17);

  const ranked = stars
    .map((star, index) => ({ index, brightness: star.brightness }))
    .sort((a, b) => b.brightness - a.brightness);

  const brightCount = Math.max(1, Math.ceil(stars.length * 0.1));
  const mediumCount = Math.ceil(stars.length * 0.5);

  for (let rank = 0; rank < ranked.length; rank++) {
    const { index } = ranked[rank]!;
    if (rank < brightCount) {
      starts[index] = BRIGHT_START_SECONDS + rng() * 0.15;
    } else if (rank < mediumCount) {
      starts[index] =
        MEDIUM_START_MIN + rng() * (MEDIUM_START_MAX - MEDIUM_START_MIN);
    } else {
      starts[index] =
        FAINT_START_MIN + rng() * (FAINT_START_MAX - FAINT_START_MIN);
    }
  }

  return starts;
}
