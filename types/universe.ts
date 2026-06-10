export type HolderGroupTier = "core" | "inner" | "middle" | "outer";

export type HolderGroupStar = {
  id: string;
  label: string;
  rankStart: number;
  rankEnd: number;
  holderCount: number;
  totalNormies: number;
  tier: HolderGroupTier;
  size: number;
  brightness: number;
  color: string;
  position: [number, number, number];
  distanceFromCenter: number;
  clickable: true;
  wallet?: string;
  walletDisplay?: string;
  collectionRank?: number;
};

export type AmbientStar = {
  id: string;
  position: [number, number, number];
  size: number;
  brightness: number;
  color: string;
};

export type SkyStarBase = {
  position: [number, number, number];
  screenPixels: number;
  opacity: number;
  color: [number, number, number];
  twinklePhase: number;
  twinkleSpeed: number;
  twinkles: boolean;
  tier: 0 | 1 | 2 | 3;
};

export type DecorativeSkyStar = SkyStarBase & {
  id: string;
};

export type OuterHolderStar = SkyStarBase & {
  id: string;
  wallet: string;
  walletDisplay: string;
  collectionRank: number;
  normieCount: number;
  distanceFromCenter: number;
};

export type CameraTarget =
  | { type: "overview" }
  | { type: "group"; group: HolderGroupStar }
  | { type: "core" };

export type WalletSelection = {
  wallet: string;
  walletDisplay: string;
  normieCount: number;
  rank?: number;
};

export type LocatorTarget =
  | {
      kind: "holder";
      starKind: "top75" | "outer";
      wallet: string;
      walletDisplay: string;
      normieCount: number;
      rank?: number;
      position: [number, number, number];
      baseCoreSize?: number;
      baseGlowSize?: number;
      baseGlowOpacity?: number;
      baseScreenPixels?: number;
      color: string;
    }
  | {
      kind: "pyre";
      tokenId: string;
      label: string;
      position: [number, number, number];
    };

export type UniverseSceneState = {
  hoveredGroup: HolderGroupStar | null;
  selectedGroup: HolderGroupStar | null;
  hoveredCore: boolean;
  selectedCore: boolean;
  cameraTarget: CameraTarget;
};
