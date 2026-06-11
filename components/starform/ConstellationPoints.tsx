"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
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
    count: 12000,
    seedOffset: 11,
    brightness: [0.04, 0.18] as [number, number],
    size: [0.1, 0.25] as [number, number],
    twinkleRate: 0,
  },
  {
    count: 3000,
    seedOffset: 23,
    brightness: [0.18, 0.38] as [number, number],
    size: [0.2, 0.5] as [number, number],
    twinkleRate: 0.25,
    twinkleLift: 0.8,
    twinkleCycle: [1.5, 4] as [number, number],
  },
  {
    count: 300,
    seedOffset: 37,
    brightness: [0.4, 0.75] as [number, number],
    size: [0.4, 0.85] as [number, number],
    twinkleRate: 0.25,
    twinkleLift: 0.8,
    twinkleCycle: [1.5, 4] as [number, number],
  },
] as const;

const PULSE_RATE = 0.2;
const PULSE_LIFT = 0.5;
const PULSE_CYCLE = [4, 8] as const;
const BLINK_RATE = 0.08;
const BLINK_INTERVAL = [6, 12] as const;
const BLINK_RISE_SECONDS = 0.3;
const BLINK_FALL_SECONDS = 0.8;
const BLINK_PEAK_MULTIPLIER = 2;
const FADE_RATE = 0.05;
const FADE_MIN_MULTIPLIER = 0.15;
const FADE_HALF_CYCLE_SECONDS = 3;

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

type PulseEffect = {
  index: number;
  phase: number;
  speed: number;
};

type BlinkEffect = {
  index: number;
  nextBlinkAt: number;
  blinkStart: number;
  nextInterval: () => number;
};

type FadeEffect = {
  index: number;
  phase: number;
};

type ConstellationLife = {
  bases: Float32Array;
  pulses: PulseEffect[];
  blinks: BlinkEffect[];
  fades: FadeEffect[];
  affected: Uint8Array;
};

function cycleSpeed(cycleMin: number, cycleMax: number, rng: () => number) {
  return (Math.PI * 2) / (cycleMin + rng() * (cycleMax - cycleMin));
}

function applyFieldTwinkle(
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

function blinkMultiplier(elapsed: number, blinkStart: number) {
  const t = elapsed - blinkStart;
  if (t < BLINK_RISE_SECONDS) {
    const p = t / BLINK_RISE_SECONDS;
    return 1 + p * (BLINK_PEAK_MULTIPLIER - 1);
  }
  const fallDuration = BLINK_RISE_SECONDS + BLINK_FALL_SECONDS;
  if (t < fallDuration) {
    const p = (t - BLINK_RISE_SECONDS) / BLINK_FALL_SECONDS;
    return BLINK_PEAK_MULTIPLIER - p * (BLINK_PEAK_MULTIPLIER - 1);
  }
  return 1;
}

function fadeMultiplier(elapsed: number, phase: number) {
  const period = FADE_HALF_CYCLE_SECONDS * 2;
  const t = ((elapsed + phase) % period) / period;
  if (t < 0.5) {
    const p = t * 2;
    return 1 - p * (1 - FADE_MIN_MULTIPLIER);
  }
  const p = (t - 0.5) * 2;
  return FADE_MIN_MULTIPLIER + p * (1 - FADE_MIN_MULTIPLIER);
}

function applyConstellationLife(
  geometry: THREE.BufferGeometry,
  life: ConstellationLife,
  elapsed: number,
) {
  if (life.affected.length === 0) return;

  const attr = geometry.getAttribute("aBrightness") as THREE.BufferAttribute;
  if (!attr) return;

  const multipliers = new Float32Array(life.bases.length).fill(1);

  for (const pulse of life.pulses) {
    const lift = Math.max(0, Math.sin(elapsed * pulse.speed + pulse.phase));
    multipliers[pulse.index] *= 1 + PULSE_LIFT * lift;
  }

  for (const blink of life.blinks) {
    if (blink.blinkStart < 0 && elapsed >= blink.nextBlinkAt) {
      blink.blinkStart = elapsed;
    }
    if (blink.blinkStart >= 0) {
      multipliers[blink.index] *= blinkMultiplier(elapsed, blink.blinkStart);
      if (elapsed - blink.blinkStart >= BLINK_RISE_SECONDS + BLINK_FALL_SECONDS) {
        blink.blinkStart = -1;
        blink.nextBlinkAt = elapsed + blink.nextInterval();
      }
    }
  }

  for (const fade of life.fades) {
    multipliers[fade.index] *= fadeMultiplier(elapsed, fade.phase);
  }

  let dirty = false;

  for (let i = 0; i < life.bases.length; i++) {
    if (!life.affected[i]) continue;
    const next = life.bases[i] * multipliers[i];
    if (attr.getX(i) !== next) {
      attr.setX(i, next);
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
          speed: cycleSpeed(layer.twinkleCycle[0], layer.twinkleCycle[1], rng),
          lift: layer.twinkleLift,
        });
      }
    }
  }

  return { stars, twinkle };
}

function generateConstellationLife(
  stars: ConstellationStar[],
  tokenId: number,
): ConstellationLife {
  const rng = createRng(tokenId * 61_331 + 91);
  const bases = new Float32Array(stars.length);
  const affected = new Uint8Array(stars.length);
  const pulses: PulseEffect[] = [];
  const blinks: BlinkEffect[] = [];
  const fades: FadeEffect[] = [];

  for (let i = 0; i < stars.length; i++) {
    bases[i] = stars[i].brightness;

    if (rng() < PULSE_RATE) {
      affected[i] = 1;
      pulses.push({
        index: i,
        phase: rng() * Math.PI * 2,
        speed: cycleSpeed(PULSE_CYCLE[0], PULSE_CYCLE[1], rng),
      });
    }

    if (rng() < BLINK_RATE) {
      affected[i] = 1;
      const blinkRng = createRng(tokenId * 97_003 + i * 131);
      blinks.push({
        index: i,
        nextBlinkAt: blinkRng() * BLINK_INTERVAL[1],
        blinkStart: -1,
        nextInterval: () =>
          BLINK_INTERVAL[0] +
          blinkRng() * (BLINK_INTERVAL[1] - BLINK_INTERVAL[0]),
      });
    }

    if (rng() < FADE_RATE) {
      affected[i] = 1;
      fades.push({
        index: i,
        phase: rng() * FADE_HALF_CYCLE_SECONDS * 2,
      });
    }
  }

  return { bases, pulses, blinks, fades, affected };
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
  materialRef,
}: {
  constellation: ConstellationData;
  tokenId: number;
  materialRef?: MutableRefObject<THREE.ShaderMaterial | null>;
}) {
  const material = useMemo(() => {
    const next = createHolderStarPointMaterial(true);
    next.opacity = 0;
    return next;
  }, []);

  useEffect(() => {
    if (!materialRef) return;
    materialRef.current = material;
    return () => {
      materialRef.current = null;
    };
  }, [material, materialRef]);
  const lifeRef = useRef<ConstellationLife | null>(null);

  const geometry = useMemo(
    () => buildGeometry(constellation.stars, constellation.sizeScale),
    [constellation.stars, constellation.sizeScale],
  );

  const life = useMemo(
    () => generateConstellationLife(constellation.stars, tokenId),
    [constellation.stars, tokenId],
  );

  lifeRef.current = life;

  useFrame(({ clock }) => {
    if (!lifeRef.current) return;
    applyConstellationLife(geometry, lifeRef.current, clock.elapsedTime);
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
    applyFieldTwinkle(geometry, twinkleRef.current, clock.elapsedTime);
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
