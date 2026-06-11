"use client";

import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { DEFAULT_CAMERA_FOV } from "@/lib/universe/cameraConfig";
import { createHolderStarPointMaterial } from "@/lib/universe/holderStarPointShader";
import { createRng } from "@/lib/universe/seededRandom";
import type {
  ConstellationData,
  ConstellationStar,
  StarTint,
} from "@/lib/universe/generateConstellation";

const COLOR_COOL = new THREE.Color("#E8F4FF");
const COLOR_WHITE = new THREE.Color("#FFFFFF");
const COLOR_WARM = new THREE.Color("#FFF8F0");
const BASE_SIZE = 3.5;
const BLEED_STAR_COUNT = 800;
const CAMERA_Z = 50;

type BleedStar = {
  x: number;
  y: number;
  brightness: number;
  size: number;
};

function tintColor(tint: StarTint, brightness: number) {
  switch (tint) {
    case "white":
      return COLOR_WHITE.clone().multiplyScalar(0.85 + brightness * 0.15);
    case "warm":
      return COLOR_WARM.clone().lerp(COLOR_WHITE, brightness * 0.4);
    default:
      return COLOR_COOL.clone().lerp(COLOR_WHITE, brightness);
  }
}

function stardustVisual(star: ConstellationStar, sizeScale: number) {
  const scale = BASE_SIZE * sizeScale * star.size;
  return {
    coreSize: 0.85 * scale,
    glowSize: 1.0 * scale,
    glowOpacity: 0.1,
    sparkle: 0,
    brightness: star.brightness,
  };
}

function bleedVisual(star: BleedStar) {
  const scale = BASE_SIZE * star.size;
  return {
    coreSize: 0.7 * scale,
    glowSize: 0.85 * scale,
    glowOpacity: 0.06,
    sparkle: 0,
    brightness: star.brightness,
  };
}

function generateBleedStars(tokenId: number, aspect: number): BleedStar[] {
  const rng = createRng(tokenId * 41_973 + 17);
  const fovRad = (DEFAULT_CAMERA_FOV * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(fovRad / 2) * CAMERA_Z;
  const visibleWidth = visibleHeight * aspect;
  const bleed: BleedStar[] = [];

  for (let i = 0; i < BLEED_STAR_COUNT; i++) {
    bleed.push({
      x: (rng() - 0.5) * visibleWidth * 1.1,
      y: (rng() - 0.5) * visibleHeight * 1.1,
      brightness: 0.05 + rng() * 0.25,
      size: 0.15 + rng() * 0.75,
    });
  }

  return bleed;
}

function buildGeometry(stars: ConstellationStar[], sizeScale: number) {
  const positions = new Float32Array(stars.length * 3);
  const colors = new Float32Array(stars.length * 3);
  const coreSizes = new Float32Array(stars.length);
  const glowSizes = new Float32Array(stars.length);
  const glowOpacities = new Float32Array(stars.length);
  const sparkles = new Float32Array(stars.length);
  const brightness = new Float32Array(stars.length);

  stars.forEach((star, i) => {
    positions[i * 3] = star.x;
    positions[i * 3 + 1] = star.y;
    positions[i * 3 + 2] = 0;

    const visual = stardustVisual(star, sizeScale);
    const color = tintColor(star.tint, visual.brightness);

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    coreSizes[i] = visual.coreSize;
    glowSizes[i] = visual.glowSize;
    glowOpacities[i] = visual.glowOpacity;
    sparkles[i] = 0;
    brightness[i] = visual.brightness;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aCoreSize", new THREE.BufferAttribute(coreSizes, 1));
  geometry.setAttribute("aGlowSize", new THREE.BufferAttribute(glowSizes, 1));
  geometry.setAttribute(
    "aGlowOpacity",
    new THREE.BufferAttribute(glowOpacities, 1),
  );
  geometry.setAttribute("aSparkle", new THREE.BufferAttribute(sparkles, 1));
  geometry.setAttribute(
    "aBrightness",
    new THREE.BufferAttribute(brightness, 1),
  );

  return geometry;
}

function buildBleedGeometry(bleedStars: BleedStar[]) {
  const positions = new Float32Array(bleedStars.length * 3);
  const colors = new Float32Array(bleedStars.length * 3);
  const coreSizes = new Float32Array(bleedStars.length);
  const glowSizes = new Float32Array(bleedStars.length);
  const glowOpacities = new Float32Array(bleedStars.length);
  const sparkles = new Float32Array(bleedStars.length);
  const brightness = new Float32Array(bleedStars.length);

  bleedStars.forEach((star, i) => {
    positions[i * 3] = star.x;
    positions[i * 3 + 1] = star.y;
    positions[i * 3 + 2] = 0;

    const visual = bleedVisual(star);
    const color = COLOR_COOL.clone().lerp(COLOR_WHITE, visual.brightness * 0.35);

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    coreSizes[i] = visual.coreSize;
    glowSizes[i] = visual.glowSize;
    glowOpacities[i] = visual.glowOpacity;
    sparkles[i] = 0;
    brightness[i] = visual.brightness;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aCoreSize", new THREE.BufferAttribute(coreSizes, 1));
  geometry.setAttribute("aGlowSize", new THREE.BufferAttribute(glowSizes, 1));
  geometry.setAttribute(
    "aGlowOpacity",
    new THREE.BufferAttribute(glowOpacities, 1),
  );
  geometry.setAttribute("aSparkle", new THREE.BufferAttribute(sparkles, 1));
  geometry.setAttribute(
    "aBrightness",
    new THREE.BufferAttribute(brightness, 1),
  );

  return geometry;
}

export function ConstellationFace({
  constellation,
}: {
  constellation: ConstellationData;
}) {
  const material = useMemo(() => createHolderStarPointMaterial(true), []);
  const geometry = useMemo(
    () => buildGeometry(constellation.stars, constellation.sizeScale),
    [constellation.stars, constellation.sizeScale],
  );

  if (constellation.stars.length === 0) return null;

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}

export function ViewportBleedStars({ tokenId }: { tokenId: number }) {
  const { size } = useThree();
  const material = useMemo(() => createHolderStarPointMaterial(true), []);

  const bleedStars = useMemo(
    () => generateBleedStars(tokenId, size.width / size.height),
    [tokenId, size.width, size.height],
  );

  const geometry = useMemo(
    () => buildBleedGeometry(bleedStars),
    [bleedStars],
  );

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={1}
    />
  );
}
