import * as THREE from "three";
import { DEFAULT_CAMERA_FOV } from "@/lib/universe/cameraConfig";
import {
  createConstellationStarPointMaterial,
  createHolderStarPointMaterial,
} from "@/lib/universe/holderStarPointShader";
import { createRng } from "@/lib/universe/seededRandom";
import type {
  ConstellationData,
  ConstellationStar,
  StarTint,
} from "@/lib/universe/generateConstellation";

const EXPORT_SIZE = 1200;
const EXPORT_BACKGROUND = "#080d18";
const BRIGHTNESS_EXPORT_MULT = 1.5;
const FRAME_FRACTION = 0.7;
const GRID_SIZE = 40;
const CAMERA_Z = 50;
const Y_OFFSET_FRACTION = 0.05;
const BASE_SIZE = 3.5;

const FIELD_LAYERS = [
  {
    count: 12000,
    seedOffset: 11,
    brightness: [0.04, 0.18] as [number, number],
    size: [0.1, 0.25] as [number, number],
  },
  {
    count: 3000,
    seedOffset: 23,
    brightness: [0.18, 0.38] as [number, number],
    size: [0.2, 0.5] as [number, number],
  },
  {
    count: 300,
    seedOffset: 37,
    brightness: [0.4, 0.75] as [number, number],
    size: [0.4, 0.85] as [number, number],
  },
] as const;

type FieldStar = {
  x: number;
  y: number;
  z: number;
  brightness: number;
  size: number;
};

const COLOR_COOL = new THREE.Color("#E8F4FF");
const COLOR_WHITE = new THREE.Color("#FFFFFF");
const COLOR_WARM = new THREE.Color("#FFF8F0");

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
    brightness: star.brightness * BRIGHTNESS_EXPORT_MULT,
  };
}

function buildExportGeometry(stars: ConstellationStar[], sizeScale: number) {
  const positions = new Float32Array(stars.length * 3);
  const colors = new Float32Array(stars.length * 3);
  const coreSizes = new Float32Array(stars.length);
  const glowSizes = new Float32Array(stars.length);
  const glowOpacities = new Float32Array(stars.length);
  const sparkles = new Float32Array(stars.length);
  const brightness = new Float32Array(stars.length);
  const reveal = new Float32Array(stars.length);

  stars.forEach((star, i) => {
    positions[i * 3] = star.x;
    positions[i * 3 + 1] = star.y;
    positions[i * 3 + 2] = 0;

    const visual = stardustVisual(star, sizeScale);
    const color = tintColor(star.tint, Math.min(1, visual.brightness));

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    coreSizes[i] = visual.coreSize;
    glowSizes[i] = visual.glowSize;
    glowOpacities[i] = visual.glowOpacity;
    sparkles[i] = 0;
    brightness[i] = visual.brightness;
    reveal[i] = 1;
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
  geometry.setAttribute("aReveal", new THREE.BufferAttribute(reveal, 1));

  return geometry;
}

function bleedVisual(star: FieldStar) {
  const scale = BASE_SIZE * star.size;
  return {
    coreSize: 0.7 * scale,
    glowSize: 0.85 * scale,
    glowOpacity: 0.06,
    sparkle: 0,
    brightness: star.brightness * BRIGHTNESS_EXPORT_MULT,
  };
}

function generateFieldStars(tokenId: number, aspect: number): FieldStar[] {
  const fovRad = (DEFAULT_CAMERA_FOV * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(fovRad / 2) * CAMERA_Z;
  const visibleWidth = visibleHeight * aspect;
  const stars: FieldStar[] = [];

  for (const layer of FIELD_LAYERS) {
    const rng = createRng(tokenId * 41_973 + layer.seedOffset);

    for (let i = 0; i < layer.count; i++) {
      stars.push({
        x: (rng() - 0.5) * visibleWidth * 1.1,
        y: (rng() - 0.5) * visibleHeight * 1.1,
        z: 0,
        brightness:
          layer.brightness[0] +
          rng() * (layer.brightness[1] - layer.brightness[0]),
        size: layer.size[0] + rng() * (layer.size[1] - layer.size[0]),
      });
    }
  }

  return stars;
}

function buildFieldExportGeometry(fieldStars: FieldStar[]) {
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
    const color = COLOR_COOL.clone().lerp(
      COLOR_WHITE,
      Math.min(1, visual.brightness * 0.35),
    );

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

function normiesFontFamily(): string {
  const probe = document.createElement("span");
  probe.className = "normie-universe-title";
  probe.textContent = "A";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily;
  document.body.removeChild(probe);
  return family;
}

function downloadCanvas(canvas: HTMLCanvasElement, tokenId: number) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `normie-${tokenId}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

export async function exportConstellationImage(
  constellation: ConstellationData,
  tokenId: number,
): Promise<void> {
  if (constellation.stars.length === 0) return;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(EXPORT_SIZE, EXPORT_SIZE);
  renderer.setClearColor(EXPORT_BACKGROUND, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(EXPORT_BACKGROUND);

  const camera = new THREE.PerspectiveCamera(
    DEFAULT_CAMERA_FOV,
    1,
    0.01,
    10000,
  );
  camera.position.set(0, 0, CAMERA_Z);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  const fovRad = (DEFAULT_CAMERA_FOV * Math.PI) / 180;
  const visibleHeight = 2 * Math.tan(fovRad / 2) * CAMERA_Z;
  const targetHeight = visibleHeight * FRAME_FRACTION;
  const scale = targetHeight / GRID_SIZE;
  const yOffset = visibleHeight * Y_OFFSET_FRACTION;

  const geometry = buildExportGeometry(
    constellation.stars,
    constellation.sizeScale,
  );
  const material = createConstellationStarPointMaterial(true);
  material.uniforms.uLowDpiBoost.value = 0;

  const fieldGeometry = buildFieldExportGeometry(
    generateFieldStars(tokenId, 1),
  );
  const fieldMaterial = createHolderStarPointMaterial(true);
  const fieldPoints = new THREE.Points(fieldGeometry, fieldMaterial);
  fieldPoints.frustumCulled = false;
  fieldPoints.renderOrder = 1;
  scene.add(fieldPoints);

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 2;
  const scaled = new THREE.Group();
  scaled.scale.set(scale, scale, 1);
  scaled.add(points);

  const root = new THREE.Group();
  root.position.set(0, yOffset, 0);
  root.add(scaled);
  scene.add(root);

  renderer.render(scene, camera);

  const output = document.createElement("canvas");
  output.width = EXPORT_SIZE;
  output.height = EXPORT_SIZE;
  const ctx = output.getContext("2d");
  if (!ctx) {
    fieldGeometry.dispose();
    fieldMaterial.dispose();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    return;
  }

  ctx.drawImage(renderer.domElement, 0, 0);

  await document.fonts.ready;
  const padding = 36;
  const fontSize = 22;
  ctx.font = `${fontSize}px ${normiesFontFamily()}`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";
  ctx.fillText("NORMIES UNIVERSE", padding, EXPORT_SIZE - padding);
  ctx.textAlign = "right";
  ctx.fillText(`#${tokenId}`, EXPORT_SIZE - padding, EXPORT_SIZE - padding);

  downloadCanvas(output, tokenId);

  fieldGeometry.dispose();
  fieldMaterial.dispose();
  geometry.dispose();
  material.dispose();
  renderer.dispose();
}
