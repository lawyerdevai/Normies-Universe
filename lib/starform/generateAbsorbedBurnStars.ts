import * as THREE from "three";
import { DEFAULT_CAMERA_FOV } from "@/lib/universe/cameraConfig";
import { createRng } from "@/lib/universe/seededRandom";

const BASE_SIZE = 3.5;
const CAMERA_Z = 50;
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

export function generateAbsorbedBurnStars(
  receiverTokenId: number,
  absorbedTokenIds: number[],
  aspect: number,
): AbsorbedBurnStar[] {
  const fovRad = (DEFAULT_CAMERA_FOV * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(fovRad / 2) * CAMERA_Z;
  const visibleWidth = visibleHeight * aspect;

  return absorbedTokenIds.map((absorbedTokenId) => {
    const rng = createRng(receiverTokenId * 53_911 + absorbedTokenId * 1_009);
    const size = 0.55 + rng() * 0.4;
    const scale = BASE_SIZE * size;
    const color = COLOR_RED_ORANGE.clone().lerp(COLOR_EMBER, rng());
    const brightness = 0.42 + rng() * 0.28;

    return {
      absorbedTokenId,
      position: [
        (rng() - 0.5) * visibleWidth * 1.1,
        (rng() - 0.5) * visibleHeight * 1.1,
        0.08,
      ],
      color,
      coreSize: 0.78 * scale,
      glowSize: 0.95 * scale,
      glowOpacity: 0.14,
      brightness,
      twinklePhase: rng() * Math.PI * 2,
      twinkleSpeed: (Math.PI * 2) / (4 + rng() * 5),
      twinkleLift: 0.35,
    };
  });
}
