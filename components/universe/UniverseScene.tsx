"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import BackgroundStars from "@/components/universe/BackgroundStars";
import GalaxyArrivalController from "@/components/universe/GalaxyArrivalController";
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
import ZombieLeaderboardStar from "@/components/universe/ZombieLeaderboardStar";
import SearchLocator from "@/components/universe/SearchLocator";
import { DEFAULT_LAYER_DEBUG } from "@/components/universe/layerDebug";
import StarTooltip from "@/components/universe/StarTooltip";
import SearchBar from "@/components/ui/SearchBar";
import PyreDetailPanel from "@/components/ui/PyreDetailPanel";
import WalletDetailPanel from "@/components/ui/WalletDetailPanel";
import ZombieLeaderboard from "@/components/ui/ZombieLeaderboard";
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
import { ZOMBIE_LEADERBOARD_STAR_POSITION } from "@/lib/universe/zombieLeaderboardStar";
import {
  assignHoldersToStars,
  buildOuterHolderStars,
  countClickableStars,
  findHolderByWallet,
  getHolderGroups,
  verifyAssignment,
} from "@/lib/universe";
import type { HolderSearchMatch } from "@/lib/universe/searchHolderStars";
import { normalizeWalletAddress } from "@/lib/universe/normalizeWalletAddress";
import { GALAXY_ARRIVAL_ACTIVE } from "@/lib/universe/galaxyArrival";
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

