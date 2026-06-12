import * as THREE from "three";
import { DEFAULT_CAMERA_FOV } from "@/lib/universe/cameraConfig";
import { createRng } from "@/lib/universe/seededRandom";

const BASE_SIZE = 3.5;
const CAMERA_Z = 50;
const GRID_SIZE = 40;
const VIEWPORT_HEIGHT_FRACTION = 0.75;
const Y_OFFSET_FRACTION = 0.05;
const MAX_EXPORT_PLACEMENT_ATTEMPTS = 48;
const COLOR_EMBER = new THREE.Color("#FF6B00");
const COLOR_RED_ORANGE = new THREE.Color("#CC3300");

export type AbsorbedBurnStar = {
  absorbedTokenId: number;
  position: [number, number, number];
  color: THREE.Color;
  coreSize: number;
  glowSize: number;
  glowOpacity: number;
  brightness: number;
  twinklePhase: number;
  twinkleSpeed: number;
  twinkleLift: number;
};

export function burnedNormieImageUrl(tokenId: number) {
  return `https://api.normies.art/history/burned/${tokenId}/image.png`;
}

export type AbsorbedBurnTier = {
  sizeMult: number;
  brightness: number;
  glowOpacity: number;
};

export function absorbedBurnTier(totalCount: number): AbsorbedBurnTier {
  if (totalCount === 1) {
    return { sizeMult: 2.5, brightness: 0.9, glowOpacity: 0.22 };
  }
  if (totalCount <= 5) {
    return { sizeMult: 1.8, brightness: 0.75, glowOpacity: 0.18 };
  }
  if (totalCount <= 20) {
    return { sizeMult: 1.4, brightness: 0.65, glowOpacity: 0.14 };
  }
  if (totalCount <= 50) {
    return { sizeMult: 1.2, brightness: 0.55, glowOpacity: 0.1 };
  }
  return { sizeMult: 1.0, brightness: 0.5, glowOpacity: 0.06 };
}

function visibleDimensions(aspect: number) {
  const fovRad = (DEFAULT_CAMERA_FOV * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(fovRad / 2) * CAMERA_Z;
  return {
    visibleHeight,
    visibleWidth: visibleHeight * aspect,
  };
}

function constellationExclusionBounds(visibleHeight: number) {
  const targetHeight = visibleHeight * VIEWPORT_HEIGHT_FRACTION;
  const scale = targetHeight / GRID_SIZE;
  const halfExtent = (GRID_SIZE / 2) * scale;

  return {
    halfWidth: halfExtent,
    halfHeight: halfExtent,
    centerY: visibleHeight * Y_OFFSET_FRACTION,
  };
}

function isInsideConstellation(
  x: number,
  y: number,
  bounds: ReturnType<typeof constellationExclusionBounds>,
) {
  return (
    Math.abs(x) <= bounds.halfWidth &&
    Math.abs(y - bounds.centerY) <= bounds.halfHeight
  );
}

function minRadiusOutsideConstellation(
  angle: number,
  bounds: ReturnType<typeof constellationExclusionBounds>,
) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (
    Math.max(
      bounds.halfWidth / Math.max(Math.abs(cos), 1e-6),
      bounds.halfHeight / Math.max(Math.abs(sin), 1e-6),
    ) * 1.02
  );
}

function buildAbsorbedBurnStar(
  absorbedTokenId: number,
  receiverTokenId: number,
  position: [number, number, number],
  tier: AbsorbedBurnTier,
): AbsorbedBurnStar {
  const rng = createRng(receiverTokenId * 53_911 + absorbedTokenId * 1_009);
  const scale = BASE_SIZE * tier.sizeMult;
  const color = COLOR_RED_ORANGE.clone().lerp(COLOR_EMBER, rng());

  return {
    absorbedTokenId,
    position,
    color,
    coreSize: 0.78 * scale,
    glowSize: 0.95 * scale,
    glowOpacity: tier.glowOpacity,
    brightness: tier.brightness,
    twinklePhase: rng() * Math.PI * 2,
    twinkleSpeed: (Math.PI * 2) / (4 + rng() * 5),
    twinkleLift: 0.35,
  };
}

