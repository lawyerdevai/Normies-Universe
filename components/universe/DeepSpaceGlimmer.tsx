"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { pickDeepSpaceGlimmerPosition } from "@/lib/universe/placeDeepSpaceGlimmer";

const FADE_IN = 0.8;
const HOLD = 0.5;
const FADE_OUT = 1.5;
const DURATION = FADE_IN + HOLD + FADE_OUT;
const INTERVAL_MIN = 12;
const INTERVAL_MAX = 20;
/** Mid-tier — above background, below top-75 holder stars. */
const PEAK_SCREEN_PX = 6.5;

function smoothstep01(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function glimmerOpacity(age: number): number {
  if (age < 0 || age >= DURATION) return 0;
  if (age < FADE_IN) return smoothstep01(age / FADE_IN);
  if (age < FADE_IN + HOLD) return 1;
  return 1 - smoothstep01((age - FADE_IN - HOLD) / FADE_OUT);
}

function createGlimmerTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
  g.addColorStop(0, "rgba(255,252,248,1)");
  g.addColorStop(0.1, "rgba(248,250,255,0.96)");
  g.addColorStop(0.28, "rgba(230,238,255,0.55)");
  g.addColorStop(0.48, "rgba(210,225,255,0.14)");
  g.addColorStop(0.68, "rgba(190,210,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

interface DeepSpaceGlimmerProps {
  avoidPositions?: [number, number, number][];
}

export default function DeepSpaceGlimmer({
  avoidPositions = [],
}: DeepSpaceGlimmerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const state = useRef({
    active: false,
    startTime: 0,
    nextAt: INTERVAL_MIN + Math.random() * (INTERVAL_MAX - INTERVAL_MIN),
    position: [0, 0, 0] as [number, number, number],
  });

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const texture = useMemo(() => createGlimmerTexture(), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        color: new THREE.Color("#f4f7ff"),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [texture],
  );

  useFrame(({ clock, camera, size }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const t = clock.elapsedTime;
    const s = state.current;

    if (!s.active && t >= s.nextAt) {
      const pos = pickDeepSpaceGlimmerPosition(avoidPositions);
      if (pos) {
        s.active = true;
        s.startTime = t;
        s.position = pos;
        s.nextAt = t + INTERVAL_MIN + Math.random() * (INTERVAL_MAX - INTERVAL_MIN);
      } else {
        s.nextAt = t + 2;
      }
    }

    if (!s.active) {
      mesh.visible = false;
      material.opacity = 0;
      return;
    }

    const age = t - s.startTime;
    const opacity = glimmerOpacity(age);

    if (opacity <= 0.001) {
      s.active = false;
      mesh.visible = false;
      material.opacity = 0;
      return;
    }

    mesh.visible = true;
    mesh.position.set(...s.position);
    mesh.quaternion.copy(camera.quaternion);

    const persp = camera as THREE.PerspectiveCamera;
    const pixelWorld =
      (2 * Math.tan((persp.fov * Math.PI) / 360)) / size.height;
    const dist = mesh.position.distanceTo(camera.position);
    const worldSize = PEAK_SCREEN_PX * opacity * pixelWorld * dist;
    mesh.scale.set(worldSize, worldSize, 1);
    material.opacity = Math.min(1, opacity * 0.95);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={2}
      visible={false}
      raycast={() => null}
    />
  );
}
