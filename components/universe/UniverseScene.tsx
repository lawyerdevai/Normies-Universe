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
import OuterHolderStars from "@/components/universe/OuterHolderStars";
import { DEFAULT_LAYER_DEBUG } from "@/components/universe/layerDebug";
import StarTooltip from "@/components/universe/StarTooltip";
import InfoPanel from "@/components/ui/InfoPanel";
import SearchBar from "@/components/ui/SearchBar";
import {
  assignHoldersToStars,
  buildOuterHolderStars,
  countClickableStars,
  findHolderByWallet,
  getHolderGroups,
  verifyAssignment,
} from "@/lib/universe";
import type { RankedHolder } from "@/lib/opensea/holders";
import type { CameraTarget, HolderGroupStar, OuterHolderStar } from "@/types/universe";

const CLICKABLE_STAR_COUNT = countClickableStars(getHolderGroups());

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
  outerStars,
  hoveredId,
  selectedGroup,
  hoveredCore,
  selectedCore,
  cameraTarget,
  pulseWallet,
  pulseKey,
  reducedMotion,
  isMobile,
  controlsRef,
  onHover,
  onSelect,
  onCoreHover,
  onCoreClick,
}: {
  holderGroups: HolderGroupStar[];
  outerStars: OuterHolderStar[];
  hoveredId: string | null;
  selectedGroup: HolderGroupStar | null;
  hoveredCore: boolean;
  selectedCore: boolean;
  cameraTarget: CameraTarget;
  pulseWallet: string | null;
  pulseKey: number;
  reducedMotion: boolean;
  isMobile: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  onHover: (
    group: HolderGroupStar | null,
    screenPos?: { x: number; y: number },
  ) => void;
  onSelect: (group: HolderGroupStar) => void;
  onCoreHover: (hovered: boolean, screenPos?: { x: number; y: number }) => void;
  onCoreClick: () => void;
}) {
  const layerDebug = DEFAULT_LAYER_DEBUG;
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
      <OuterHolderStars
        stars={outerStars}
        pulseWallet={pulseWallet}
        pulseKey={pulseKey}
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
        pulseWallet={pulseWallet}
        pulseKey={pulseKey}
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
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const [holderGroups, setHolderGroups] = useState<HolderGroupStar[]>(() =>
    getHolderGroups(),
  );
  const [outerStars, setOuterStars] = useState<OuterHolderStar[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadHolders() {
      try {
        const res = await fetch("/api/holders");
        if (!res.ok) return;
        const data = (await res.json()) as { rankedHolders: RankedHolder[] };
        if (cancelled) return;

        const assigned = assignHoldersToStars(
          getHolderGroups(),
          data.rankedHolders,
        );
        const outer = buildOuterHolderStars(data.rankedHolders);
        setHolderGroups(assigned);
        setOuterStars(outer);

        if (process.env.NODE_ENV === "development") {
          const check = verifyAssignment(assigned);
          console.info(
            `[Normie Universe] N=${CLICKABLE_STAR_COUNT} top holder stars; ${outer.length} outer holder stars`,
            check,
          );
        }
      } catch {
        // Keep mock positions/labels if API unavailable.
      }
    }

    loadHolders();
    return () => {
      cancelled = true;
    };
  }, []);

  const [hoveredGroup, setHoveredGroup] = useState<HolderGroupStar | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<HolderGroupStar | null>(
    null,
  );
  const [hoveredCore, setHoveredCore] = useState(false);
  const [selectedCore, setSelectedCore] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [searchTarget, setSearchTarget] = useState<CameraTarget | null>(null);
  const [pulseWallet, setPulseWallet] = useState<string | null>(null);
  const [pulseKey, setPulseKey] = useState(0);

  const cameraTarget: CameraTarget = useMemo(() => {
    if (searchTarget) return searchTarget;
    if (selectedGroup) return { type: "group", group: selectedGroup };
    if (selectedCore) return { type: "core" };
    return { type: "overview" };
  }, [searchTarget, selectedGroup, selectedCore]);

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
    setSearchTarget(null);
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
    setSearchTarget(null);
    setHoveredGroup(null);
    setTooltipPos(null);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedGroup(null);
    setSelectedCore(false);
    setSearchTarget(null);
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      const match = findHolderByWallet(query, holderGroups, outerStars);
      if (!match) return;

      const wallet =
        match.kind === "top75"
          ? (match.star.wallet ?? match.star.id)
          : match.star.wallet;

      setSearchTarget({ type: "search", position: match.star.position });
      setSelectedGroup(null);
      setSelectedCore(false);
      setPulseWallet(wallet);
      setPulseKey((k) => k + 1);
    },
    [holderGroups, outerStars],
  );

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
          outerStars={outerStars}
          hoveredId={hoveredGroup?.id ?? null}
          pulseWallet={pulseWallet}
          pulseKey={pulseKey}
          selectedGroup={selectedGroup}
          hoveredCore={hoveredCore}
          selectedCore={selectedCore}
          cameraTarget={cameraTarget}
          reducedMotion={reducedMotion}
          isMobile={isMobile}
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
        <SearchBar onSearch={handleSearch} />
      </div>

      <StarTooltip
        group={hoveredGroup}
        showCore={hoveredCore}
        position={tooltipPos}
      />
      <InfoPanel group={selectedGroup} onBack={handleBack} />
    </div>
  );
}
