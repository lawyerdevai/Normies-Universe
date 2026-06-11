"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { hitRadiusForVisual } from "@/lib/universe/holderStarVisual";
import { useGalaxyRevealRef } from "@/components/universe/GalaxyArrivalController";
import { createHolderStarPointMaterial } from "@/lib/universe/holderStarPointShader";
import type { BurnerStar } from "@/types/universe";

interface BurnerStarsProps {
  stars: BurnerStar[];
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (
    star: BurnerStar | null,
    screenPos?: { x: number; y: number },
  ) => void;
  onSelect: (star: BurnerStar) => void;
  captureRef?: React.RefObject<boolean>;
}

const _projected = new THREE.Vector3();
const _viewPos = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();

function visibleStarPixelRadius(
  star: BurnerStar,
  position: [number, number, number],
  camera: THREE.Camera,
) {
  _viewPos.set(...position).applyMatrix4(camera.matrixWorldInverse);
  const z = Math.max(0.1, -_viewPos.z);
  const worldSize = star.coreSize + star.glowSize * star.glowOpacity;
  const pointSize = Math.min(88, Math.max(3, worldSize * (235 / z)));
  return pointSize * 0.47;
}

function pickNearestStar(
  pointer: THREE.Vector2,
  camera: THREE.Camera,
  viewport: { width: number; height: number },
  stars: BurnerStar[],
) {
  const px = (pointer.x * 0.5 + 0.5) * viewport.width;
  const py = (-pointer.y * 0.5 + 0.5) * viewport.height;

  let bestIndex = -1;
  let bestDist = Infinity;

  for (let i = 0; i < stars.length; i++) {
    _projected.set(...stars[i].position).project(camera);
    if (_projected.z > 1) continue;

    const sx = (_projected.x * 0.5 + 0.5) * viewport.width;
    const sy = (-_projected.y * 0.5 + 0.5) * viewport.height;
    const dist = Math.hypot(sx - px, sy - py);
    const hitRadius = visibleStarPixelRadius(
      stars[i],
      stars[i].position,
      camera,
    );

    if (dist <= hitRadius && dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }

  return bestIndex >= 0 ? stars[bestIndex] : null;
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

export default function BurnerStars({
  stars,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
  captureRef,
}: BurnerStarsProps) {
  const { camera, pointer, size, gl } = useThree();
  const revealRef = useGalaxyRevealRef();
  const pointsRef = useRef<THREE.Points>(null);
  const hitRef = useRef<THREE.InstancedMesh>(null);
  const lastHoverId = useRef<string | null>(null);
  const hoveredIndex = stars.findIndex((s) => s.id === hoveredId);
  const selectedIndex = stars.findIndex((s) => s.id === selectedId);

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
    const positions = new Float32Array(stars.length * 3);
    const colors = new Float32Array(stars.length * 3);
    const coreSizes = new Float32Array(stars.length);
    const glowSizes = new Float32Array(stars.length);
    const glowOpacities = new Float32Array(stars.length);
    const sparkles = new Float32Array(stars.length);
    const brightness = new Float32Array(stars.length);
    const temp = new THREE.Color();

    stars.forEach((star, i) => {
      positions[i * 3] = star.position[0];
      positions[i * 3 + 1] = star.position[1];
      positions[i * 3 + 2] = star.position[2];
      temp.set(star.color);
      colors[i * 3] = temp.r;
      colors[i * 3 + 1] = temp.g;
      colors[i * 3 + 2] = temp.b;
      coreSizes[i] = star.coreSize;
      glowSizes[i] = star.glowSize;
      glowOpacities[i] = star.glowOpacity;
      sparkles[i] = star.sparkle;
      brightness[i] = star.brightness;
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

    geometry.computeBoundingSphere();

    return { geometry, material: createHolderStarPointMaterial(true) };
  }, [stars]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      hitGeometry.dispose();
      hitMaterial.dispose();
    };
  }, [geometry, material, hitGeometry, hitMaterial]);

  useLayoutEffect(() => {
    if (pointsRef.current) {
      pointsRef.current.raycast = () => {};
    }
    if (!hitRef.current) return;
    hitRef.current.raycast = () => {};
    stars.forEach((star, i) => {
      _position.set(...star.position);
      _scale.setScalar(
        hitRadiusForVisual({
          coreSize: star.coreSize,
          glowSize: star.glowSize,
          glowOpacity: star.glowOpacity,
          sparkle: star.sparkle,
          brightness: star.brightness,
        }),
      );
      _matrix.compose(_position, new THREE.Quaternion(), _scale);
      hitRef.current!.setMatrixAt(i, _matrix);
    });
    hitRef.current.instanceMatrix.needsUpdate = true;
    hitRef.current.count = stars.length;
    hitRef.current.computeBoundingSphere();
  }, [stars]);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleClick = () => {
      const nearest = pickNearestStar(pointer, camera, size, stars);
      if (nearest) {
        onSelect(nearest);
      }
    };

    canvas.addEventListener("click", handleClick);
    return () => canvas.removeEventListener("click", handleClick);
  }, [gl, pointer, camera, size, stars, onSelect]);

  useFrame(() => {
    if (!pointsRef.current) return;
    material.uniforms.uHoveredIndex.value = hoveredIndex;
    material.uniforms.uSelectedIndex.value = selectedIndex;
    material.uniforms.uGlintIndex.value = -1;
    material.uniforms.uGlintBoost.value = 0;
    material.uniforms.uGlintSizeBoost.value = 0;

    const nearest = pickNearestStar(pointer, camera, size, stars);
    if (captureRef) captureRef.current = nearest !== null;

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
        onHover(null);
      }
    }

    material.opacity = revealRef.current.outer;
  });

  if (stars.length === 0) return null;

  return (
    <group name="burner-stars">
      <instancedMesh
        ref={hitRef}
        args={[hitGeometry, hitMaterial, stars.length]}
        frustumCulled
        renderOrder={11}
      />
      <points
        ref={pointsRef}
        geometry={geometry}
        material={material}
        frustumCulled
        renderOrder={14}
        raycast={() => null}
      />
    </group>
  );
}
