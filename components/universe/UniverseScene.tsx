"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import BackgroundStars from "@/components/universe/BackgroundStars";
import CameraRig from "@/components/universe/CameraRig";
import CentralCore from "@/components/universe/CentralCore";
import CosmicDust from "@/components/universe/CosmicDust";
import GalaxyAtmosphere from "@/components/universe/GalaxyAtmosphere";
import HolderGroupStars from "@/components/universe/HolderGroupStars";
import LayerDebugPanel from "@/components/universe/LayerDebugPanel";
import {
  DEFAULT_LAYER_DEBUG,
  type LayerDebugState,
} from "@/components/universe/layerDebug";
import StarTooltip from "@/components/universe/StarTooltip";
import InfoPanel from "@/components/ui/InfoPanel";
import Legend from "@/components/ui/Legend";
import SearchBar from "@/components/ui/SearchBar";
import { loadUniverseData } from "@/lib/universe";
import type { CameraTarget, HolderGroupStar } from "@/types/universe";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

function SceneContent({
  holderGroups,
  hoveredId,
  selectedGroup,
  hoveredCore,
  selectedCore,
  cameraTarget,
  reducedMotion,
  isMobile,
  controlsRef,
  onHover,
  onSelect,
  onCoreHover,
  onCoreClick,
  layerDebug,
}: {
  holderGroups: HolderGroupStar[];
  hoveredId: string | null;
  selectedGroup: HolderGroupStar | null;
  hoveredCore: boolean;
  selectedCore: boolean;
  cameraTarget: CameraTarget;
  reducedMotion: boolean;
  isMobile: boolean;
  layerDebug: LayerDebugState;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  onHover: (
    group: HolderGroupStar | null,
    screenPos?: { x: number; y: number },
  ) => void;
  onSelect: (group: HolderGroupStar) => void;
  onCoreHover: (hovered: boolean, screenPos?: { x: number; y: number }) => void;
  onCoreClick: () => void;
}) {
  const isOverview = cameraTarget.type === "overview";

  return (
    <>
      <color attach="background" args={["#000000"]} />
      {layerDebug.fog ? (
        <fog attach="fog" args={["#000000", 200, 480]} />
      ) : null}

      <BackgroundStars
        debugLayers={{
          enabled: layerDebug.backgroundStars,
          particleHalo: layerDebug.backgroundParticleHalo,
        }}
      />
      <GalaxyAtmosphere
        debugLayers={{
          enabled: layerDebug.galaxyAtmosphere,
          bulge: layerDebug.galaxyBulge,
          arms: layerDebug.galaxyArms,
          particleHalo: layerDebug.galaxyParticleHalo,
        }}
      />
      {layerDebug.cosmicDust ? <CosmicDust /> : null}
      <CentralCore
        isHovered={hoveredCore}
        isSelected={selectedCore}
        reducedMotion={reducedMotion}
        debugEnabled={layerDebug.centralCore}
        onClick={onCoreClick}
        onHover={(hovered, screenPos) => onCoreHover(hovered, screenPos)}
      />
      <HolderGroupStars
        groups={holderGroups}
        hoveredId={hoveredId}
        selectedId={selectedGroup?.id ?? null}
        reducedMotion={reducedMotion}
        debugLayers={{
          visible: layerDebug.holderStarVisible,
          glow: layerDebug.holderStarGlow,
          hits: layerDebug.holderStarHits,
        }}
        onHover={onHover}
        onSelect={onSelect}
      />

      <CameraRig
        cameraTarget={cameraTarget}
        reducedMotion={reducedMotion}
        controlsRef={controlsRef}
      />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.22}
        zoomSpeed={0.3}
        panSpeed={0.18}
        minDistance={18}
        maxDistance={200}
        maxPolarAngle={Math.PI / 2.05}
        enablePan={isOverview}
        enabled={isOverview}
      />

      {!isMobile && layerDebug.bloom && layerDebug.vignette ? (
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={1.2}
            luminanceThreshold={0.13}
            luminanceSmoothing={0.6}
            mipmapBlur
            radius={0.7}
          />
          <Vignette eskil={false} offset={0.4} darkness={0.6} />
        </EffectComposer>
      ) : null}
      {!isMobile && layerDebug.bloom && !layerDebug.vignette ? (
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={1.2}
            luminanceThreshold={0.13}
            luminanceSmoothing={0.6}
            mipmapBlur
            radius={0.7}
          />
        </EffectComposer>
      ) : null}
      {!isMobile && !layerDebug.bloom && layerDebug.vignette ? (
        <EffectComposer multisampling={0}>
          <Vignette eskil={false} offset={0.4} darkness={0.6} />
        </EffectComposer>
      ) : null}
    </>
  );
}

