import { clamp01, createRng, gaussian } from "./seededRandom";

/** Change this to reroll the entire within-band star arrangement. */
export const PLACEMENT_SEED = 1;

type RankRing = {
  tMin: number;
  tMax: number;
  count: number;
  index0: number;
};

export type BandScatter = {
  angle: number;
  slotT: number;
};

const RING_BANDS: RankRing[] = [
  { tMin: 0.055, tMax: 0.165, count: 5, index0: 1 },
  { tMin: 0.167, tMax: 0.275, count: 10, index0: 6 },
  { tMin: 0.277, tMax: 0.405, count: 15, index0: 16 },
  { tMin: 0.407, tMax: 0.615, count: 20, index0: 31 },
  { tMin: 0.617, tMax: 0.93, count: 25, index0: 51 },
];

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

  RING_BANDS.forEach((ring, bandIndex) => {
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
