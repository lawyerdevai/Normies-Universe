import { createRng } from "./seededRandom";

const GRID_SIZE = 40;
const PIXEL_COUNT = GRID_SIZE * GRID_SIZE;

const SPARSE_PIXEL_THRESHOLD = 150;
const DENSE_PIXEL_THRESHOLD = 400;
const SIZE_SCALE = 1.5;

export type StarTint = "cool" | "white" | "warm";

export type ConstellationStar = {
  x: number;
  y: number;
  brightness: number;
  size: number;
  tint: StarTint;
};

export type ConstellationData = {
  stars: ConstellationStar[];
  pixels: string;
  drawnPixelCount: number;
  density: "sparse" | "medium" | "dense";
  sizeScale: number;
};

function parseGrid(pixels: string): Uint8Array[] {
  const grid: Uint8Array[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    const rowValues = new Uint8Array(GRID_SIZE);
    for (let col = 0; col < GRID_SIZE; col++) {
      const ch = pixels[row * GRID_SIZE + col];
      if (ch !== "0" && ch !== "1") {
        throw new Error(`Invalid pixel character "${ch}" at (${col}, ${row})`);
      }
      rowValues[col] = ch === "1" ? 1 : 0;
    }
    grid.push(rowValues);
  }
  return grid;
}

function densityFromCount(drawnPixelCount: number): ConstellationData["density"] {
  if (drawnPixelCount < SPARSE_PIXEL_THRESHOLD) return "sparse";
  if (drawnPixelCount > DENSE_PIXEL_THRESHOLD) return "dense";
  return "medium";
}

function microCountForDensity(
  density: ConstellationData["density"],
  rng: () => number,
): number {
  switch (density) {
    case "sparse":
      return 6 + Math.floor(rng() * 3);
    case "dense":
      return 3 + Math.floor(rng() * 2);
    default:
      return 4 + Math.floor(rng() * 3);
  }
}

function brightnessRange(density: ConstellationData["density"]) {
  switch (density) {
    case "sparse":
      return { min: 0.5, span: 0.35 };
    case "dense":
      return { min: 0.3, span: 0.35 };
    default:
      return { min: 0.35, span: 0.35 };
  }
}

function assignTint(rng: () => number): StarTint {
  const roll = rng();
  if (roll < 0.7) return "cool";
  if (roll < 0.9) return "white";
  return "warm";
}

function assignDustSize(rng: () => number): number {
  const roll = rng();
  if (roll < 0.5) return 0.3 + rng() * 0.2;
  if (roll < 0.85) return 0.6 + rng() * 0.3;
  return 1.0 + rng() * 0.3;
}

function cellPosition(
  row: number,
  col: number,
  rng: () => number,
): { x: number; y: number } {
  const jitterX = (rng() - 0.5) * 2 * 0.45;
  const jitterY = (rng() - 0.5) * 2 * 0.45;
  return {
    x: col + 0.5 + jitterX - GRID_SIZE / 2,
    y: GRID_SIZE / 2 - (row + 0.5 + jitterY),
  };
}

export function generateConstellation(
  pixels: string,
  tokenId: number,
  densityMultiplier = 1,
): ConstellationData {
  if (pixels.length !== PIXEL_COUNT) {
    throw new Error(
      `Expected ${PIXEL_COUNT} pixel characters, got ${pixels.length}`,
    );
  }

  const grid = parseGrid(pixels);
  const rng = createRng(tokenId);
  const stars: ConstellationStar[] = [];

  let drawnPixelCount = 0;
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (grid[row][col] === 1) drawnPixelCount++;
    }
  }

  const density = densityFromCount(drawnPixelCount);
  const { min: brightMin, span: brightSpan } = brightnessRange(density);

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (grid[row][col] !== 1) continue;

      const microCount = Math.max(
        1,
        Math.round(microCountForDensity(density, rng) * densityMultiplier),
      );
      for (let i = 0; i < microCount; i++) {
        const { x, y } = cellPosition(row, col, rng);
        stars.push({
          x,
          y,
          brightness: brightMin + rng() * brightSpan,
          size: assignDustSize(rng),
          tint: assignTint(rng),
        });
      }
    }
  }

  return {
    stars,
    pixels,
    drawnPixelCount,
    density,
    sizeScale: SIZE_SCALE,
  };
}
