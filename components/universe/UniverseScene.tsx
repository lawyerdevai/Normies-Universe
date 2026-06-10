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
import FoundStar from "@/components/universe/FoundStar";
import DeepSpaceGlimmer from "@/components/universe/DeepSpaceGlimmer";
import BurnerStars from "@/components/universe/BurnerStars";
import OuterHolderStars from "@/components/universe/OuterHolderStars";
import SearchLocator from "@/components/universe/SearchLocator";
import { DEFAULT_LAYER_DEBUG } from "@/components/universe/layerDebug";
import StarTooltip from "@/components/universe/StarTooltip";
import SearchBar from "@/components/ui/SearchBar";
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
  applyBurnerColorsToTop75,
  buildDedicatedBurnerStars,
  filterBurnersFromOuterStars,
  top75WalletSet,
} from "@/lib/universe/buildBurnerStars";
import type { BurnersApiResponse } from "@/lib/universe/burnerStarConfig";
import {
  assignHoldersToStars,
  buildOuterHolderStars,
  countClickableStars,
  findHolderByWallet,
  getHolderGroups,
  verifyAssignment,
} from "@/lib/universe";
import { normalizeWalletAddress } from "@/lib/universe/normalizeWalletAddress";
import { parseSearchQuery } from "@/lib/universe/resolveSearch";
import type { RankedHolder } from "@/lib/opensea/holders";
import type {
  BurnerStar,
  HolderGroupStar,
  OuterHolderStar,
  WalletSelection,
} from "@/types/universe";

const CLICKABLE_STAR_COUNT = countClickableStars(getHolderGroups());
type FoundStarState = {
  position: [number, number, number];
  active: boolean;
};

type OuterHighlightState = {
  wallet: string;
  active: boolean;
};

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
    wallet: normalizeWalletAddress(group.wallet ?? group.id),
    walletDisplay: group.walletDisplay ?? group.label,
    normieCount: group.totalNormies,
    rank: group.collectionRank ?? group.rankStart,
  };
}

function outerToWalletSelection(star: OuterHolderStar): WalletSelection {
  return {
    wallet: normalizeWalletAddress(star.wallet ?? star.id),
    walletDisplay: star.walletDisplay,
    normieCount: star.normieCount,
    rank: star.collectionRank,
  };
}

function burnerToWalletSelection(star: BurnerStar): WalletSelection {
  return {
    wallet: normalizeWalletAddress(star.wallet),
    walletDisplay: star.walletDisplay,
    normieCount: star.normieCount,
    rank: star.collectionRank,
  };
}

function searchedStarIndex(
  groups: HolderGroupStar[],
  foundStar: FoundStarState | null,
): number {
  if (!foundStar?.active) return -1;
  const [fx, fy, fz] = foundStar.position;
  return groups.findIndex(
    (g) =>
      Math.abs(g.position[0] - fx) < 0.01 &&
      Math.abs(g.position[1] - fy) < 0.01 &&
      Math.abs(g.position[2] - fz) < 0.01,
  );
}

