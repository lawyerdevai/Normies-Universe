"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createHolderStarPointMaterial } from "@/lib/universe/holderStarPointShader";
import {
  generateAbsorbedBurnStars,
  type AbsorbedBurnStar,
} from "@/lib/starform/generateAbsorbedBurnStars";

export type AbsorbedHoverPayload = {
  tokenId: number;
  x: number;
  y: number;
};

interface AbsorbedBurnStarsProps {
  receiverTokenId: number;
  hoveredTokenId: number | null;
  selectedTokenId: number | null;
  onHover: (payload: AbsorbedHoverPayload | null) => void;
  onSelect: (tokenId: number) => void;
}

const _projected = new THREE.Vector3();
const _viewPos = new THREE.Vector3();

function visibleStarPixelRadius(
  star: AbsorbedBurnStar,
  camera: THREE.Camera,
) {
  _viewPos.set(...star.position).applyMatrix4(camera.matrixWorldInverse);
  const z = Math.max(0.1, -_viewPos.z);
  const worldSize = star.coreSize + star.glowSize * star.glowOpacity;
  const pointSize = Math.min(88, Math.max(3, worldSize * (235 / z)));
  return pointSize * 0.47;
}

function pickNearestStar(
  pointer: THREE.Vector2,
  camera: THREE.Camera,
  viewport: { width: number; height: number },
  stars: AbsorbedBurnStar[],
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
    const hitRadius = visibleStarPixelRadius(stars[i], camera);

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

export default function AbsorbedBurnStars({
  receiverTokenId,
  hoveredTokenId,
  selectedTokenId,
  onHover,
  onSelect,
}: AbsorbedBurnStarsProps) {
  const { camera, pointer, size, gl } = useThree();
  const pointsRef = useRef<THREE.Points>(null);
  const baseBrightnessRef = useRef<Float32Array | null>(null);
  const lastHoverId = useRef<number | null>(null);
  const [absorbedTokenIds, setAbsorbedTokenIds] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/normie/${receiverTokenId}/absorbed`)
      .then(async (res) => {
        if (!res.ok) return [];
        const data = (await res.json()) as { absorbedTokenIds?: number[] };
        return Array.isArray(data.absorbedTokenIds) ? data.absorbedTokenIds : [];
      })
      .then((ids) => {
        if (!cancelled) setAbsorbedTokenIds(ids);
      })
      .catch(() => {
        if (!cancelled) setAbsorbedTokenIds([]);
      });

    return () => {
      cancelled = true;
    };
  }, [receiverTokenId]);

  const stars = useMemo(() => {
    if (!absorbedTokenIds || absorbedTokenIds.length === 0) return [];
    return generateAbsorbedBurnStars(
      receiverTokenId,
      absorbedTokenIds,
      size.width / size.height,
    );
  }, [absorbedTokenIds, receiverTokenId, size.width, size.height]);

  const hoveredIndex = stars.findIndex(
    (star) => star.absorbedTokenId === hoveredTokenId,
  );
  const selectedIndex = stars.findIndex(
    (star) => star.absorbedTokenId === selectedTokenId,
  );

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(stars.length * 3);
    const colors = new Float32Array(stars.length * 3);
    const coreSizes = new Float32Array(stars.length);
    const glowSizes = new Float32Array(stars.length);
    const glowOpacities = new Float32Array(stars.length);
    const sparkles = new Float32Array(stars.length);
    const brightness = new Float32Array(stars.length);

    stars.forEach((star, i) => {
      positions[i * 3] = star.position[0];
      positions[i * 3 + 1] = star.position[1];
      positions[i * 3 + 2] = star.position[2];
      colors[i * 3] = star.color.r;
      colors[i * 3 + 1] = star.color.g;
      colors[i * 3 + 2] = star.color.b;
      coreSizes[i] = star.coreSize;
      glowSizes[i] = star.glowSize;
      glowOpacities[i] = star.glowOpacity;
      sparkles[i] = 0;
      brightness[i] = star.brightness;
    });

    baseBrightnessRef.current = brightness.slice();

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

    return { geometry, material: createHolderStarPointMaterial(true) };
  }, [stars]);

  useLayoutEffect(() => {
    if (pointsRef.current) {
      pointsRef.current.raycast = () => {};
    }
  }, [stars.length]);

  useEffect(() => {
    if (stars.length === 0) return;
    const canvas = gl.domElement;

    const handleClick = () => {
      const nearest = pickNearestStar(pointer, camera, size, stars);
      if (nearest) onSelect(nearest.absorbedTokenId);
    };

    canvas.addEventListener("click", handleClick);
    return () => canvas.removeEventListener("click", handleClick);
  }, [gl, pointer, camera, size, stars, onSelect]);

  useFrame(({ clock }) => {
    if (!pointsRef.current || stars.length === 0) return;

    material.uniforms.uHoveredIndex.value = hoveredIndex;
    material.uniforms.uSelectedIndex.value = selectedIndex;
    material.uniforms.uGlintIndex.value = -1;
    material.uniforms.uGlintBoost.value = 0;
    material.uniforms.uGlintSizeBoost.value = 0;

    const attr = geometry.getAttribute("aBrightness") as THREE.BufferAttribute;
    const bases = baseBrightnessRef.current;
    if (attr && bases) {
      const t = clock.elapsedTime;
      let dirty = false;
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const lift = Math.max(0, Math.sin(t * star.twinkleSpeed + star.twinklePhase));
        const next = bases[i] * (1 + lift * star.twinkleLift);
        if (attr.getX(i) !== next) {
          attr.setX(i, next);
          dirty = true;
        }
      }
      if (dirty) attr.needsUpdate = true;
    }

    const nearest = pickNearestStar(pointer, camera, size, stars);
    const nextId = nearest?.absorbedTokenId ?? null;
    if (nextId !== lastHoverId.current) {
      lastHoverId.current = nextId;
      if (nearest) {
        document.body.style.cursor = "pointer";
        const screen = pointerScreenPos(
          pointer,
          size,
          gl.domElement.getBoundingClientRect(),
        );
        onHover({
          tokenId: nearest.absorbedTokenId,
          x: screen.x,
          y: screen.y,
        });
      } else {
        document.body.style.cursor = "";
        onHover(null);
      }
    }
  });

  if (!absorbedTokenIds || stars.length === 0) return null;

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={3}
      raycast={() => null}
    />
  );
}