export default function UniverseScene() {
  const { holderGroups } = useMemo(() => loadUniverseData(), []);
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [layerDebug, setLayerDebug] = useState<LayerDebugState>(
    DEFAULT_LAYER_DEBUG,
  );

  const [hoveredGroup, setHoveredGroup] = useState<HolderGroupStar | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<HolderGroupStar | null>(
    null,
  );
  const [hoveredCore, setHoveredCore] = useState(false);
  const [selectedCore, setSelectedCore] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const cameraTarget: CameraTarget = useMemo(() => {
    if (selectedGroup) return { type: "group", group: selectedGroup };
    if (selectedCore) return { type: "core" };
    return { type: "overview" };
  }, [selectedGroup, selectedCore]);

  const handleHover = useCallback(
    (group: HolderGroupStar | null, screenPos?: { x: number; y: number }) => {
      setHoveredGroup(group);
      setHoveredCore(false);
      setTooltipPos(screenPos ?? null);
    },
    [],
  );

  const handleSelect = useCallback((group: HolderGroupStar) => {
    setSelectedGroup(group);
    setSelectedCore(false);
    setHoveredGroup(null);
    setTooltipPos(null);
  }, []);

  const handleCoreHover = useCallback(
    (hovered: boolean, screenPos?: { x: number; y: number }) => {
      setHoveredCore(hovered);
      if (hovered) {
        setHoveredGroup(null);
        setTooltipPos(screenPos ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 });
      } else if (!hoveredGroup) {
        setTooltipPos(null);
      }
    },
    [hoveredGroup],
  );

  const handleCoreClick = useCallback(() => {
    setSelectedCore(true);
    setSelectedGroup(null);
    setHoveredGroup(null);
    setTooltipPos(null);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedGroup(null);
    setSelectedCore(false);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <Canvas
        camera={{ position: [0, 48, 155], fov: 50, near: 0.1, far: 500 }}
        dpr={isMobile ? 1 : [1, 1.5]}
        gl={{
          antialias: !isMobile,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.85,
        }}
        className="absolute inset-0"
      >
        <SceneContent
          holderGroups={holderGroups}
          hoveredId={hoveredGroup?.id ?? null}
          selectedGroup={selectedGroup}
          hoveredCore={hoveredCore}
          selectedCore={selectedCore}
          cameraTarget={cameraTarget}
          reducedMotion={reducedMotion}
          isMobile={isMobile}
          layerDebug={layerDebug}
          controlsRef={controlsRef}
          onHover={handleHover}
          onSelect={handleSelect}
          onCoreHover={handleCoreHover}
          onCoreClick={handleCoreClick}
        />
      </Canvas>

      <div className="pointer-events-none fixed inset-0 z-30">
        <header className="absolute left-6 top-6">
          <h1 className="text-lg font-medium tracking-tight text-white/70 sm:text-xl">
            Normie Universe
          </h1>
          <p className="mt-0.5 text-[11px] text-white/25 sm:text-xs">
            A living map of the Normies holder galaxy
          </p>
        </header>
        <SearchBar />
        <Legend />
      </div>

      <StarTooltip
        group={hoveredGroup}
        showCore={hoveredCore}
        position={tooltipPos}
      />
      <InfoPanel group={selectedGroup} onBack={handleBack} />
      <LayerDebugPanel layers={layerDebug} onChange={setLayerDebug} />
    </div>
  );
}