function searchFocusPosition(
  match: HolderSearchMatch,
): [number, number, number] {
  return [...match.star.position];
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
  searchFocus,
  searchFocusKey,
  reducedMotion,
  isMobile,
  controlsRef,
  resetKey,
  selectedId,
  selectedBurnerId,
  starHoverRef,
  burnerCaptureRef,
  zombieCaptureRef,
  hoveredZombieLeaderboard,
  onHover,
  onBurnerHover,
  onZombieLeaderboardHover,
  onSelect,
  onBurnerSelect,
  onZombieLeaderboardSelect,
  onEmptyClick,
  onCoreHover,
  onPyreClick,
  onResetCamera,
  totalBurned,
  arrivalActive,
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
  searchFocus: [number, number, number] | null;
  searchFocusKey: number;
  reducedMotion: boolean;
  isMobile: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  resetKey: number;
  selectedId: string | null;
  selectedBurnerId: string | null;
  starHoverRef: React.RefObject<HolderGroupStar | null>;
  burnerCaptureRef: React.RefObject<boolean>;
  zombieCaptureRef: React.RefObject<boolean>;
  hoveredZombieLeaderboard: boolean;
  onHover: (
    group: HolderGroupStar | null,
    screenPos?: { x: number; y: number },
  ) => void;
  onBurnerHover: (
    star: BurnerStar | null,
    screenPos?: { x: number; y: number },
  ) => void;
  onZombieLeaderboardHover: (
    hovered: boolean,
    screenPos?: { x: number; y: number },
  ) => void;
  onSelect: (group: HolderGroupStar) => void;
  onBurnerSelect: (star: BurnerStar) => void;
  onZombieLeaderboardSelect: () => void;
  onEmptyClick: () => void;
  onCoreHover: (hovered: boolean, screenPos?: { x: number; y: number }) => void;
  onPyreClick: () => void;
  onResetCamera: () => void;
  totalBurned: number | null;
  arrivalActive: boolean;
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
          ZOMBIE_LEADERBOARD_STAR_POSITION,
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
      <ZombieLeaderboardStar
        hovered={hoveredZombieLeaderboard}
        captureRef={zombieCaptureRef}
        onHover={onZombieLeaderboardHover}
        onSelect={onZombieLeaderboardSelect}
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
        skipClickIfBurnerHovered={() =>
          burnerCaptureRef.current || zombieCaptureRef.current
        }
        skipHoverIfBurnerCaptured={burnerCaptureRef}
        skipHoverIfZombieCaptured={zombieCaptureRef}
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
        arrivalActive={arrivalActive}
        controlsRef={controlsRef}
        resetKey={resetKey}
        searchFocus={searchFocus}
        searchFocusKey={searchFocusKey}
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

interface UniverseSceneProps {
  initialBurnerData?: BurnersApiResponse | null;
}

export default function UniverseScene({
  initialBurnerData = null,
}: UniverseSceneProps) {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const starHoverRef = useRef<HolderGroupStar | null>(null);
  const [arrivalActive, setArrivalActive] = useState(false);

  useEffect(() => {
    const fromStarform = sessionStorage.getItem(GALAXY_ARRIVAL_ACTIVE) === "1";
    if (!fromStarform) return;

    sessionStorage.removeItem(GALAXY_ARRIVAL_ACTIVE);
    setArrivalActive(true);

    const endTimer = window.setTimeout(() => setArrivalActive(false), 4000);

    return () => {
      window.clearTimeout(endTimer);
    };
  }, []);

  const [holderGroups, setHolderGroups] = useState<HolderGroupStar[]>(() =>
    getHolderGroups(),
  );
  const [outerStars, setOuterStars] = useState<OuterHolderStar[]>([]);
  const [burnerStars, setBurnerStars] = useState<BurnerStar[]>([]);
  const [rankedHolders, setRankedHolders] = useState<RankedHolder[]>([]);
  const [burnerData, setBurnerData] = useState<BurnersApiResponse | null>(
    initialBurnerData,
  );
  const burnerCaptureRef = useRef(false);
  const zombieCaptureRef = useRef(false);
  const [hoveredZombieLeaderboard, setHoveredZombieLeaderboard] =
    useState(false);
  const [zombieLeaderboardOpen, setZombieLeaderboardOpen] = useState(false);

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
    if (initialBurnerData) return;

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
  }, [initialBurnerData]);

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
  const [highlightTokenId, setHighlightTokenId] = useState<string | null>(
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
  const [searchFocus, setSearchFocus] = useState<
    [number, number, number] | null
  >(null);
  const [searchFocusKey, setSearchFocusKey] = useState(0);
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
    setSearchFocus(null);
  }, []);

  const handleHover = useCallback(
    (group: HolderGroupStar | null, screenPos?: { x: number; y: number }) => {
      setHoveredGroup(group);
      if (group) {
        setHoveredBurner(null);
        setHoveredZombieLeaderboard(false);
      }
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
        setHoveredZombieLeaderboard(false);
        setHoveredCore(false);
        setTooltipPos(screenPos ?? null);
      }
    },
    [],
  );

  const handleZombieLeaderboardHover = useCallback(
    (hovered: boolean, screenPos?: { x: number; y: number }) => {
      setHoveredZombieLeaderboard(hovered);
      if (hovered) {
        setHoveredGroup(null);
        setHoveredBurner(null);
        setHoveredCore(false);
        setTooltipPos(screenPos ?? null);
      }
    },
    [],
  );

  const handleZombieLeaderboardSelect = useCallback(() => {
    setZombieLeaderboardOpen(true);
  }, []);

  const handleCoreHover = useCallback(
    (hovered: boolean, screenPos?: { x: number; y: number }) => {
      if (starHoverRef.current) return;
      setHoveredCore(hovered);
      if (hovered) setHoveredZombieLeaderboard(false);
      setTooltipPos(hovered ? (screenPos ?? null) : null);
    },
    [],
  );

  const handleSelect = useCallback((group: HolderGroupStar) => {
    setHighlightTokenId(null);
    setWalletSelection(holderToWalletSelection(group));
    setPyreOpen(false);
    setPyreSearchedBurn(null);
    deactivateSearchHighlights();
  }, [deactivateSearchHighlights]);

  const handleBurnerSelect = useCallback(
    (star: BurnerStar) => {
      setHighlightTokenId(null);
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
    setHighlightTokenId(null);
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
    deactivateSearchHighlights();
    setResetKey((k) => k + 1);
  }, [deactivateSearchHighlights]);

  const activateHolderSearch = useCallback(
    (match: NonNullable<ReturnType<typeof findHolderByWallet>>) => {
      setDimKey((k) => k + 1);
      setSearchFocus(searchFocusPosition(match));
      setSearchFocusKey((k) => k + 1);

      if (match.kind === "top75") {
        setOuterHighlight(null);
        setFoundStar({
          position: [...match.star.position],
          active: true,
        });
        setWalletSelection(holderToWalletSelection(match.star));
      } else if (match.kind === "outer") {
        setFoundStar(null);
        setOuterHighlight({
          wallet: normalizeWalletAddress(match.star.wallet ?? match.star.id),
          active: true,
        });
        setWalletSelection(outerToWalletSelection(match.star));
      } else {
        setOuterHighlight(null);
        setFoundStar({
          position: [...match.star.position],
          active: true,
        });
        setWalletSelection(burnerToWalletSelection(match.star));
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
          burnerStars,
        );
        if (!match) {
          setSearchNotFound(true);
          return;
        }
        setHighlightTokenId(null);
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
          setHighlightTokenId(null);
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
          burnerStars,
        );
        if (!match) {
          setSearchNotFound(true);
          return;
        }
        setHighlightTokenId(String(parsed.id));
        activateHolderSearch(match);
      } catch {
        setSearchNotFound(true);
      }
    },
    [
      holderGroups,
      outerStars,
      burnerStars,
      activateHolderSearch,
      deactivateSearchHighlights,
    ],
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
        <GalaxyArrivalController
          active={arrivalActive}
          controlsRef={controlsRef}
        >
          <SceneContent
            holderGroups={holderGroups}
            outerStars={outerStars}
            burnerStars={burnerStars}
            arrivalActive={arrivalActive}
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
          searchFocus={searchFocus}
          searchFocusKey={searchFocusKey}
          hoveredCore={hoveredCore}
          reducedMotion={reducedMotion}
          isMobile={isMobile}
          controlsRef={controlsRef}
          resetKey={resetKey}
          starHoverRef={starHoverRef}
          burnerCaptureRef={burnerCaptureRef}
          zombieCaptureRef={zombieCaptureRef}
          hoveredZombieLeaderboard={hoveredZombieLeaderboard}
          onHover={handleHover}
          onBurnerHover={handleBurnerHover}
          onZombieLeaderboardHover={handleZombieLeaderboardHover}
          onSelect={handleSelect}
          onBurnerSelect={handleBurnerSelect}
          onZombieLeaderboardSelect={handleZombieLeaderboardSelect}
          onPyreClick={handleCoreSelect}
          onEmptyClick={handleEmptyClick}
          onCoreHover={handleCoreHover}
          onResetCamera={handleResetCamera}
          totalBurned={totalBurned}
          />
        </GalaxyArrivalController>
      </Canvas>

      <div className="pointer-events-none fixed inset-0 z-30">
        <header className="absolute left-6 top-6 max-w-[calc(50%-12rem)]">
          <h1 className="normie-universe-title text-lg text-white/70 sm:text-xl">
            NORMIES UNIVERSE
          </h1>
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
        highlightTokenId={highlightTokenId}
        onClose={handleClosePanel}
      />
      <PyreDetailPanel
        open={pyreOpen}
        searchedBurn={pyreSearchedBurn}
        onClose={handleClosePanel}
      />
      <ZombieLeaderboard
        burners={burnerData?.burners ?? null}
        open={zombieLeaderboardOpen}
        onClose={() => setZombieLeaderboardOpen(false)}
      />
    </div>
  );
}
