"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildDecorativeSkyStars } from "@/lib/universe/buildDecorativeSkyStars";
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

function useSkyStarMaterial() {
  return useMemo(() => {
    const tex = createSkyStarTexture();
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
  }, []);
}

function updateSkyInstances(
  mesh: THREE.InstancedMesh,
  stars: SkyStarLike[],
  camera: THREE.Camera,
  pixelWorld: number,
  camQuat: THREE.Quaternion,
  dummy: THREE.Object3D,
  time: number,
  pulseIndex: number,
  pulseStrength: number,
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
      pixels *= 0.94 + 0.06 * Math.sin(time * star.twinkleSpeed + star.twinklePhase);
    }

    if (pulseIndex === i) {
      pixels *= 1 + pulseStrength * 0.55;
    }

    const worldSize = pixels * pixelWorld * dist;
    dummy.scale.set(worldSize, worldSize, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

interface OuterHolderStarsProps {
  stars: OuterHolderStar[];
  pulseWallet: string | null;
  pulseKey: number;
}

export default function OuterHolderStars({
  stars,
  pulseWallet,
  pulseKey,
}: OuterHolderStarsProps) {
  const decorative = useMemo(() => buildDecorativeSkyStars(), []);
  const decoRef = useRef<THREE.InstancedMesh>(null);
  const holderRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const material = useSkyStarMaterial();
  const pulseStart = useRef(0);
  const pulseIndex = useRef(-1);
  const walletIndex = useRef(new Map<string, number>());

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  useLayoutEffect(() => {
    walletIndex.current = new Map(
      stars.map((s, i) => [s.wallet.toLowerCase(), i]),
    );
  }, [stars]);

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
    const mesh = holderRef.current;
    if (!mesh) return;
    mesh.count = stars.length;
    stars.forEach((star, i) => {
      const boost = star.tier === 3 ? 1.12 : 1;
      const c = new THREE.Color(star.color[0], star.color[1], star.color[2]);
      c.multiplyScalar(star.opacity * boost);
      mesh.setColorAt(i, c);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.raycast = () => {};
  }, [stars]);

  useLayoutEffect(() => {
    if (!pulseWallet) return;
    const idx = walletIndex.current.get(pulseWallet.toLowerCase());
    if (idx === undefined) return;
    pulseIndex.current = idx;
    pulseStart.current = performance.now() / 1000;
  }, [pulseWallet, pulseKey]);

  useFrame(({ clock, camera, size }) => {
    const persp = camera as THREE.PerspectiveCamera;
    const pixelWorld = (2 * Math.tan((persp.fov * Math.PI) / 360)) / size.height;
    const camQuat = camera.quaternion;
    const time = clock.elapsedTime;

    let pulseStrength = 0;
    if (pulseIndex.current >= 0) {
      const elapsed = performance.now() / 1000 - pulseStart.current;
      if (elapsed > 1.2) {
        pulseIndex.current = -1;
      } else {
        pulseStrength = Math.sin(Math.min(elapsed / 0.55, 1) * Math.PI);
      }
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
        -1,
        0,
      );
    }

    if (holderRef.current) {
      updateSkyInstances(
        holderRef.current,
        stars,
        camera,
        pixelWorld,
        camQuat,
        dummy,
        time,
        pulseIndex.current,
        pulseStrength,
      );
    }
  });

  return (
    <group name="outer-sky-field">
      {decorative.length > 0 ? (
        <instancedMesh
          ref={decoRef}
          args={[geometry, material, decorative.length]}
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
