"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { searchHighlightGlimmer } from "@/lib/universe/searchHighlightVisual";
import { searchHighlightStore } from "@/lib/universe/searchHighlightStore";
import type { LocatorTarget } from "@/types/universe";

const DIM_IN_MS = 300;
const PING_MS = 3000;
const GROW_MS = 400;
const SHRINK_MS = 450;

interface SearchLocatorProps {
  target: LocatorTarget | null;
  locatorKey: number;
  highlightPersist: boolean;
  onHighlightDismissed?: () => void;
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function dimOpacity(elapsedMs: number): number {
  const fadeIn = Math.min(1, elapsedMs / DIM_IN_MS);
  const holdEnd = PING_MS - DIM_IN_MS;
  if (elapsedMs <= holdEnd) return easeOutCubic(fadeIn) * 0.6;
  const fadeOut = (elapsedMs - holdEnd) / DIM_IN_MS;
  return (1 - easeOutCubic(Math.min(1, fadeOut))) * 0.6;
}

function snapshotHolderVisual(target: LocatorTarget) {
  if (target.kind !== "holder") return;
  searchHighlightStore.position = target.position;
  searchHighlightStore.color = target.color;
  if (target.starKind === "top75" && target.baseCoreSize != null) {
    searchHighlightStore.baseVisual = {
      coreSize: target.baseCoreSize,
      glowSize: target.baseGlowSize ?? 8,
      glowOpacity: target.baseGlowOpacity ?? 0.3,
      brightness: target.baseBrightness ?? 1.0,
      sparkle: target.baseSparkle ?? 0.45,
    };
  } else {
    searchHighlightStore.baseVisual = {
      coreSize: 1.4,
      glowSize: 2.2,
      glowOpacity: 0.22,
      brightness: 0.55,
      sparkle: 0.18,
    };
  }
}

export default function SearchLocator({
  target,
  locatorKey,
  highlightPersist,
  onHighlightDismissed,
}: SearchLocatorProps) {
  const { camera, clock } = useThree();
  const pingStartMs = useRef(performance.now());
  const growStartMs = useRef(performance.now());
  const shrinkStartMs = useRef<number | null>(null);
  const shrinkFrom = useRef(1);
  const enlargeRef = useRef(0);
  const wasPersisting = useRef(false);
  const dismissedRef = useRef(false);
  const highlightPersistRef = useRef(highlightPersist);

  const dimRef = useRef<THREE.Mesh>(null);
  const dimMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    [],
  );

  highlightPersistRef.current = highlightPersist;

  const resetLocatorTimers = () => {
    const now = performance.now();
    pingStartMs.current = now;
    growStartMs.current = now;
    shrinkStartMs.current = null;
    dismissedRef.current = false;
  };

  useLayoutEffect(() => {
    if (locatorKey === 0) return;
    resetLocatorTimers();
    wasPersisting.current = highlightPersist;
    if (target?.kind === "holder") {
      snapshotHolderVisual(target);
    }
  }, [locatorKey, target]);

  useEffect(() => {
    if (wasPersisting.current && !highlightPersist && target) {
      shrinkFrom.current = Math.max(enlargeRef.current, 0.15);
      shrinkStartMs.current = performance.now();
    }
    wasPersisting.current = highlightPersist;
  }, [highlightPersist, target]);

  useFrame(() => {
    if (!target) {
      shrinkStartMs.current = null;
      dimMat.opacity = 0;
      searchHighlightStore.enlarge = 0;
      searchHighlightStore.glimmer = 1;
      searchHighlightStore.dimOpacity = 0;
      searchHighlightStore.highlightPersist = false;
      searchHighlightStore.wallet = null;
      searchHighlightStore.starKind = null;
      searchHighlightStore.pyreGleam = 0;
      searchHighlightStore.position = null;
      searchHighlightStore.color = null;
      searchHighlightStore.baseVisual = null;
      return;
    }

    const now = performance.now();
    const pingElapsedMs = now - pingStartMs.current;
    const dim = dimOpacity(pingElapsedMs);

    let enlarge = 0;
    if (shrinkStartMs.current !== null) {
      const shrinkT = Math.min(1, (now - shrinkStartMs.current) / SHRINK_MS);
      enlarge = shrinkFrom.current * (1 - easeInOutCubic(shrinkT));
      if (
        shrinkT >= 1 &&
        !dismissedRef.current &&
        !highlightPersistRef.current
      ) {
        dismissedRef.current = true;
        onHighlightDismissed?.();
      }
    } else if (highlightPersist) {
      const growT = Math.min(1, (now - growStartMs.current) / GROW_MS);
      enlarge = easeOutCubic(growT);
    }

    enlargeRef.current = enlarge;

    const holderActive = target.kind === "holder" && highlightPersist;
    const glimmer = holderActive
      ? searchHighlightGlimmer(clock.elapsedTime)
      : target.kind === "pyre" && highlightPersist
        ? searchHighlightGlimmer(clock.elapsedTime)
        : 1;

    searchHighlightStore.enlarge = target.kind === "holder" ? enlarge : 0;
    searchHighlightStore.glimmer = glimmer;
    searchHighlightStore.dimOpacity = dim;
    searchHighlightStore.highlightPersist = highlightPersist;
    searchHighlightStore.wallet =
      target.kind === "holder" ? target.wallet : null;
    searchHighlightStore.starKind =
      target.kind === "holder" ? target.starKind : null;
    searchHighlightStore.pyreGleam = target.kind === "pyre" ? enlarge : 0;

    if (dimRef.current) {
      dimMat.opacity = dim;
      const dist = 12;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        camera.quaternion,
      );
      dimRef.current.position
        .copy(camera.position)
        .addScaledVector(forward, dist);
      dimRef.current.quaternion.copy(camera.quaternion);
      const persp = camera as THREE.PerspectiveCamera;
      const vFov = (persp.fov * Math.PI) / 180;
      const height = 2 * Math.tan(vFov / 2) * dist;
      const width = height * persp.aspect;
      dimRef.current.scale.set(width * 1.25, height * 1.25, 1);
      dimRef.current.visible = dim > 0.01;
    }
  }, -100);

  if (!target) return null;

  return (
    <mesh
      ref={dimRef}
      name="search-locator-dim"
      material={dimMat}
      renderOrder={50}
      frustumCulled={false}
      visible={false}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
