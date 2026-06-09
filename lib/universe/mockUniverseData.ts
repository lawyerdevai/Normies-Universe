import type { AmbientStar, HolderGroupStar } from "@/types/universe";
import { createRng } from "./seededRandom";
import { generateHolderGroupStats } from "./generateHolderGroups";

const AMBIENT_COUNT = 5000;
const AMBIENT_SEED = 88001;

let cachedGroups: HolderGroupStar[] | null = null;
let cachedAmbient: AmbientStar[] | null = null;

export function getHolderGroups(): HolderGroupStar[] {
  if (!cachedGroups) {
    cachedGroups = generateHolderGroupStats();
  }
  return cachedGroups;
}

export function getAmbientStars(): AmbientStar[] {
  if (!cachedAmbient) {
    const rng = createRng(AMBIENT_SEED);
    cachedAmbient = Array.from({ length: AMBIENT_COUNT }, (_, i) => {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const r = 90 + rng() * 300;
      const tint = rng();

      return {
        id: `ambient-${i}`,
        position: [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta) * 0.35,
          r * Math.cos(phi),
        ],
        size: 0.1 + rng() * 0.32,
        brightness: 0.03 + rng() * 0.11,
        color: `hsl(${220 + tint * 30}, 18%, ${52 + tint * 18}%)`,
      };
    });
  }
  return cachedAmbient;
}

/** Entry point for future API replacement. */
export function loadUniverseData() {
  return {
    holderGroups: getHolderGroups(),
    ambientStars: getAmbientStars(),
  };
}
