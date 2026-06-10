"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import BackgroundStars from "@/components/universe/BackgroundStars";
import CameraResetHandler from "@/components/universe/CameraResetHandler";
import CameraRig from "@/components/universe/CameraRig";
import CentralCore from "@/components/universe/CentralCore";
import CosmicDust from "@/components/universe/CosmicDust";
import GalaxyAtmosphere from "@/components/universe/GalaxyAtmosphere";
import HolderGroupStars from "@/components/universe/HolderGroupStars";
import OuterHolderStars from "@/components/universe/OuterHolderStars";
import SearchLocator from "@/components/universe/SearchLocator";
import { DEFAULT_LAYER_DEBUG } from "@/components/universe/layerDebug";
import StarTooltip from "@/components/universe/StarTooltip";
import SearchBar from "@/components/ui/SearchBar";
import SearchResultLabel from "@/components/ui/SearchResultLabel";
import PyreDetailPanel from "@/components/ui/PyreDetailPanel";
import WalletDetailPanel from "@/components/ui/WalletDetailPanel";
import {
  DEFAULT_CAMERA_FOV,
  DEFAULT_CAMERA_NEAR,
  DEFAULT_CAMERA_FAR,
  MAX_ORBIT_DISTANCE,
  MIN_ORBIT_DISTANCE,
  MIN_POLAR_ANGLE,
  MAX_POLAR_ANGLE,
} from "@/lib/universe/cameraConfig";
import {
  assignHoldersToStars,
  buildOuterHolderStars,
  countClickableStars,
  findHolderByWallet,
  getHolderGroups,
  verifyAssignment,
} from "@/lib/universe";
import {
  locatorFromHolderMatch,
  locatorLabelText,
  parseSearchQuery,
} from "@/lib/universe/resolveSearch";
import type { RankedHolder } from "@/lib/opensea/holders";
import type {
  HolderGroupStar,
  LocatorTarget,
  OuterHolderStar,
  WalletSelection,
} from "@/types/universe";

const CLICKABLE_STAR_COUNT = countClickableStars(getHolderGroups());
const PYRE_POSITION: [number, number, number] = [0, 0, 0];

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

function holderToWalletSelection(group: HolderGroupStar): WalletSelection {
  return {
    wallet: group.wallet ?? group.id,
    walletDisplay: group.walletDisplay ?? group.label,
    normieCount: group.totalNormies,
    rank: group.collectionRank ?? group.rankStart,
  };
}

function outerToWalletSelection(star: OuterHolderStar): WalletSelection {
  return {
    wallet: star.wallet,
    walletDisplay: star.walletDisplay,
    normieCount: star.normieCount,
    rank: star.collectionRank,
  };
}

