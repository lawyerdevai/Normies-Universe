import { HOLDER_STAR_BANDS } from "./holderStarBands";
import { clamp01, createRng, gaussian } from "./seededRandom";

/** Change this to reroll the entire within-band star arrangement. */
export const PLACEMENT_SEED = 1;

export type BandScatter = {
  angle: number;
  slotT: number;
};

type Cluster = {
  angle: number;
  slotT: number;
  mass: number;
};

function pickWeighted(clusters: Cluster[], rng: () => number) {
  const total = clusters.reduce((sum, c) => sum + c.mass, 0);
  let pick = rng() * total;
  for (const cluster of clusters) {
    pick -= cluster.mass;
    if (pick <= 0) return cluster;
  }
  return clusters[clusters.length - 1];
}

function buildScatterForSeed(seed: number) {
  const scatter = new Map<number, BandScatter>();

  HOLDER_STAR_BANDS.forEach((ring, bandIndex) => {
    const rng = createRng(seed * 10007 + bandIndex * 7919);
    const innerLean = 1 - bandIndex * 0.1;
    const clusterFrac = (0.34 + rng() * 0.22) * innerLean;
    const clusterCount = Math.max(2, Math.round(ring.count * clusterFrac));

    const clusters: Cluster[] = [];
    for (let c = 0; c < clusterCount; c++) {
      clusters.push({
        angle: rng() * Math.PI * 2,
        slotT: Math.pow(rng(), 0.48 + bandIndex * 0.1),
        mass: 0.3 + Math.pow(rng(), 0.6) * 2.8,
      });
    }

    for (let i = 0; i < ring.count; i++) {
      const rank = ring.index0 + i;
      const cluster = pickWeighted(clusters, rng);
      const tightness = 0.2 + bandIndex * 0.032;
      scatter.set(rank, {
        angle: cluster.angle + gaussian(rng) * tightness,
        slotT: clamp01(cluster.slotT + gaussian(rng) * 0.065),
      });
    }
  });

  return scatter;
}

let cachedSeed = -1;
let cachedScatter = new Map<number, BandScatter>();

export function scatterForRank(rank: number): BandScatter {
  if (cachedSeed !== PLACEMENT_SEED) {
    cachedScatter = buildScatterForSeed(PLACEMENT_SEED);
    cachedSeed = PLACEMENT_SEED;
  }

  const slot = cachedScatter.get(rank);
  if (!slot) {
    throw new Error(`No scatter slot for holder rank ${rank}`);
  }
  return slot;
}
