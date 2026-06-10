"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createHolderStarPointMaterial } from "@/lib/universe/holderStarPointShader";
import {
  lerpSearchHighlight,
  SEARCH_HIGHLIGHT_RANK1,
  searchHighlightSparkle,
} from "@/lib/universe/searchHighlightVisual";
import { searchHighlightStore } from "@/lib/universe/searchHighlightStore";
import type { LocatorTarget } from "@/types/universe";

function parseHighlightColor(color: string | null) {
  const c = new THREE.Color("#f5e8d0");
  if (!color) return c;
  if (color.startsWith("rgb")) {
    const m = color.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      c.setRGB(
        Number(m[0]) / 255,
        Number(m[1]) / 255,
        Number(m[2]) / 255,
      );
    }
    return c;
  }
  c.set(color);
  return c;
}

interface SearchHighlightStarProps {
  target: LocatorTarget | null;
  locatorKey: number;
}

/**
 * World-anchored top-tier holder point sprite for search results.
 * mesh.position is set once per search; only size/brightness animate.
 */
export default function SearchHighlightStar({
  target,
  locatorKey,
}: SearchHighlightStarProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const material = useMemo(() => createHolderStarPointMaterial(true), []);

  const { geometry, attrs } = useMemo(() => {
    const positions = new Float32Array([0, 0, 0]);
    const colors = new Float32Array(3);
    const coreSizes = new Float32Array(1);
    const glowSizes = new Float32Array(1);
    const glowOpacities = new Float32Array(1);
    const sparkles = new Float32Array(1);
    const brightness = new Float32Array(1);

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

    return {
      geometry,
      attrs: {
        color: geometry.getAttribute("color") as THREE.BufferAttribute,
        coreSize: geometry.getAttribute("aCoreSize") as THREE.BufferAttribute,
        glowSize: geometry.getAttribute("aGlowSize") as THREE.BufferAttribute,
        glowOpacity: geometry.getAttribute(
          "aGlowOpacity",
        ) as THREE.BufferAttribute,
        sparkle: geometry.getAttribute("aSparkle") as THREE.BufferAttribute,
        brightness: geometry.getAttribute(
          "aBrightness",
        ) as THREE.BufferAttribute,
      },
    };
  }, []);

  useLayoutEffect(() => {
    const mesh = pointsRef.current;
    if (!mesh || locatorKey === 0) return;

    if (target?.kind === "holder") {
      const [x, y, z] = target.position;
      mesh.position.set(x, y, z);
      mesh.updateMatrix();

      const c = parseHighlightColor(target.color);
      attrs.color.setXYZ(0, c.r, c.g, c.b);
      attrs.color.needsUpdate = true;
    }
  }, [locatorKey, target, attrs.color]);

  useFrame(({ clock }) => {
    const mesh = pointsRef.current;
    if (!mesh) return;

    const { enlarge, glimmer, starKind, highlightPersist } = searchHighlightStore;
    const visible =
      (starKind === "outer" || starKind === "top75") &&
      highlightPersist &&
      enlarge > 0.01;
    mesh.visible = visible;
    if (!visible) return;

    const base = searchHighlightStore.baseVisual ?? {
      coreSize: 1.4,
      glowSize: 2.2,
      glowOpacity: 0.22,
      brightness: 0.55,
      sparkle: 0.18,
    };
    const e = enlarge;
    const targetSparkle = lerpSearchHighlight(
      base.sparkle,
      SEARCH_HIGHLIGHT_RANK1.sparkle,
      e,
    );

    attrs.coreSize.setX(
      0,
      lerpSearchHighlight(base.coreSize, SEARCH_HIGHLIGHT_RANK1.coreSize, e),
    );
    attrs.glowSize.setX(
      0,
      lerpSearchHighlight(base.glowSize, SEARCH_HIGHLIGHT_RANK1.glowSize, e),
    );
    attrs.glowOpacity.setX(
      0,
      lerpSearchHighlight(
        base.glowOpacity,
        SEARCH_HIGHLIGHT_RANK1.glowOpacity,
        e,
      ),
    );
    attrs.sparkle.setX(
      0,
      searchHighlightSparkle(clock.elapsedTime, targetSparkle),
    );
    attrs.brightness.setX(
      0,
      lerpSearchHighlight(base.brightness, SEARCH_HIGHLIGHT_RANK1.brightness, e) *
        glimmer,
    );

    attrs.coreSize.needsUpdate = true;
    attrs.glowSize.needsUpdate = true;
    attrs.glowOpacity.needsUpdate = true;
    attrs.sparkle.needsUpdate = true;
    attrs.brightness.needsUpdate = true;
  });

  return (
    <points
      ref={pointsRef}
      name="search-highlight-star"
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={16}
      visible={false}
      raycast={() => null}
    />
  );
}
