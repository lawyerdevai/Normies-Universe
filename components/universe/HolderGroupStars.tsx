"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  hitRadiusForVisual,
  normieRangeFromStars,
  visualFromHoldings,
  type HolderStarVisual,
} from "@/lib/universe/holderStarVisual";
import type { HolderGroupStar } from "@/types/universe";

export type HolderGroupStarsDebugLayers = {
  visible: boolean;
  glow: boolean;
  hits: boolean;
};

interface HolderGroupStarsProps {
  groups: HolderGroupStar[];
  hoveredId: string | null;
  pulseWallet?: string | null;
  pulseKey?: number;
  reducedMotion?: boolean;
  debugLayers?: HolderGroupStarsDebugLayers;
  hoverRef?: React.RefObject<HolderGroupStar | null>;
  onHover: (
    group: HolderGroupStar | null,
    screenPos?: { x: number; y: number },
  ) => void;
}

const _projected = new THREE.Vector3();
const _viewPos = new THREE.Vector3();

/** Screen-pixel radius matching the visible point sprite (core + glow). */
function visibleStarPixelRadius(
  visual: HolderStarVisual,
  position: [number, number, number],
  camera: THREE.Camera,
  showGlow: boolean,
) {
  _viewPos.set(...position).applyMatrix4(camera.matrixWorldInverse);
  const z = Math.max(0.1, -_viewPos.z);
  const worldSize =
    visual.coreSize + visual.glowSize * visual.glowOpacity * (showGlow ? 1 : 0);
  const pointSize = Math.min(88, Math.max(3, worldSize * (235 / z)));
  return pointSize * 0.47;
}

