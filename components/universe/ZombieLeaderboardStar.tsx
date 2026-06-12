"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGalaxyRevealRef } from "@/components/universe/GalaxyArrivalController";
import { createHolderStarPointMaterial } from "@/lib/universe/holderStarPointShader";
import { hitRadiusForVisual } from "@/lib/universe/holderStarVisual";
import {
  ZOMBIE_LEADERBOARD_PULSE_SECONDS,
  ZOMBIE_LEADERBOARD_STAR_COLOR,
  ZOMBIE_LEADERBOARD_STAR_POSITION,
  zombieLeaderboardStarVisual,
} from "@/lib/universe/zombieLeaderboardStar";

interface ZombieLeaderboardStarProps {
  hovered: boolean;
  onHover: (hovered: boolean, screenPos?: { x: number; y: number }) => void;
  onSelect: () => void;
  captureRef?: React.RefObject<boolean>;
}

const POSITION = ZOMBIE_LEADERBOARD_STAR_POSITION;
const VISUAL = {
  ...zombieLeaderboardStarVisual(),
  brightness: 1.0,
};

const _projected = new THREE.Vector3();
const _viewPos = new THREE.Vector3();

function visibleStarPixelRadius(camera: THREE.Camera) {
  _viewPos.set(...POSITION).applyMatrix4(camera.matrixWorldInverse);
  const z = Math.max(0.1, -_viewPos.z);
  const worldSize = VISUAL.coreSize + VISUAL.glowSize * VISUAL.glowOpacity;
  const pointSize = Math.min(88, Math.max(3, worldSize * (235 / z)));
  return pointSize * 0.47;
}

function isPointerOverStar(
  pointer: THREE.Vector2,
  camera: THREE.Camera,
  viewport: { width: number; height: number },
) {
  _projected.set(...POSITION).project(camera);
  if (_projected.z > 1) return false;

  const px = (pointer.x * 0.5 + 0.5) * viewport.width;
  const py = (-pointer.y * 0.5 + 0.5) * viewport.height;
  const sx = (_projected.x * 0.5 + 0.5) * viewport.width;
  const sy = (-_projected.y * 0.5 + 0.5) * viewport.height;

  return Math.hypot(sx - px, sy - py) <= visibleStarPixelRadius(camera);
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

export default function ZombieLeaderboardStar({
  hovered,
  onHover,
  onSelect,
  captureRef,
}: ZombieLeaderboardStarProps) {
  const { camera, pointer, size, gl, clock } = useThree();
  const revealRef = useGalaxyRevealRef();
  const pointsRef = useRef<THREE.Points>(null);
  const hitRef = useRef<THREE.Mesh>(null);
  const lastHovered = useRef(false);
  const brightnessRef = useRef(
    new THREE.BufferAttribute(new Float32Array([VISUAL.baseBrightness]), 1),
  );

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
    const positions = new Float32Array([...POSITION]);
    const colors = new Float32Array(3);
    const temp = new THREE.Color(ZOMBIE_LEADERBOARD_STAR_COLOR);
    colors[0] = temp.r;
    colors[1] = temp.g;
    colors[2] = temp.b;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute(
      "aCoreSize",
      new THREE.BufferAttribute(new Float32Array([VISUAL.coreSize]), 1),
    );
    geometry.setAttribute(
      "aGlowSize",
      new THREE.BufferAttribute(new Float32Array([VISUAL.glowSize]), 1),
    );
    geometry.setAttribute(
      "aGlowOpacity",
      new THREE.BufferAttribute(new Float32Array([VISUAL.glowOpacity]), 1),
    );
    geometry.setAttribute(
      "aSparkle",
      new THREE.BufferAttribute(new Float32Array([VISUAL.sparkle]), 1),
    );
    geometry.setAttribute("aBrightness", brightnessRef.current);
    geometry.computeBoundingSphere();

    return { geometry, material: createHolderStarPointMaterial(true) };
  }, []);

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
    const radius = hitRadiusForVisual(VISUAL);
    hitRef.current.position.set(...POSITION);
    hitRef.current.scale.setScalar(radius);
  }, []);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleClick = () => {
      if (isPointerOverStar(pointer, camera, size)) {
        onSelect();
      }
    };

    canvas.addEventListener("click", handleClick);
    return () => canvas.removeEventListener("click", handleClick);
  }, [gl, pointer, camera, size, onSelect]);

  useFrame(() => {
    if (!pointsRef.current) return;

    const pulse =
      (Math.sin(
        (clock.elapsedTime / ZOMBIE_LEADERBOARD_PULSE_SECONDS) * Math.PI * 2,
      ) +
        1) *
      0.5;
    const pulseBoost = pulse * 0.32;
    const hoverBoost = hovered ? 0.18 : 0;
    brightnessRef.current.setX(0, VISUAL.baseBrightness + pulseBoost + hoverBoost);
    brightnessRef.current.needsUpdate = true;

    material.uniforms.uHoveredIndex.value = hovered ? 0 : -1;
    material.uniforms.uSelectedIndex.value = -1;
    material.uniforms.uGlintIndex.value = -1;
    material.uniforms.uGlintBoost.value = 0;
    material.uniforms.uGlintSizeBoost.value = 0;
    material.opacity = revealRef.current.outer;

    const over = isPointerOverStar(pointer, camera, size);
    if (captureRef) captureRef.current = over;

    if (over !== lastHovered.current) {
      lastHovered.current = over;
      if (over) {
        document.body.style.cursor = "pointer";
        onHover(
          true,
          pointerScreenPos(
            pointer,
            size,
            gl.domElement.getBoundingClientRect(),
          ),
        );
      } else {
        onHover(false);
      }
    }
  });

  return (
    <group name="zombie-leaderboard-star">
      <mesh
        ref={hitRef}
        geometry={hitGeometry}
        material={hitMaterial}
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
