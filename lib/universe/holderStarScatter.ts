import { HOLDER_STAR_BANDS } from "./holderStarBands";
import { clamp01, createRng, gaussian } from "./seededRandom";

/** Change this to reroll the entire within-band star arrangement. */
export const PLACEMENT_SEED = 10;

export type BandScatter = {
  angle: number;
  slotT: number;
};

type Cluster = {
  angle: number;
  slotT: number;
  mass: number;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function shuffleInPlace<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function distributeEvenly(total: number, buckets: number): number[] {
  const counts = new Array<number>(buckets).fill(Math.floor(total / buckets));
  const remainder = total % buckets;
  for (let i = 0; i < remainder; i++) counts[i]++;
  return counts;
}

function pickWeighted(clusters: Cluster[], rng: () => number) {
  const total = clusters.reduce((sum, c) => sum + c.mass, 0);
  let pick = rng() * total;
  for (const cluster of clusters) {
    pick -= cluster.mass;
    if (pick <= 0) return cluster;
  }
  return clusters[clusters.length - 1];
}

export function buildScatterForSeed(seed: number) {
  const scatter = new Map<number, BandScatter>();

  HOLDER_STAR_BANDS.forEach((ring, bandIndex) => {
    const rng = createRng(seed * 10007 + bandIndex * 7919);
    const innerLean = 1 - bandIndex * 0.1;
    const clusterFrac = (0.34 + rng() * 0.22) * innerLean;
    const clusterCount = Math.max(2, Math.round(ring.count * clusterFrac));
    const sectorWidth = (Math.PI * 2) / clusterCount;
    const bandPhase = GOLDEN_ANGLE * (bandIndex + 1) + rng() * sectorWidth * 0.5;

    const clusters: Cluster[] = [];
    for (let c = 0; c < clusterCount; c++) {
      const sectorMid = bandPhase + (c + 0.5) * sectorWidth;
      const sectorJitter = (rng() - 0.5) * sectorWidth * 0.38;
      clusters.push({
        angle: sectorMid + sectorJitter,
        slotT: Math.pow(rng(), 0.48 + bandIndex * 0.1),
        mass: 0.3 + Math.pow(rng(), 0.6) * 2.8,
      });
    }

    const starsPerSector = distributeEvenly(ring.count, clusterCount);
    const sectorOrder = Array.from({ length: clusterCount }, (_, i) => i);
    shuffleInPlace(sectorOrder, rng);

    const ranks = Array.from(
      { length: ring.count },
      (_, i) => ring.index0 + i,
    );
    shuffleInPlace(ranks, rng);

    let rankIdx = 0;
    const tightness = 0.2 + bandIndex * 0.032;

    for (const sector of sectorOrder) {
      const countInSector = starsPerSector[sector];
      const sectorMid = bandPhase + (sector + 0.5) * sectorWidth;

      for (let s = 0; s < countInSector; s++) {
        const rank = ranks[rankIdx++];
        const cluster = pickWeighted(clusters, rng);
        const clusterPull = 0.55 + rng() * 0.35;
        const baseAngle =
          sectorMid * clusterPull + cluster.angle * (1 - clusterPull);

        scatter.set(rank, {
          angle: baseAngle + gaussian(rng) * tightness,
          slotT: clamp01(cluster.slotT + gaussian(rng) * 0.065),
        });
      }
    }
  });

  return scatter;
}

const scatterCaches = new Map<number, Map<number, BandScatter>>();

export function scatterForRank(
  rank: number,
  placementSeed: number = PLACEMENT_SEED,
): BandScatter {
  let cached = scatterCaches.get(placementSeed);
  if (!cached) {
    cached = buildScatterForSeed(placementSeed);
    scatterCaches.set(placementSeed, cached);
  }

  const slot = cached.get(rank);
  if (!slot) {
    throw new Error(`No scatter slot for holder rank ${rank}`);
  }
  return slot;
}
