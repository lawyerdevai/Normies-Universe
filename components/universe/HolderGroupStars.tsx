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
import { createHolderStarPointMaterial } from "@/lib/universe/holderStarPointShader";
import { isPointerOverPyre } from "@/lib/universe/isPointerOverPyre";
import type { HolderGroupStar } from "@/types/universe";

export type HolderGroupStarsDebugLayers = {
  visible: boolean;
  glow: boolean;
  hits: boolean;
};

interface HolderGroupStarsProps {
  groups: HolderGroupStar[];
  hoveredId: string | null;
  selectedId: string | null;
  reducedMotion?: boolean;
  debugLayers?: HolderGroupStarsDebugLayers;
  hoverRef?: React.RefObject<HolderGroupStar | null>;
  onHover: (
    group: HolderGroupStar | null,
    screenPos?: { x: number; y: number },
  ) => void;
  onSelect: (group: HolderGroupStar) => void;
  onPyreClick: () => void;
  onEmptyClick: () => void;
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

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();

export default function HolderGroupStars({
  groups,
  hoveredId,
  selectedId,
  debugLayers,
  hoverRef,
  onHover,
  onSelect,
  onPyreClick,
  onEmptyClick,
}: HolderGroupStarsProps) {
  const showVisible = debugLayers?.visible ?? true;
  const showGlow = debugLayers?.glow ?? true;
  const showHits = debugLayers?.hits ?? true;
  const { camera, pointer, size, gl } = useThree();
  const pointsRef = useRef<THREE.Points>(null);
  const hitRef = useRef<THREE.InstancedMesh>(null);
  const lastHoverId = useRef<string | null>(null);
  const visualsRef = useRef<HolderStarVisual[]>([]);
  const hoveredIndex = groups.findIndex((g) => g.id === hoveredId);
  const selectedIndex = groups.findIndex((g) => g.id === selectedId);

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

    const material = createHolderStarPointMaterial(showGlow);

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

  useEffect(() => {
    const canvas = gl.domElement;

    const handleClick = () => {
      const nearest = pickNearestGroup(
        pointer,
        camera,
        size,
        groups,
        visualsRef.current,
        showGlow,
      );
      if (nearest) {
        onSelect(nearest);
        return;
      }
      if (isPointerOverPyre(pointer, camera, size)) {
        onPyreClick();
        return;
      }
      onEmptyClick();
    };

    canvas.addEventListener("click", handleClick);
    return () => canvas.removeEventListener("click", handleClick);
  }, [
    gl,
    pointer,
    camera,
    size,
    groups,
    showGlow,
    onSelect,
    onPyreClick,
    onEmptyClick,
  ]);

  useFrame(() => {
    if (!pointsRef.current) return;
    material.uniforms.uHoveredIndex.value = hoveredIndex;
    material.uniforms.uSelectedIndex.value = selectedIndex;

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
