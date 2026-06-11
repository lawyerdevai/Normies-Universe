"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
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
const CAMERA_Z = 50;

const FIELD_LAYERS = [
  {
    count: 5000,
    seedOffset: 11,
    brightness: [0.05, 0.15] as [number, number],
    size: [0.1, 0.25] as [number, number],
    twinkleRate: 0,
  },
  {
    count: 1200,
    seedOffset: 23,
    brightness: [0.15, 0.32] as [number, number],
    size: [0.2, 0.5] as [number, number],
    twinkleRate: 0.15,
    twinkleLift: 0.6,
    twinkleCycle: [2, 5] as [number, number],
  },
  {
    count: 150,
    seedOffset: 37,
    brightness: [0.35, 0.65] as [number, number],
    size: [0.4, 0.85] as [number, number],
    twinkleRate: 0.15,
    twinkleLift: 0.6,
    twinkleCycle: [2, 5] as [number, number],
  },
] as const;

const CONSTELLATION_TWINKLE_RATE = 0.12;
const CONSTELLATION_TWINKLE_LIFT = 0.5;
const CONSTELLATION_TWINKLE_CYCLE = [3, 7] as const;

type FieldStar = {
  x: number;
  y: number;
  z: number;
  brightness: number;
  size: number;
};

type TwinkleEntry = {
  index: number;
  baseBrightness: number;
  phase: number;
  speed: number;
  lift: number;
};

function twinkleSpeed(cycleMin: number, cycleMax: number, rng: () => number) {
  return (Math.PI * 2) / (cycleMin + rng() * (cycleMax - cycleMin));
}

function applyTwinkle(
  geometry: THREE.BufferGeometry,
  entries: TwinkleEntry[],
  elapsed: number,
) {
  if (entries.length === 0) return;

  const attr = geometry.getAttribute("aBrightness") as THREE.BufferAttribute;
  if (!attr) return;

  let dirty = false;

  for (const entry of entries) {
    const lift = Math.max(0, Math.sin(elapsed * entry.speed + entry.phase));
    const next = entry.baseBrightness * (1.0 + lift * entry.lift);
    if (attr.getX(entry.index) !== next) {
      attr.setX(entry.index, next);
      dirty = true;
    }
  }

  if (dirty) attr.needsUpdate = true;
}

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

function bleedVisual(star: FieldStar) {
  const scale = BASE_SIZE * star.size;
  return {
    coreSize: 0.7 * scale,
    glowSize: 0.85 * scale,
    glowOpacity: 0.06,
    sparkle: 0,
    brightness: star.brightness,
  };
}

function generateFieldStars(
  tokenId: number,
  aspect: number,
): { stars: FieldStar[]; twinkle: TwinkleEntry[] } {
  const fovRad = (DEFAULT_CAMERA_FOV * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(fovRad / 2) * CAMERA_Z;
  const visibleWidth = visibleHeight * aspect;
  const stars: FieldStar[] = [];
  const twinkle: TwinkleEntry[] = [];

  for (const layer of FIELD_LAYERS) {
    const rng = createRng(tokenId * 41_973 + layer.seedOffset);

    for (let i = 0; i < layer.count; i++) {
      const brightness =
        layer.brightness[0] +
        rng() * (layer.brightness[1] - layer.brightness[0]);
      const size = layer.size[0] + rng() * (layer.size[1] - layer.size[0]);
      const index = stars.length;

      stars.push({
        x: (rng() - 0.5) * visibleWidth * 1.1,
        y: (rng() - 0.5) * visibleHeight * 1.1,
        z: 0,
        brightness,
        size,
      });

      if (
        "twinkleLift" in layer &&
        layer.twinkleRate > 0 &&
        rng() < layer.twinkleRate
      ) {
        twinkle.push({
          index,
          baseBrightness: brightness,
          phase: rng() * Math.PI * 2,
          speed: twinkleSpeed(layer.twinkleCycle[0], layer.twinkleCycle[1], rng),
          lift: layer.twinkleLift,
        });
      }
    }
  }

  return { stars, twinkle };
}

function generateConstellationTwinkle(
  stars: ConstellationStar[],
  tokenId: number,
): TwinkleEntry[] {
  const rng = createRng(tokenId * 61_331 + 91);
  const twinkle: TwinkleEntry[] = [];

  for (let i = 0; i < stars.length; i++) {
    if (rng() >= CONSTELLATION_TWINKLE_RATE) continue;
    twinkle.push({
      index: i,
      baseBrightness: stars[i].brightness,
      phase: rng() * Math.PI * 2,
      speed: twinkleSpeed(
        CONSTELLATION_TWINKLE_CYCLE[0],
        CONSTELLATION_TWINKLE_CYCLE[1],
        rng,
      ),
      lift: CONSTELLATION_TWINKLE_LIFT,
    });
  }

  return twinkle;
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

function buildFieldGeometry(fieldStars: FieldStar[]) {
  const positions = new Float32Array(fieldStars.length * 3);
  const colors = new Float32Array(fieldStars.length * 3);
  const coreSizes = new Float32Array(fieldStars.length);
  const glowSizes = new Float32Array(fieldStars.length);
  const glowOpacities = new Float32Array(fieldStars.length);
  const sparkles = new Float32Array(fieldStars.length);
  const brightness = new Float32Array(fieldStars.length);

  fieldStars.forEach((star, i) => {
    positions[i * 3] = star.x;
    positions[i * 3 + 1] = star.y;
    positions[i * 3 + 2] = star.z;

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
  tokenId,
}: {
  constellation: ConstellationData;
  tokenId: number;
}) {
  const material = useMemo(() => createHolderStarPointMaterial(true), []);
  const twinkleRef = useRef<TwinkleEntry[]>([]);

  const geometry = useMemo(
    () => buildGeometry(constellation.stars, constellation.sizeScale),
    [constellation.stars, constellation.sizeScale],
  );

  const twinkle = useMemo(
    () => generateConstellationTwinkle(constellation.stars, tokenId),
    [constellation.stars, tokenId],
  );

  twinkleRef.current = twinkle;

  useFrame(({ clock }) => {
    applyTwinkle(geometry, twinkleRef.current, clock.elapsedTime);
  });

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
  const twinkleRef = useRef<TwinkleEntry[]>([]);

  const fieldData = useMemo(
    () => generateFieldStars(tokenId, size.width / size.height),
    [tokenId, size.width, size.height],
  );

  twinkleRef.current = fieldData.twinkle;

  const geometry = useMemo(
    () => buildFieldGeometry(fieldData.stars),
    [fieldData.stars],
  );

  useFrame(({ clock }) => {
    applyTwinkle(geometry, twinkleRef.current, clock.elapsedTime);
  });

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={1}
    />
  );
}
