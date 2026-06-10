"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildDecorativeSkyStars } from "@/lib/universe/buildDecorativeSkyStars";
import { normalizeWalletAddress } from "@/lib/universe/normalizeWalletAddress";
import { LOCATOR_HIGHLIGHT_SCREEN_PX } from "@/lib/universe/screenSpaceLocator";
import {
  createHolderWarmStarTexture,
  HOLDER_SEARCH_WARM,
  searchBreathFactor,
} from "@/lib/universe/searchStarVisual";
import type { DecorativeSkyStar, OuterHolderStar } from "@/types/universe";

function createSkyStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.08, "rgba(255,255,255,0.92)");
  g.addColorStop(0.22, "rgba(255,255,255,0.35)");
  g.addColorStop(0.42, "rgba(255,255,255,0.06)");
  g.addColorStop(0.58, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

type SkyStarLike = DecorativeSkyStar | OuterHolderStar;

function useSkyStarMaterial(texture: THREE.CanvasTexture) {
  return useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [texture],
  );
}

function holderBasePixels(star: OuterHolderStar) {
  let pixels = star.screenPixels;
  if (star.tier === 3) pixels *= 1.08;
  return pixels;
}

function updateSkyInstances(
  mesh: THREE.InstancedMesh,
  stars: SkyStarLike[],
  camera: THREE.Camera,
  pixelWorld: number,
  camQuat: THREE.Quaternion,
  dummy: THREE.Object3D,
  time: number,
) {
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    const [x, y, z] = star.position;
    dummy.position.set(x, y, z);
    dummy.quaternion.copy(camQuat);

    const dist = dummy.position.distanceTo(camera.position);
    let pixels = star.screenPixels;

    if (star.tier === 3) {
      pixels *= 1.08;
    }

    if (star.twinkles) {
      pixels *=
        0.94 + 0.06 * Math.sin(time * star.twinkleSpeed + star.twinklePhase);
    }

    const worldSize = pixels * pixelWorld * dist;
    dummy.scale.set(worldSize, worldSize, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function updateHolderInstances(
  mesh: THREE.InstancedMesh,
  stars: OuterHolderStar[],
  camera: THREE.Camera,
  pixelWorld: number,
  camQuat: THREE.Quaternion,
  dummy: THREE.Object3D,
  time: number,
  highlightIndex: number,
  highlightBlend: number,
  highlightActive: boolean,
  breath: number,
  baseColors: THREE.Color[],
) {
  let colorsDirty = false;

  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    const [x, y, z] = star.position;
    dummy.position.set(x, y, z);
    dummy.quaternion.copy(camQuat);

    const dist = dummy.position.distanceTo(camera.position);
    const basePixels = holderBasePixels(star);
    let pixels = basePixels;
    const tierBoost = star.tier === 3 ? 1.12 : 1;
    const baseBrightness = star.opacity * tierBoost;
    let brightness = baseBrightness;

    const highlighted = i === highlightIndex && highlightBlend > 0.001;

    if (highlighted) {
      const targetPx =
        LOCATOR_HIGHLIGHT_SCREEN_PX *
        (highlightActive ? breath : 1);
      pixels =
        basePixels + (targetPx - basePixels) * highlightBlend;
      const targetBright = tierBoost * (highlightActive ? breath : 1);
      brightness =
        baseBrightness +
        (targetBright - baseBrightness) * highlightBlend;
    } else if (star.twinkles) {
      pixels *=
        0.94 + 0.06 * Math.sin(time * star.twinkleSpeed + star.twinklePhase);
    }

    const worldSize = pixels * pixelWorld * dist;
    dummy.scale.set(worldSize, worldSize, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    if (mesh.instanceColor && highlightIndex >= 0 && highlightBlend > 0.001) {
      const c = baseColors[i].clone();
      if (highlighted) {
        const warm = HOLDER_SEARCH_WARM.clone().multiplyScalar(brightness);
        c.lerp(warm, highlightBlend);
      }
      mesh.setColorAt(i, c);
      colorsDirty = true;
    }
  }

  if (
    mesh.instanceColor &&
    highlightIndex >= 0 &&
    highlightBlend <= 0.001
  ) {
    for (let i = 0; i < stars.length; i++) {
      mesh.setColorAt(i, baseColors[i]);
    }
    colorsDirty = true;
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (colorsDirty && mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

interface OuterHolderStarsProps {
  stars: OuterHolderStar[];
  highlightWallet: string | null;
  highlightActive: boolean;
}

export default function OuterHolderStars({
  stars,
  highlightWallet,
  highlightActive,
}: OuterHolderStarsProps) {
  const decorative = useMemo(() => buildDecorativeSkyStars(), []);
  const decoRef = useRef<THREE.InstancedMesh>(null);
  const holderRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const skyTexture = useMemo(() => createSkyStarTexture(), []);
  const warmTexture = useMemo(() => createHolderWarmStarTexture(), []);
  const material = useSkyStarMaterial(skyTexture);
  const decoMaterial = useSkyStarMaterial(skyTexture);
  const highlightBlend = useRef(0);
  const baseColors = useRef<THREE.Color[]>([]);

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  useLayoutEffect(() => {
    const mesh = decoRef.current;
    if (!mesh) return;
    mesh.count = decorative.length;
    decorative.forEach((star, i) => {
      const c = new THREE.Color(star.color[0], star.color[1], star.color[2]);
      c.multiplyScalar(star.opacity);
      mesh.setColorAt(i, c);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.raycast = () => {};
  }, [decorative]);

  useLayoutEffect(() => {
    if (!highlightWallet) {
      highlightBlend.current = 0;
      const mesh = holderRef.current;
      if (mesh?.instanceColor && baseColors.current.length > 0) {
        baseColors.current.forEach((c, i) => mesh.setColorAt(i, c));
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }, [highlightWallet]);

  useLayoutEffect(() => {
    const mesh = holderRef.current;
    if (!mesh) return;
    mesh.count = stars.length;
    baseColors.current = stars.map((star) => {
      const boost = star.tier === 3 ? 1.12 : 1;
      const c = new THREE.Color(star.color[0], star.color[1], star.color[2]);
      c.multiplyScalar(star.opacity * boost);
      return c;
    });
    stars.forEach((star, i) => {
      mesh.setColorAt(i, baseColors.current[i]);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.raycast = () => {};
  }, [stars]);

  useFrame(({ clock, camera, size }, dt) => {
    const persp = camera as THREE.PerspectiveCamera;
    const pixelWorld = (2 * Math.tan((persp.fov * Math.PI) / 360)) / size.height;
    const camQuat = camera.quaternion;
    const time = clock.elapsedTime;

    const goal = highlightWallet && highlightActive ? 1 : 0;
    highlightBlend.current +=
      (goal - highlightBlend.current) * Math.min(1, dt * 5);
    const breath =
      highlightWallet && highlightActive
        ? searchBreathFactor(time)
        : 1;

    let highlightIndex = -1;
    if (highlightWallet) {
      const key = normalizeWalletAddress(highlightWallet);
      highlightIndex = stars.findIndex(
        (s) => normalizeWalletAddress(s.wallet ?? s.id) === key,
      );
    }

    if (decoRef.current) {
      updateSkyInstances(
        decoRef.current,
        decorative,
        camera,
        pixelWorld,
        camQuat,
        dummy,
        time,
      );
    }

    if (holderRef.current) {
      const highlighting = highlightBlend.current > 0.001;
      material.map = highlighting ? warmTexture : skyTexture;
      if (highlighting) {
        material.color.copy(HOLDER_SEARCH_WARM);
      } else {
        material.color.set("#ffffff");
      }

      updateHolderInstances(
        holderRef.current,
        stars,
        camera,
        pixelWorld,
        camQuat,
        dummy,
        time,
        highlightIndex,
        highlightBlend.current,
        highlightActive,
        breath,
        baseColors.current,
      );
    }
  });

  return (
    <group name="outer-sky-field">
      {decorative.length > 0 ? (
        <instancedMesh
          ref={decoRef}
          args={[geometry, decoMaterial, decorative.length]}
          frustumCulled={false}
          renderOrder={1}
          raycast={() => null}
        />
      ) : null}
      {stars.length > 0 ? (
        <instancedMesh
          ref={holderRef}
          args={[geometry, material, stars.length]}
          frustumCulled={false}
          renderOrder={5}
          raycast={() => null}
        />
      ) : null}
    </group>
  );
}
