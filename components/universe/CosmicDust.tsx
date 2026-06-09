"use client";

import { Sparkles } from "@react-three/drei";

export default function CosmicDust() {
  return (
    <group name="cosmic-dust">
      <Sparkles
        count={600}
        scale={[200, 32, 200]}
        size={14}
        speed={0}
        opacity={0.005}
        color="#8a9199"
        noise={2.6}
        raycast={() => null}
      />
      <Sparkles
        count={400}
        scale={[165, 24, 165]}
        position={[12, 4, -8]}
        size={11}
        speed={0}
        opacity={0.0035}
        color="#7a8490"
        noise={2}
        raycast={() => null}
      />
    </group>
  );
}