function SceneContent({
  holderGroups,
  outerStars,
  hoveredId,
  hoveredCore,
  locatorTarget,
  locatorKey,
  pyreLocatorKey,
  reducedMotion,
  isMobile,
  controlsRef,
  resetKey,
  selectedId,
  starHoverRef,
  onLocatorScreenPos,
  onHover,
  onSelect,
  onEmptyClick,
  onCoreHover,
  onPyreClick,
  onResetCamera,
}: {
  holderGroups: HolderGroupStar[];
  outerStars: OuterHolderStar[];
  hoveredId: string | null;
  hoveredCore: boolean;
  locatorTarget: LocatorTarget | null;
  locatorKey: number;
  pyreLocatorKey: number;
  reducedMotion: boolean;
  isMobile: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  resetKey: number;
  selectedId: string | null;
  starHoverRef: React.RefObject<HolderGroupStar | null>;
  onLocatorScreenPos: (pos: { x: number; y: number } | null) => void;
  onHover: (
    group: HolderGroupStar | null,
    screenPos?: { x: number; y: number },
  ) => void;
  onSelect: (group: HolderGroupStar) => void;
  onEmptyClick: () => void;
  onCoreHover: (hovered: boolean, screenPos?: { x: number; y: number }) => void;
  onPyreClick: () => void;
  onResetCamera: () => void;
}) {
  const layerDebug = DEFAULT_LAYER_DEBUG;

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
      <OuterHolderStars stars={outerStars} />
      {layerDebug.cosmicDust ? <CosmicDust /> : null}
      <HolderGroupStars
        groups={holderGroups}
        hoveredId={hoveredId}
        selectedId={selectedId}
        reducedMotion={reducedMotion}
        hoverRef={starHoverRef}
        debugLayers={{
          visible: layerDebug.holderStarVisible,
          glow: layerDebug.holderStarGlow,
          hits: layerDebug.holderStarHits,
        }}
        onHover={onHover}
        onSelect={onSelect}
        onPyreClick={onPyreClick}
        onEmptyClick={onEmptyClick}
      />
      <CentralCore
        isHovered={hoveredCore}
        reducedMotion={reducedMotion}
        debugEnabled={layerDebug.centralCore}
        starHoverRef={starHoverRef}
        pyreLocatorKey={pyreLocatorKey}
        onHover={(hovered, screenPos) => onCoreHover(hovered, screenPos)}
      />

      <SearchLocator
        target={locatorTarget}
        locatorKey={locatorKey}
        onScreenPos={onLocatorScreenPos}
      />

      <CameraRig
        reducedMotion={reducedMotion}
        controlsRef={controlsRef}
        resetKey={resetKey}
      />
      <CameraResetHandler onReset={onResetCamera} />

      <OrbitControls
        ref={controlsRef}
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.22}
        zoomSpeed={0.3}
        minDistance={MIN_ORBIT_DISTANCE}
        maxDistance={MAX_ORBIT_DISTANCE}
        minPolarAngle={MIN_POLAR_ANGLE}
        maxPolarAngle={MAX_POLAR_ANGLE}
        enablePan={false}
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
  const starHoverRef = useRef<HolderGroupStar | null>(null);

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
  const [walletSelection, setWalletSelection] = useState<WalletSelection | null>(
    null,
  );
  const [pyreOpen, setPyreOpen] = useState(false);
  const [hoveredCore, setHoveredCore] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [locatorTarget, setLocatorTarget] = useState<LocatorTarget | null>(null);
  const [locatorKey, setLocatorKey] = useState(0);
  const [pyreLocatorKey, setPyreLocatorKey] = useState(0);
  const [searchLabel, setSearchLabel] = useState<string | null>(null);
  const [labelScreenPos, setLabelScreenPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleLocatorScreenPos = useCallback(
    (pos: { x: number; y: number } | null) => {
      if (searchLabel) setLabelScreenPos(pos);
    },
    [searchLabel],
  );

  const handleHover = useCallback(
    (group: HolderGroupStar | null, screenPos?: { x: number; y: number }) => {
      setHoveredGroup(group);
      setHoveredCore(false);
      setTooltipPos(screenPos ?? null);
    },
    [],
  );

  const handleCoreHover = useCallback(
    (hovered: boolean, screenPos?: { x: number; y: number }) => {
      if (starHoverRef.current) return;
      setHoveredCore(hovered);
      setTooltipPos(hovered ? (screenPos ?? null) : null);
    },
    [],
  );

  const handleSelect = useCallback((group: HolderGroupStar) => {
    setWalletSelection(holderToWalletSelection(group));
    setPyreOpen(false);
    setSearchLabel(null);
    setLocatorTarget(null);
  }, []);

  const handleCoreSelect = useCallback(() => {
    setPyreOpen(true);
    setWalletSelection(null);
    setSearchLabel(null);
    setLocatorTarget(null);
  }, []);

  const handleClosePanel = useCallback(() => {
    setWalletSelection(null);
    setPyreOpen(false);
  }, []);

  const handleEmptyClick = useCallback(() => {
    handleClosePanel();
    setSearchLabel(null);
    setLocatorTarget(null);
    setLabelScreenPos(null);
  }, [handleClosePanel]);

  const handleResetCamera = useCallback(() => {
    setHoveredGroup(null);
    setHoveredCore(false);
    setTooltipPos(null);
    setResetKey((k) => k + 1);
  }, []);

  const activateHolderLocator = useCallback(
    (match: NonNullable<ReturnType<typeof findHolderByWallet>>) => {
      const target = locatorFromHolderMatch(match, holderGroups);
      if (!target) return;

      setLocatorTarget(target);
      setLocatorKey((k) => k + 1);
      setSearchLabel(locatorLabelText(target));

      if (match.kind === "top75") {
        setWalletSelection(holderToWalletSelection(match.star));
      } else {
        setWalletSelection(outerToWalletSelection(match.star));
      }
      setPyreOpen(false);
    },
    [holderGroups],
  );

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchNotFound(false);
      setSearchLabel(null);
      setLocatorTarget(null);
      setLabelScreenPos(null);

      const parsed = parseSearchQuery(query);
      if (parsed.type === "invalid") {
        setSearchNotFound(true);
        return;
      }

      if (parsed.type === "wallet") {
        const match = findHolderByWallet(
          parsed.address,
          holderGroups,
          outerStars,
        );
        if (!match) {
          setSearchNotFound(true);
          return;
        }
        activateHolderLocator(match);
        return;
      }

      try {
        const res = await fetch(`/api/normie/${parsed.id}`);
        if (!res.ok) {
          setSearchNotFound(true);
          return;
        }

        const data = (await res.json()) as
          | { status: "owned"; owner: string }
          | { status: "burned"; tokenId: string };

        if (data.status === "burned") {
          const pyreTarget: LocatorTarget = {
            kind: "pyre",
            tokenId: data.tokenId,
            label: `#${data.tokenId} was burned`,
            position: PYRE_POSITION,
          };
          setLocatorTarget(pyreTarget);
          setLocatorKey((k) => k + 1);
          setPyreLocatorKey((k) => k + 1);
          setSearchLabel(pyreTarget.label);
          setWalletSelection(null);
          setPyreOpen(true);
          return;
        }

        const match = findHolderByWallet(data.owner, holderGroups, outerStars);
        if (!match) {
          setSearchNotFound(true);
          return;
        }
        activateHolderLocator(match);
      } catch {
        setSearchNotFound(true);
      }
    },
    [holderGroups, outerStars, activateHolderLocator],
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <Canvas
        camera={{
          position: [0, 48, 155],
          fov: DEFAULT_CAMERA_FOV,
          near: DEFAULT_CAMERA_NEAR,
          far: DEFAULT_CAMERA_FAR,
        }}
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
          selectedId={
            walletSelection
              ? holderGroups.find((g) => g.wallet === walletSelection.wallet)
                  ?.id ?? null
              : null
          }
          locatorTarget={locatorTarget}
          locatorKey={locatorKey}
          pyreLocatorKey={pyreLocatorKey}
          hoveredCore={hoveredCore}
          reducedMotion={reducedMotion}
          isMobile={isMobile}
          controlsRef={controlsRef}
          resetKey={resetKey}
          starHoverRef={starHoverRef}
          onLocatorScreenPos={handleLocatorScreenPos}
          onHover={handleHover}
          onSelect={handleSelect}
          onPyreClick={handleCoreSelect}
          onEmptyClick={handleEmptyClick}
          onCoreHover={handleCoreHover}
          onResetCamera={handleResetCamera}
        />
      </Canvas>

      <div className="pointer-events-none fixed inset-0 z-30">
        <header className="absolute left-6 top-6 max-w-[calc(50%-12rem)]">
          <h1 className="text-lg font-medium tracking-tight text-white/70 sm:text-xl">
            Normie Universe
          </h1>
          <p className="mt-0.5 text-[11px] text-white/25 sm:text-xs">
            A living map of the Normies holder galaxy
          </p>
        </header>
        <SearchBar onSearch={handleSearch} notFound={searchNotFound} />
      </div>

      <SearchResultLabel text={searchLabel} position={labelScreenPos} />

      <StarTooltip
        group={hoveredGroup}
        showCore={hoveredCore}
        position={tooltipPos}
      />

      <WalletDetailPanel
        selection={walletSelection}
        open={walletSelection !== null}
        onClose={handleClosePanel}
      />
      <PyreDetailPanel open={pyreOpen} onClose={handleClosePanel} />
    </div>
  );
}