function SceneContent({
  holderGroups,
  outerStars,
  burnerStars,
  hoveredId,
  hoveredBurnerId,
  hoveredCore,
  dimKey,
  foundStar,
  outerHighlight,
  reducedMotion,
  isMobile,
  controlsRef,
  resetKey,
  selectedId,
  selectedBurnerId,
  starHoverRef,
  burnerCaptureRef,
  onHover,
  onBurnerHover,
  onSelect,
  onBurnerSelect,
  onEmptyClick,
  onCoreHover,
  onPyreClick,
  onResetCamera,
  totalBurned,
}: {
  holderGroups: HolderGroupStar[];
  outerStars: OuterHolderStar[];
  burnerStars: BurnerStar[];
  hoveredId: string | null;
  hoveredBurnerId: string | null;
  hoveredCore: boolean;
  dimKey: number;
  foundStar: FoundStarState | null;
  outerHighlight: OuterHighlightState | null;
  reducedMotion: boolean;
  isMobile: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  resetKey: number;
  selectedId: string | null;
  selectedBurnerId: string | null;
  starHoverRef: React.RefObject<HolderGroupStar | null>;
  burnerCaptureRef: React.RefObject<boolean>;
  onHover: (
    group: HolderGroupStar | null,
    screenPos?: { x: number; y: number },
  ) => void;
  onBurnerHover: (
    star: BurnerStar | null,
    screenPos?: { x: number; y: number },
  ) => void;
  onSelect: (group: HolderGroupStar) => void;
  onBurnerSelect: (star: BurnerStar) => void;
  onEmptyClick: () => void;
  onCoreHover: (hovered: boolean, screenPos?: { x: number; y: number }) => void;
  onPyreClick: () => void;
  onResetCamera: () => void;
  totalBurned: number | null;
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
      <SearchLocator dimKey={dimKey} />

      <OuterHolderStars
        stars={outerStars}
        highlightWallet={outerHighlight?.wallet ?? null}
        highlightActive={outerHighlight?.active ?? false}
      />
      <DeepSpaceGlimmer
        avoidPositions={[
          ...holderGroups.map((g) => g.position),
          ...outerStars.map((s) => s.position),
          ...burnerStars.map((s) => s.position),
        ]}
      />
      <BurnerStars
        stars={burnerStars}
        hoveredId={hoveredBurnerId}
        selectedId={selectedBurnerId}
        captureRef={burnerCaptureRef}
        onHover={onBurnerHover}
        onSelect={onBurnerSelect}
      />

      {/* Top-75 search highlight — outer stars highlight in-place via instanced mesh */}
      {foundStar ? (
        <FoundStar position={foundStar.position} active={foundStar.active} />
      ) : null}
      {layerDebug.cosmicDust ? <CosmicDust /> : null}
      <HolderGroupStars
        groups={holderGroups}
        hoveredId={hoveredId}
        selectedId={selectedId}
        glintExcludeIndex={searchedStarIndex(holderGroups, foundStar)}
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
        skipClickIfBurnerHovered={() => burnerCaptureRef.current}
        skipHoverIfBurnerCaptured={burnerCaptureRef}
      />
      <CentralCore
        isHovered={hoveredCore}
        totalBurned={totalBurned}
        reducedMotion={reducedMotion}
        debugEnabled={layerDebug.centralCore}
        starHoverRef={starHoverRef}
        onHover={(hovered, screenPos) => onCoreHover(hovered, screenPos)}
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
  const [burnerStars, setBurnerStars] = useState<BurnerStar[]>([]);
  const [rankedHolders, setRankedHolders] = useState<RankedHolder[]>([]);
  const [burnerData, setBurnerData] = useState<BurnersApiResponse | null>(
    null,
  );
  const burnerCaptureRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHolders() {
      try {
        const res = await fetch("/api/holders");
        if (!res.ok) return;
        const data = (await res.json()) as { rankedHolders: RankedHolder[] };
        if (cancelled) return;

        setRankedHolders(data.rankedHolders);

        if (process.env.NODE_ENV === "development") {
          const assigned = assignHoldersToStars(
            getHolderGroups(),
            data.rankedHolders,
          );
          const check = verifyAssignment(assigned);
          console.info(
            `[Normie Universe] N=${CLICKABLE_STAR_COUNT} top holder stars; ${buildOuterHolderStars(data.rankedHolders).length} outer holder stars`,
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

  useEffect(() => {
    let cancelled = false;

    fetch("/api/burners")
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<BurnersApiResponse>;
      })
      .then((data) => {
        if (cancelled || !data) return;
        setBurnerData(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!rankedHolders.length) return;

    const baseGroups = assignHoldersToStars(
      getHolderGroups(),
      rankedHolders,
    );
    const outer = buildOuterHolderStars(rankedHolders);

    if (!burnerData?.burners?.length) {
      setHolderGroups(baseGroups);
      setOuterStars(outer);
      setBurnerStars([]);
      return;
    }

    const colored = applyBurnerColorsToTop75(baseGroups, burnerData.burners);
    const top75 = top75WalletSet(colored);
    const filteredOuter = filterBurnersFromOuterStars(outer, burnerData.burners);
    const dedicated = buildDedicatedBurnerStars(
      burnerData.burners,
      top75,
      rankedHolders,
    );

    setHolderGroups(colored);
    setOuterStars(filteredOuter);
    setBurnerStars(dedicated);

    if (process.env.NODE_ENV === "development") {
      console.info(
        `[Normie Universe] ${burnerData.burners.length} burner wallets; ${dedicated.length} dedicated burner stars`,
      );
    }
  }, [rankedHolders, burnerData]);

  const [hoveredGroup, setHoveredGroup] = useState<HolderGroupStar | null>(null);
  const [hoveredBurner, setHoveredBurner] = useState<BurnerStar | null>(null);
  const [walletSelection, setWalletSelection] = useState<WalletSelection | null>(
    null,
  );
  const [pyreOpen, setPyreOpen] = useState(false);
  const [pyreSearchedBurn, setPyreSearchedBurn] = useState<{
    tokenId: string;
    burnedAt: number;
  } | null>(null);
  const [hoveredCore, setHoveredCore] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [dimKey, setDimKey] = useState(0);
  const [foundStar, setFoundStar] = useState<FoundStarState | null>(null);
  const [outerHighlight, setOuterHighlight] =
    useState<OuterHighlightState | null>(null);
  const [totalBurned, setTotalBurned] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/pyre")
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ totalBurned?: number }>;
      })
      .then((data) => {
        if (cancelled || data?.totalBurned == null) return;
        setTotalBurned(data.totalBurned);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const deactivateSearchHighlights = useCallback(() => {
    setFoundStar((prev) => (prev ? { ...prev, active: false } : null));
    setOuterHighlight((prev) => (prev ? { ...prev, active: false } : null));
  }, []);

  const handleHover = useCallback(
    (group: HolderGroupStar | null, screenPos?: { x: number; y: number }) => {
      setHoveredGroup(group);
      if (group) setHoveredBurner(null);
      setHoveredCore(false);
      setTooltipPos(screenPos ?? null);
    },
    [],
  );

  const handleBurnerHover = useCallback(
    (star: BurnerStar | null, screenPos?: { x: number; y: number }) => {
      setHoveredBurner(star);
      if (star) {
        setHoveredGroup(null);
        setHoveredCore(false);
        setTooltipPos(screenPos ?? null);
      }
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
    setPyreSearchedBurn(null);
    deactivateSearchHighlights();
  }, [deactivateSearchHighlights]);

  const handleBurnerSelect = useCallback(
    (star: BurnerStar) => {
      setWalletSelection(burnerToWalletSelection(star));
      setPyreOpen(false);
      setPyreSearchedBurn(null);
      deactivateSearchHighlights();
    },
    [deactivateSearchHighlights],
  );

  const handleCoreSelect = useCallback(() => {
    setPyreSearchedBurn(null);
    setPyreOpen(true);
    setWalletSelection(null);
    deactivateSearchHighlights();
  }, [deactivateSearchHighlights]);

  const handleClosePanel = useCallback(() => {
    setWalletSelection(null);
    setPyreOpen(false);
    setPyreSearchedBurn(null);
    deactivateSearchHighlights();
  }, [deactivateSearchHighlights]);

  const handleEmptyClick = useCallback(() => {
    handleClosePanel();
  }, [handleClosePanel]);

  const handleResetCamera = useCallback(() => {
    setHoveredGroup(null);
    setHoveredBurner(null);
    setHoveredCore(false);
    setTooltipPos(null);
    setResetKey((k) => k + 1);
  }, []);

  const activateHolderSearch = useCallback(
    (match: NonNullable<ReturnType<typeof findHolderByWallet>>) => {
      setDimKey((k) => k + 1);

      if (match.kind === "top75") {
        setOuterHighlight(null);
        setFoundStar({
          position: [...match.star.position],
          active: true,
        });
        setWalletSelection(holderToWalletSelection(match.star));
      } else {
        setFoundStar(null);
        setOuterHighlight({
          wallet: normalizeWalletAddress(match.star.wallet ?? match.star.id),
          active: true,
        });
        setWalletSelection(outerToWalletSelection(match.star));
      }
      setPyreOpen(false);
      setPyreSearchedBurn(null);
    },
    [],
  );

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchNotFound(false);

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
        activateHolderSearch(match);
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
          | { status: "burned"; tokenId: string; burnedAt: number };

        if (data.status === "burned") {
          deactivateSearchHighlights();
          setDimKey((k) => k + 1);
          setWalletSelection(null);
          setPyreSearchedBurn({
            tokenId: data.tokenId,
            burnedAt: data.burnedAt,
          });
          setPyreOpen(true);
          return;
        }

        const match = findHolderByWallet(
          normalizeWalletAddress(data.owner),
          holderGroups,
          outerStars,
        );
        if (!match) {
          setSearchNotFound(true);
          return;
        }
        activateHolderSearch(match);
      } catch {
        setSearchNotFound(true);
      }
    },
    [holderGroups, outerStars, activateHolderSearch, deactivateSearchHighlights],
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
          burnerStars={burnerStars}
          hoveredId={hoveredGroup?.id ?? null}
          hoveredBurnerId={hoveredBurner?.id ?? null}
          selectedId={
            walletSelection
              ? holderGroups.find(
                  (g) =>
                    g.wallet &&
                    normalizeWalletAddress(g.wallet) ===
                      normalizeWalletAddress(walletSelection.wallet),
                )?.id ?? null
              : null
          }
          selectedBurnerId={
            walletSelection
              ? burnerStars.find(
                  (s) =>
                    normalizeWalletAddress(s.wallet) ===
                    normalizeWalletAddress(walletSelection.wallet),
                )?.id ?? null
              : null
          }
          dimKey={dimKey}
          foundStar={foundStar}
          outerHighlight={outerHighlight}
          hoveredCore={hoveredCore}
          reducedMotion={reducedMotion}
          isMobile={isMobile}
          controlsRef={controlsRef}
          resetKey={resetKey}
          starHoverRef={starHoverRef}
          burnerCaptureRef={burnerCaptureRef}
          onHover={handleHover}
          onBurnerHover={handleBurnerHover}
          onSelect={handleSelect}
          onBurnerSelect={handleBurnerSelect}
          onPyreClick={handleCoreSelect}
          onEmptyClick={handleEmptyClick}
          onCoreHover={handleCoreHover}
          onResetCamera={handleResetCamera}
          totalBurned={totalBurned}
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

      <StarTooltip
        group={hoveredGroup}
        burnerStar={hoveredBurner}
        showCore={hoveredCore}
        position={tooltipPos}
        totalBurned={totalBurned}
      />

      <WalletDetailPanel
        selection={walletSelection}
        open={walletSelection !== null}
        onClose={handleClosePanel}
      />
      <PyreDetailPanel
        open={pyreOpen}
        searchedBurn={pyreSearchedBurn}
        onClose={handleClosePanel}
      />
    </div>
  );
}