function sampleLiveViewportPosition(
  rng: () => number,
  visibleWidth: number,
  visibleHeight: number,
): [number, number] {
  return [
    (rng() - 0.5) * visibleWidth * 1.1,
    (rng() - 0.5) * visibleHeight * 1.1,
  ];
}

function sampleExportFewPosition(
  rng: () => number,
  visibleWidth: number,
  visibleHeight: number,
  bounds: ReturnType<typeof constellationExclusionBounds>,
): [number, number] {
  for (let attempt = 0; attempt < MAX_EXPORT_PLACEMENT_ATTEMPTS; attempt++) {
    const x = (rng() - 0.5) * visibleWidth * 0.96;
    const y = (rng() - 0.5) * visibleHeight * 0.96;
    if (!isInsideConstellation(x, y, bounds)) {
      return [x, y];
    }
  }

  const angle = rng() * Math.PI * 2;
  const radius =
    minRadiusOutsideConstellation(angle, bounds) * (1.08 + rng() * 0.2);
  return [Math.cos(angle) * radius, bounds.centerY + Math.sin(angle) * radius];
}

function sampleExportMediumPosition(
  rng: () => number,
  visibleHeight: number,
  bounds: ReturnType<typeof constellationExclusionBounds>,
): [number, number] {
  const maxRadius = visibleHeight * 0.48;
  const angle = rng() * Math.PI * 2;
  const minRadius = minRadiusOutsideConstellation(angle, bounds);

  if (minRadius >= maxRadius) {
    const radius = maxRadius * (0.9 + rng() * 0.1);
    return [Math.cos(angle) * radius, bounds.centerY + Math.sin(angle) * radius];
  }

  const min2 = minRadius * minRadius;
  const max2 = maxRadius * maxRadius;
  const radius = Math.sqrt(min2 + rng() * (max2 - min2));

  return [Math.cos(angle) * radius, bounds.centerY + Math.sin(angle) * radius];
}

function sampleExportManyPosition(
  rng: () => number,
  visibleWidth: number,
  visibleHeight: number,
  totalCount: number,
): [number, number] {
  const spread = totalCount >= 100 ? 1.05 : 0.98;
  return [
    (rng() - 0.5) * visibleWidth * spread,
    (rng() - 0.5) * visibleHeight * spread,
  ];
}

/** Live scene — free scatter across the full viewport. */
export function generateAbsorbedBurnStars(
  receiverTokenId: number,
  absorbedTokenIds: number[],
  aspect: number,
): AbsorbedBurnStar[] {
  const { visibleHeight, visibleWidth } = visibleDimensions(aspect);
  const tier = absorbedBurnTier(absorbedTokenIds.length);

  return absorbedTokenIds.map((absorbedTokenId) => {
    const rng = createRng(receiverTokenId * 53_911 + absorbedTokenId * 1_009);
    const [x, y] = sampleLiveViewportPosition(rng, visibleWidth, visibleHeight);

    return buildAbsorbedBurnStar(
      absorbedTokenId,
      receiverTokenId,
      [x, y, 0.08],
      tier,
    );
  });
}

/** Download only — tiered placement for the 1200×1200 export frame. */
export function generateAbsorbedBurnStarsForExport(
  receiverTokenId: number,
  absorbedTokenIds: number[],
): AbsorbedBurnStar[] {
  const { visibleHeight, visibleWidth } = visibleDimensions(1);
  const totalCount = absorbedTokenIds.length;
  const tier = absorbedBurnTier(totalCount);
  const bounds = constellationExclusionBounds(visibleHeight);

  return absorbedTokenIds.map((absorbedTokenId) => {
    const rng = createRng(receiverTokenId * 53_911 + absorbedTokenId * 1_009);

    let x: number;
    let y: number;

    if (totalCount <= 5) {
      [x, y] = sampleExportFewPosition(rng, visibleWidth, visibleHeight, bounds);
    } else if (totalCount <= 30) {
      [x, y] = sampleExportMediumPosition(rng, visibleHeight, bounds);
    } else {
      [x, y] = sampleExportManyPosition(
        rng,
        visibleWidth,
        visibleHeight,
        totalCount,
      );
    }

    return buildAbsorbedBurnStar(
      absorbedTokenId,
      receiverTokenId,
      [x, y, 0.08],
      tier,
    );
  });
}
