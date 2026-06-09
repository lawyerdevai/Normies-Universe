"use client";

import { Sparkles } from "@react-three/drei";

export default function CosmicDust() {
  return (
    <group name="cosmic-dust">
      <Sparkles
        count={600}
        scale={[220, 50, 220]}
        size={22}
        speed={0.006}
        opacity={0.028}
        color="#8a9199"
        noise={2.6}
      />
      <Sparkles
        count={400}
        scale={[180, 35, 180]}
        position={[12, 4, -8]}
        size={18}
        speed={0.004}
        opacity={0.018}
        color="#7a8490"
        noise={2}
      />
    </group>
  );
}
