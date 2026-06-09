"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { HolderGroupStar, HolderGroupTier } from "@/types/universe";

interface HolderGroupStarsProps {
  groups: HolderGroupStar[];
  hoveredId: string | null;
  selectedId: string | null;
  reducedMotion?: boolean;
  onHover: (
    group: HolderGroupStar | null,
    screenPos?: { x: number; y: number },
  ) => void;
  onSelect: (group: HolderGroupStar) => void;
}

const HIT_RADIUS: Record<HolderGroupTier, number> = {
  core: 6,
  inner: 5.5,
  middle: 5,
  outer: 4.5,
};

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

function starVisual(group: HolderGroupStar, index: number) {
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
  uniform float uHoverBoost;
  uniform float uSelectBoost;
  uniform int uHoveredIndex;
  uniform int uSelectedIndex;
  varying float vBrightness;
  varying float vGlow;
  varying float vSparkle;
  varying vec3 vColor;
  varying float vIsActive;
  varying float vIsSelected;

  void main() {
    vColor = color;
    vSparkle = aSparkle;
    vBrightness = aBrightness;
    float hovered = float(gl_VertexID == uHoveredIndex);
    float selected = float(gl_VertexID == uSelectedIndex);
    vIsActive = max(hovered, selected);
    vIsSelected = selected;

    float boost = 1.0 + hovered * uHoverBoost + selected * uSelectBoost;
    vGlow = aGlowOpacity * boost;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float size = aCoreSize + aGlowSize * vGlow * (1.0 + hovered * 0.5 + selected * 0.3);
    gl_PointSize = max(size * (235.0 / -mvPosition.z), 3.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vBrightness;
  varying float vGlow;
  varying float vSparkle;
  varying vec3 vColor;
  varying float vIsActive;
  varying float vIsSelected;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    vec2 skew = vec2(uv.x * 1.08, uv.y * 0.92);
    float d = length(skew);
    float dEll = length(vec2(skew.x * 1.2, skew.y * 0.78));

    float core = exp(-d * d * 72.0);
    float glow = exp(-dEll * dEll * mix(10.0, 4.5, vGlow)) * vGlow * 0.62;

    float cross = exp(-abs(uv.x) * 30.0) * 0.48 + exp(-abs(uv.y) * 30.0) * 0.48;
    float sparkle = cross * vSparkle * (1.0 + vIsActive * 0.85);

    float alpha = (core * 1.15 + glow + sparkle * 0.52) * vBrightness;

    if (vIsSelected > 0.5) {
      float ring = smoothstep(0.34, 0.38, dEll) * (1.0 - smoothstep(0.42, 0.47, dEll));
      alpha += ring * 0.22;
    }

    if (vIsActive > 0.5 && vIsSelected < 0.5) {
      alpha += exp(-dEll * dEll * 3.5) * vBrightness * 0.14;
      alpha += sparkle * 0.25;
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

function phaseFromId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 628;
  return hash / 100;
}

export default function HolderGroupStars({
  groups,
  hoveredId,
  selectedId,
  reducedMotion,
  onHover,
  onSelect,
}: HolderGroupStarsProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const hitRef = useRef<THREE.InstancedMesh>(null);
  const hoveredIndex = groups.findIndex((g) => g.id === hoveredId);
  const selectedIndex = groups.findIndex((g) => g.id === selectedId);

  const hitMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
      }),
    [],
  );

  const { geometry, material, visuals } = useMemo(() => {
    const visuals = groups.map((g, i) => starVisual(g, i));
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
        uHoverBoost: { value: 1.5 },
        uSelectBoost: { value: 0.75 },
        uHoveredIndex: { value: -1 },
        uSelectedIndex: { value: -1 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    return { geometry, material, visuals };
  }, [groups]);

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
    groups.forEach((group, i) => {
      _position.set(...group.position);
      _scale.setScalar(HIT_RADIUS[group.tier]);
      _matrix.compose(_position, new THREE.Quaternion(), _scale);
      hitRef.current!.setMatrixAt(i, _matrix);
    });
    hitRef.current.instanceMatrix.needsUpdate = true;
    hitRef.current.count = groups.length;
  }, [groups]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    material.uniforms.uHoveredIndex.value = hoveredIndex;
    material.uniforms.uSelectedIndex.value = selectedIndex;

    if (reducedMotion) return;
    const t = clock.elapsedTime;
    const brightnessAttr = geometry.getAttribute(
      "aBrightness",
    ) as THREE.BufferAttribute;

    groups.forEach((group, i) => {
      if (group.tier !== "core" && group.tier !== "inner") return;
      const base = visuals[i].brightness;
      const pulse = 1 + Math.sin(t * 0.85 + phaseFromId(group.id)) * 0.018;
      brightnessAttr.setX(i, base * pulse);
    });
    brightnessAttr.needsUpdate = true;
  });

  const handlePointer = (e: ThreeEvent<PointerEvent>, entering: boolean) => {
    e.stopPropagation();
    if (e.instanceId === undefined) {
      onHover(null);
      document.body.style.cursor = "default";
      return;
    }
    const group = groups[e.instanceId];
    if (entering) {
      document.body.style.cursor = "pointer";
      onHover(group, { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
    } else {
      document.body.style.cursor = "default";
      onHover(null);
    }
  };

  return (
    <group name="holder-group-stars">
      <instancedMesh
        ref={hitRef}
        args={[undefined, hitMaterial, groups.length]}
        frustumCulled={false}
        renderOrder={12}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) onSelect(groups[e.instanceId]);
        }}
        onPointerOver={(e) => handlePointer(e, true)}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (e.instanceId !== undefined) {
            onHover(groups[e.instanceId], {
              x: e.nativeEvent.clientX,
              y: e.nativeEvent.clientY,
            });
          }
        }}
        onPointerOut={(e) => handlePointer(e, false)}
      >
        <sphereGeometry args={[1, 8, 8]} />
      </instancedMesh>
      <points
        ref={pointsRef}
        geometry={geometry}
        material={material}
        frustumCulled={false}
        renderOrder={15}
        raycast={() => null}
      />
    </group>
  );
}