function pickNearestGroup(
  pointer: THREE.Vector2,
  camera: THREE.Camera,
  viewport: { width: number; height: number },
  groups: HolderGroupStar[],
  visuals: HolderStarVisual[],
  showGlow: boolean,
) {
  const px = (pointer.x * 0.5 + 0.5) * viewport.width;
  const py = (-pointer.y * 0.5 + 0.5) * viewport.height;

  let bestIndex = -1;
  let bestDist = Infinity;

  for (let i = 0; i < groups.length; i++) {
    _projected.set(...groups[i].position).project(camera);
    if (_projected.z > 1) continue;

    const sx = (_projected.x * 0.5 + 0.5) * viewport.width;
    const sy = (-_projected.y * 0.5 + 0.5) * viewport.height;
    const dist = Math.hypot(sx - px, sy - py);
    const hitRadius = visibleStarPixelRadius(
      visuals[i],
      groups[i].position,
      camera,
      showGlow,
    );

    if (dist <= hitRadius && dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }

  return bestIndex >= 0 ? groups[bestIndex] : null;
}

function pointerScreenPos(
  pointer: THREE.Vector2,
  viewport: { width: number; height: number },
  canvasRect: DOMRect,
) {
  return {
    x: canvasRect.left + (pointer.x * 0.5 + 0.5) * viewport.width,
    y: canvasRect.top + (-pointer.y * 0.5 + 0.5) * viewport.height,
  };
}

type BandVisual = {
  coreMin: number;
  coreMax: number;
  glowMin: number;
  glowMax: number;
  glowOpMin: number;
  glowOpMax: number;
  sparkleMin: number;
  sparkleMax: number;
  brightMin: number;
  brightMax: number;
};

const RANK_BAND_VISUAL: BandVisual[] = [
  { coreMin: 6.5, coreMax: 9.5, glowMin: 12, glowMax: 20, glowOpMin: 0.36, glowOpMax: 0.5, sparkleMin: 0.52, sparkleMax: 0.72, brightMin: 1.1, brightMax: 1.4 },
  { coreMin: 5.5, coreMax: 7.5, glowMin: 9, glowMax: 15, glowOpMin: 0.3, glowOpMax: 0.42, sparkleMin: 0.45, sparkleMax: 0.6, brightMin: 1.0, brightMax: 1.25 },
  { coreMin: 4.5, coreMax: 6.2, glowMin: 7, glowMax: 12, glowOpMin: 0.24, glowOpMax: 0.34, sparkleMin: 0.38, sparkleMax: 0.52, brightMin: 0.92, brightMax: 1.12 },
  { coreMin: 3.8, coreMax: 5.2, glowMin: 5.5, glowMax: 9, glowOpMin: 0.2, glowOpMax: 0.28, sparkleMin: 0.32, sparkleMax: 0.45, brightMin: 0.85, brightMax: 1.02 },
  { coreMin: 3.2, coreMax: 4.5, glowMin: 4.5, glowMax: 7.5, glowOpMin: 0.17, glowOpMax: 0.24, sparkleMin: 0.28, sparkleMax: 0.4, brightMin: 0.78, brightMax: 0.95 },
];

function rankBand(rankStart: number) {
  if (rankStart <= 50) return 0;
  if (rankStart <= 100) return 1;
  if (rankStart <= 300) return 2;
  if (rankStart <= 800) return 3;
  return 4;
}

function lerpRange(lo: number, hi: number, t: number) {
  return lo + (hi - lo) * t;
}

function starVisual(
  group: HolderGroupStar,
  index: number,
  normieRange: { min: number; max: number } | null,
) {
  if (group.collectionRank !== undefined && normieRange) {
    return visualFromHoldings(
      group.totalNormies,
      normieRange.min,
      normieRange.max,
      group.collectionRank,
    );
  }

  const rankT = 1 - (group.rankStart - 1) / 1890;
  const band = RANK_BAND_VISUAL[rankBand(group.rankStart)];
  const bandT = rankT * 0.65 + ((index * 0.618) % 1) * 0.35;

  return {
    coreSize: lerpRange(band.coreMin, band.coreMax, bandT),
    glowSize: lerpRange(band.glowMin, band.glowMax, bandT),
    glowOpacity: lerpRange(band.glowOpMin, band.glowOpMax, bandT),
    sparkle: lerpRange(band.sparkleMin, band.sparkleMax, bandT),
    brightness:
      group.brightness *
      lerpRange(band.brightMin, band.brightMax, bandT) *
      (0.9 + rankT * 0.1),
  };
}

const vertexShader = /* glsl */ `
  attribute float aCoreSize;
  attribute float aGlowSize;
  attribute float aGlowOpacity;
  attribute float aBrightness;
  attribute float aSparkle;
  attribute vec3 color;
  uniform float uShowGlow;
  uniform int uHoveredIndex;
  uniform int uSelectedIndex;
  uniform int uPulseIndex;
  uniform float uPulseStrength;
  varying float vBrightness;
  varying float vGlow;
  varying float vSparkle;
  varying vec3 vColor;
  varying float vIsSelected;

  void main() {
    vColor = color;
    vSparkle = aSparkle;
    vGlow = aGlowOpacity;
    float hovered = float(gl_VertexID == uHoveredIndex);
    float selected = float(gl_VertexID == uSelectedIndex);
    float pulse = float(gl_VertexID == uPulseIndex) * uPulseStrength;
    vIsSelected = selected;
    vBrightness = aBrightness * (1.0 + hovered * 0.14 + selected * 0.05 + pulse * 0.55);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float size = (aCoreSize + aGlowSize * vGlow * uShowGlow) * (1.0 + hovered * 0.06 + selected * 0.03);
    float pixelSize = size * (235.0 / -mvPosition.z);
    gl_PointSize = clamp(pixelSize, 3.0, 88.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uShowGlow;
  varying float vBrightness;
  varying float vGlow;
  varying float vSparkle;
  varying vec3 vColor;
  varying float vIsSelected;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);

    if (dist > 0.47) discard;

    float circleMask = 1.0 - smoothstep(0.34, 0.47, dist);
    vec2 skew = vec2(uv.x * 1.08, uv.y * 0.92);
    float dEll = length(vec2(skew.x * 1.2, skew.y * 0.78));

    float core = exp(-length(skew) * length(skew) * 72.0);
    float glow = exp(-dist * dist * mix(10.0, 4.5, vGlow)) * vGlow * 0.62 * uShowGlow;

    float cross = exp(-abs(uv.x) * 36.0) * 0.48 + exp(-abs(uv.y) * 36.0) * 0.48;
    float sparkle = cross * vSparkle * circleMask;

    float alpha = (core * 1.15 + glow + sparkle * 0.52) * vBrightness * circleMask;

    if (vIsSelected > 0.5) {
      float ring = smoothstep(0.38, 0.4, dist) * (1.0 - smoothstep(0.42, 0.44, dist));
      alpha += ring * 0.08 * circleMask;
    }

    if (alpha < 0.001) discard;

    vec3 warm = vec3(
      min(vColor.r * 1.12 + 0.1, 1.0),
      min(vColor.g * 1.06 + 0.07, 1.0),
      vColor.b * 0.84 + 0.03
    );
    vec3 col = warm * (core * 1.35 + glow * 0.5 + sparkle * 0.4 + 0.2);
    gl_FragColor = vec4(col, alpha);
  }
`;

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();

export default function HolderGroupStars({
  groups,
  hoveredId,
  pulseWallet = null,
  pulseKey = 0,
  debugLayers,
  hoverRef,
  onHover,
}: HolderGroupStarsProps) {
  const showVisible = debugLayers?.visible ?? true;
  const showGlow = debugLayers?.glow ?? true;
  const showHits = debugLayers?.hits ?? true;
  const { camera, pointer, size, gl } = useThree();
  const pointsRef = useRef<THREE.Points>(null);
  const hitRef = useRef<THREE.InstancedMesh>(null);
  const pulseStart = useRef(0);
  const lastHoverId = useRef<string | null>(null);
  const visualsRef = useRef<HolderStarVisual[]>([]);
  const hoveredIndex = groups.findIndex((g) => g.id === hoveredId);

  const hitGeometry = useMemo(() => new THREE.SphereGeometry(1, 8, 8), []);

  const hitMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );

  const { geometry, material } = useMemo(() => {
    const normieRange = normieRangeFromStars(groups);
    const visuals = groups.map((g, i) => starVisual(g, i, normieRange));
    const positions = new Float32Array(groups.length * 3);
    const colors = new Float32Array(groups.length * 3);
    const coreSizes = new Float32Array(groups.length);
    const glowSizes = new Float32Array(groups.length);
    const glowOpacities = new Float32Array(groups.length);
    const sparkles = new Float32Array(groups.length);
    const brightness = new Float32Array(groups.length);
    const temp = new THREE.Color();

    groups.forEach((group, i) => {
      const v = visuals[i];
      positions[i * 3] = group.position[0];
      positions[i * 3 + 1] = group.position[1];
      positions[i * 3 + 2] = group.position[2];
      temp.set(group.color);
      colors[i * 3] = temp.r;
      colors[i * 3 + 1] = temp.g;
      colors[i * 3 + 2] = temp.b;
      coreSizes[i] = v.coreSize;
      glowSizes[i] = v.glowSize;
      glowOpacities[i] = v.glowOpacity;
      sparkles[i] = v.sparkle;
      brightness[i] = v.brightness;
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

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uShowGlow: { value: showGlow ? 1 : 0 },
        uHoveredIndex: { value: -1 },
        uSelectedIndex: { value: -1 },
        uPulseIndex: { value: -1 },
        uPulseStrength: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    visualsRef.current = visuals;
    return { geometry, material };
  }, [groups, showGlow]);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.info(
        `[Normie Universe] Rendering ${groups.length} holder-group stars`,
      );
    }
  }, [groups.length]);

  useLayoutEffect(() => {
    if (pointsRef.current) {
      pointsRef.current.raycast = () => {};
    }
    if (!hitRef.current) return;
    hitRef.current.raycast = () => {};
    const normieRange = normieRangeFromStars(groups);
    groups.forEach((group, i) => {
      const visual = starVisual(group, i, normieRange);
      _position.set(...group.position);
      _scale.setScalar(hitRadiusForVisual(visual));
      _matrix.compose(_position, new THREE.Quaternion(), _scale);
      hitRef.current!.setMatrixAt(i, _matrix);
    });
    hitRef.current.instanceMatrix.needsUpdate = true;
    hitRef.current.count = groups.length;
    hitRef.current.computeBoundingSphere();
  }, [groups, showHits]);

  useLayoutEffect(() => {
    if (!pulseWallet) return;
    const idx = groups.findIndex(
      (g) => g.wallet?.toLowerCase() === pulseWallet.toLowerCase(),
    );
    if (idx < 0) return;
    material.uniforms.uPulseIndex.value = idx;
    pulseStart.current = performance.now() / 1000;
  }, [pulseWallet, pulseKey, groups, material.uniforms]);

  useFrame(() => {
    if (!pointsRef.current) return;
    material.uniforms.uHoveredIndex.value = hoveredIndex;
    material.uniforms.uSelectedIndex.value = -1;

    const nearest = pickNearestGroup(
      pointer,
      camera,
      size,
      groups,
      visualsRef.current,
      showGlow,
    );
    if (hoverRef) hoverRef.current = nearest;
    const nextId = nearest?.id ?? null;
    if (nextId !== lastHoverId.current) {
      lastHoverId.current = nextId;
      if (nearest) {
        document.body.style.cursor = "pointer";
        onHover(
          nearest,
          pointerScreenPos(
            pointer,
            size,
            gl.domElement.getBoundingClientRect(),
          ),
        );
      } else {
        document.body.style.cursor = "default";
        onHover(null);
      }
    }

    if (material.uniforms.uPulseIndex.value < 0) return;
    const elapsed = performance.now() / 1000 - pulseStart.current;
    if (elapsed > 1.2) {
      material.uniforms.uPulseStrength.value = 0;
      material.uniforms.uPulseIndex.value = -1;
      return;
    }
    material.uniforms.uPulseStrength.value =
      Math.sin(Math.min(elapsed / 0.55, 1) * Math.PI);
  });

  return (
    <group name="holder-group-stars">
      <instancedMesh
        ref={hitRef}
        args={[hitGeometry, hitMaterial, groups.length]}
        visible={showHits}
        frustumCulled={false}
        renderOrder={12}
      />
      {showVisible ? (
        <points
          ref={pointsRef}
          geometry={geometry}
          material={material}
          frustumCulled={false}
          renderOrder={15}
          raycast={() => null}
        />
      ) : null}
    </group>
  );
}
